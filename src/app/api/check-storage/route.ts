import { NextRequest, NextResponse } from 'next/server';
import { ensureOriginalImagesBucket } from '@/lib/supabase-storage';
import { createClient } from '@supabase/supabase-js';

// Cliente de Supabase con service role para operaciones de storage
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [CHECK-STORAGE] Iniciando verificación de storage...');
    
    // Asegurar que el bucket existe
    await ensureOriginalImagesBucket();
    
    // Listar buckets para verificar
    const { data: buckets, error: listError } = await supabaseService.storage.listBuckets();
    
    if (listError) {
      console.error('❌ [CHECK-STORAGE] Error listando buckets:', listError);
      return NextResponse.json({
        success: false,
        error: 'Error listing buckets',
        details: listError
      }, { status: 500 });
    }
    
    console.log('📋 [CHECK-STORAGE] Buckets encontrados:', buckets?.map(b => b.name));
    
    // Verificar si el bucket original-receipts existe
    const originalReceiptsBucket = buckets?.find(b => b.name === 'original-receipts');
    
    if (!originalReceiptsBucket) {
      console.error('❌ [CHECK-STORAGE] Bucket "original-receipts" no encontrado');
      return NextResponse.json({
        success: false,
        error: 'Bucket original-receipts not found',
        buckets: buckets?.map(b => b.name)
      }, { status: 404 });
    }
    
    console.log('✅ [CHECK-STORAGE] Bucket "original-receipts" encontrado:', originalReceiptsBucket);
    
    // Intentar listar archivos en el bucket para verificar permisos
    const { data: files, error: filesError } = await supabaseService.storage
      .from('original-receipts')
      .list('', { limit: 5 });
    
    if (filesError) {
      console.error('❌ [CHECK-STORAGE] Error listando archivos:', filesError);
      return NextResponse.json({
        success: false,
        error: 'Error listing files in bucket',
        details: filesError
      }, { status: 500 });
    }
    
    console.log('📁 [CHECK-STORAGE] Archivos en bucket (últimos 5):', files?.map(f => f.name));
    
    return NextResponse.json({
      success: true,
      message: 'Storage verification completed successfully',
      bucket: originalReceiptsBucket,
      filesCount: files?.length || 0,
      recentFiles: files?.slice(0, 5).map(f => ({
        name: f.name,
        size: f.metadata?.size,
        lastModified: f.updated_at
      }))
    });
    
  } catch (error) {
    console.error('💥 [CHECK-STORAGE] Error interno:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Storage verification endpoint',
    usage: 'Send POST request to check storage bucket status'
  });
}
