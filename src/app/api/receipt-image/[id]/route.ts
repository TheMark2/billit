import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { downloadOriginalImage } from '@/lib/supabase-storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: receiptId } = await params;

    if (!receiptId) {
      return NextResponse.json(
        { error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    // Crear cliente de Supabase con service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener el recibo de la base de datos
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('metadatos, url_archivo, original_image_path')
      .eq('id', receiptId)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Intentar obtener la imagen original desde diferentes fuentes
    let imageData = null;
    let contentType = 'image/jpeg';

    // 1. PRIMERA PRIORIDAD: Verificar Supabase Storage con original_image_path
    if (receipt.original_image_path) {
      console.log('🔍 Buscando imagen en Supabase Storage:', receipt.original_image_path);
      try {
        const downloadResult = await downloadOriginalImage(receipt.original_image_path);
        if (downloadResult.success && downloadResult.data) {
          imageData = downloadResult.data;
          contentType = downloadResult.contentType || 'image/jpeg';
          console.log('✅ Imagen encontrada en Supabase Storage');
        } else {
          console.warn('⚠️ Error descargando de Supabase Storage:', downloadResult.error);
        }
      } catch (error) {
        console.error('❌ Error accessing Supabase Storage:', error);
      }
    }

    // 2. FALLBACK: Verificar si hay datos de WhatsApp con URL original
    if (!imageData && receipt.metadatos?.whatsapp_data?.file_info?.original_url) {
      const originalUrl = receipt.metadatos.whatsapp_data.file_info.original_url;
      console.log('🔍 Intentando cargar desde URL de WhatsApp:', originalUrl);
      try {
        const imageResponse = await fetch(originalUrl);
        if (imageResponse.ok) {
          imageData = await imageResponse.arrayBuffer();
          contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
          console.log('✅ Imagen cargada desde URL de WhatsApp');
        }
      } catch (error) {
        console.error('❌ Error fetching WhatsApp image:', error);
      }
    }

    // 3. FALLBACK: Verificar si hay datos binarios almacenados en metadatos
    if (!imageData && receipt.metadatos?.file_data) {
      console.log('🔍 Intentando cargar desde base64 en metadatos');
      try {
        imageData = Buffer.from(receipt.metadatos.file_data, 'base64');
        contentType = receipt.metadatos.file_type || 'image/jpeg';
        console.log('✅ Imagen cargada desde base64');
      } catch (error) {
        console.error('❌ Error processing base64 image data:', error);
      }
    }

    // 4. FALLBACK: Verificar storage de Supabase con file_path legacy
    if (!imageData && receipt.metadatos?.file_path) {
      console.log('🔍 Intentando cargar desde path legacy en receipts bucket');
      try {
        const { data: storageData, error: storageError } = await supabase.storage
          .from('receipts')
          .download(receipt.metadatos.file_path);
        
        if (!storageError && storageData) {
          imageData = await storageData.arrayBuffer();
          contentType = storageData.type || 'image/jpeg';
          console.log('✅ Imagen cargada desde receipts bucket');
        }
      } catch (error) {
        console.error('❌ Error fetching from legacy storage:', error);
      }
    }

    if (!imageData) {
      return NextResponse.json(
        { error: 'Original image not found' },
        { status: 404 }
      );
    }

    // Devolver la imagen
    return new NextResponse(imageData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache por 1 hora
      },
    });

  } catch (error) {
    console.error('Error getting receipt image:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 