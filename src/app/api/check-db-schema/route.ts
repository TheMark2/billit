import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente de Supabase con service role para operaciones de admin
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [CHECK-DB] Verificando campos de imagen en la tabla receipts...');
    
    // Intentar hacer una consulta SELECT para verificar si los campos existen
    const { data: recentReceipts, error: selectError } = await supabaseService
      .from('receipts')
      .select('id, url_imagen, url_archivo, original_image_path, created_at')
      .order('created_at', { ascending: false })
      .limit(3);
    
    console.log('📄 [CHECK-DB] Consulta SELECT resultado:', {
      error: selectError,
      dataLength: recentReceipts?.length,
      firstRecord: recentReceipts?.[0]
    });
    
    // Verificar si hay errores relacionados con columnas inexistentes
    let missingFields = [];
    if (selectError) {
      if (selectError.message.includes('url_imagen')) {
        missingFields.push('url_imagen');
      }
      if (selectError.message.includes('url_archivo')) {
        missingFields.push('url_archivo');
      }
      if (selectError.message.includes('original_image_path')) {
        missingFields.push('original_image_path');
      }
    }
    
    // Intentar una consulta más simple para verificar la tabla
    const { data: simpleData, error: simpleError } = await supabaseService
      .from('receipts')
      .select('id, created_at')
      .limit(1);
    
    console.log('📋 [CHECK-DB] Consulta simple resultado:', {
      error: simpleError,
      dataLength: simpleData?.length
    });
    
    return NextResponse.json({
      success: !selectError || selectError.code === 'PGRST116',
      message: 'Database field check completed',
      selectError: selectError,
      missingFields: missingFields,
      recentReceipts: recentReceipts || [],
      tableAccessible: !simpleError,
      recommendations: missingFields.length > 0 ? [
        `Los siguientes campos no existen en la tabla receipts: ${missingFields.join(', ')}`,
        'Necesitas ejecutar una migración para agregar estos campos'
      ] : [
        'Todos los campos de imagen existen en la tabla receipts'
      ]
    });
    
  } catch (error) {
    console.error('💥 [CHECK-DB] Error interno:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
