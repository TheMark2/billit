import { createClient } from '@supabase/supabase-js';

// Cliente de Supabase con service role para operaciones de storage
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface UploadImageResult {
  success: boolean;
  path?: string;
  publicUrl?: string;
  error?: string;
}

/**
 * Asegura que el bucket de imágenes originales existe
 */
export async function ensureOriginalImagesBucket(): Promise<void> {
  try {
    console.log('🔧 [STORAGE] Verificando bucket "original-receipts"...');
    
    // Intentar crear el bucket si no existe
    const { error } = await supabaseService.storage.createBucket('original-receipts', {
      public: false, // Bucket privado para mayor seguridad
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      fileSizeLimit: 10 * 1024 * 1024 // 10MB
    });
    
    if (error && !error.message.includes('already exists')) {
      console.error('❌ [STORAGE] Error creando bucket:', error);
    } else if (error && error.message.includes('already exists')) {
      console.log('✅ [STORAGE] Bucket "original-receipts" ya existe');
    } else {
      console.log('✅ [STORAGE] Bucket "original-receipts" creado exitosamente');
    }
  } catch (error) {
    console.error('💥 [STORAGE] Error asegurando bucket:', error);
  }
}

/**
 * Sube una imagen original a Supabase Storage
 */
export async function uploadOriginalImage(
  file: File | Buffer,
  userId: string,
  receiptId: string,
  fileName?: string
): Promise<UploadImageResult> {
  try {
    console.log('🔄 [STORAGE] Iniciando subida de imagen original:', {
      userId,
      receiptId,
      fileName,
      fileSize: file instanceof File ? file.size : file.length,
      fileType: file instanceof File ? file.type : 'Buffer'
    });

    // Asegurar que el bucket existe antes de subir
    await ensureOriginalImagesBucket();

    // Generar nombre de archivo único
    const timestamp = Date.now();
    const fileExtension = fileName ? fileName.split('.').pop() : 'jpg';
    const filePath = `${userId}/${receiptId}_${timestamp}.${fileExtension}`;

    console.log('📁 [STORAGE] Ruta de archivo generada:', filePath);

    // Determinar el tipo de contenido
    let contentType = 'image/jpeg';
    if (file instanceof File) {
      contentType = file.type;
    } else if (fileName) {
      if (fileName.toLowerCase().includes('.png')) contentType = 'image/png';
      if (fileName.toLowerCase().includes('.gif')) contentType = 'image/gif';
      if (fileName.toLowerCase().includes('.webp')) contentType = 'image/webp';
    }

    console.log('🏷️ [STORAGE] Content-Type determinado:', contentType);

    // Subir archivo a Supabase Storage
    console.log('⬆️ [STORAGE] Subiendo archivo al bucket "original-receipts"...');
    const { data, error } = await supabaseService.storage
      .from('original-receipts')
      .upload(filePath, file, {
        contentType,
        upsert: true
      });

    if (error) {
      console.error('❌ [STORAGE] Error subiendo imagen:', {
        message: error.message,
        details: error,
        filePath,
        bucket: 'original-receipts'
      });
      return {
        success: false,
        error: `Error subiendo imagen: ${error.message}`
      };
    }

    console.log('✅ [STORAGE] Imagen subida exitosamente:', {
      path: data?.path,
      fullPath: data?.fullPath,
      id: data?.id
    });

    // Obtener URL pública (aunque el bucket sea privado, necesitamos la URL para el endpoint)
    const { data: publicUrlData } = supabaseService.storage
      .from('original-receipts')
      .getPublicUrl(filePath);

    console.log('🔗 [STORAGE] URL pública generada:', publicUrlData.publicUrl);

    return {
      success: true,
      path: filePath,
      publicUrl: publicUrlData.publicUrl
    };

  } catch (error) {
    console.error('💥 [STORAGE] Error interno en uploadOriginalImage:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      receiptId,
      fileName
    });
    return {
      success: false,
      error: 'Error interno al subir imagen'
    };
  }
}

/**
 * Descarga una imagen original desde Supabase Storage
 */
export async function downloadOriginalImage(filePath: string): Promise<{
  success: boolean;
  data?: ArrayBuffer;
  contentType?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabaseService.storage
      .from('original-receipts')
      .download(filePath);

    if (error) {
      console.error('Error downloading image from storage:', error);
      return {
        success: false,
        error: `Error descargando imagen: ${error.message}`
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'No se encontraron datos de imagen'
      };
    }

    return {
      success: true,
      data: await data.arrayBuffer(),
      contentType: data.type || 'image/jpeg'
    };

  } catch (error) {
    console.error('Error in downloadOriginalImage:', error);
    return {
      success: false,
      error: 'Error interno al descargar imagen'
    };
  }
}

/**
 * Elimina una imagen original de Supabase Storage
 */
export async function deleteOriginalImage(filePath: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabaseService.storage
      .from('original-receipts')
      .remove([filePath]);

    if (error) {
      console.error('Error deleting image from storage:', error);
      return {
        success: false,
        error: `Error eliminando imagen: ${error.message}`
      };
    }

    return { success: true };

  } catch (error) {
    console.error('Error in deleteOriginalImage:', error);
    return {
      success: false,
      error: 'Error interno al eliminar imagen'
    };
  }
}

/**
 * Migra una imagen existente (desde base64 o URL) a Supabase Storage
 */
export async function migrateImageToStorage(
  imageData: string | Buffer,
  userId: string,
  receiptId: string,
  sourceType: 'base64' | 'url' | 'buffer'
): Promise<UploadImageResult> {
  try {
    let buffer: Buffer;

    if (sourceType === 'base64' && typeof imageData === 'string') {
      // Convertir base64 a buffer
      buffer = Buffer.from(imageData, 'base64');
    } else if (sourceType === 'url' && typeof imageData === 'string') {
      // Descargar desde URL
      const response = await fetch(imageData);
      if (!response.ok) {
        throw new Error(`Error descargando imagen: ${response.statusText}`);
      }
      buffer = Buffer.from(await response.arrayBuffer());
    } else if (sourceType === 'buffer' && imageData instanceof Buffer) {
      buffer = imageData;
    } else {
      throw new Error('Tipo de dato de imagen no válido');
    }

    // Subir a storage usando la función principal
    return await uploadOriginalImage(buffer, userId, receiptId);

  } catch (error) {
    console.error('Error in migrateImageToStorage:', error);
    return {
      success: false,
      error: 'Error migrando imagen al storage'
    };
  }
}

/**
 * Verifica si una imagen existe en storage
 */
export async function imageExistsInStorage(filePath: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseService.storage
      .from('original-receipts')
      .list(filePath.split('/').slice(0, -1).join('/'), {
        search: filePath.split('/').pop()
      });

    return !error && data && data.length > 0;
  } catch (error) {
    console.error('Error checking if image exists:', error);
    return false;
  }
} 