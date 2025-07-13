import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const receiptId = searchParams.get('receipt_id');

    if (!receiptId) {
      return NextResponse.json(
        { error: 'receipt_id parameter is required' },
        { status: 400 }
      );
    }

    // Crear cliente de Supabase con service role key para acceder a todos los datos
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener el recibo de la base de datos
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Verificar las variables de entorno
    const envCheck = {
      APITEMPLATE_API_KEY: process.env.APITEMPLATE_API_KEY ? 'SET' : 'NOT SET',
      APITEMPLATE_TEMPLATE_ID: process.env.APITEMPLATE_TEMPLATE_ID ? 'SET' : 'NOT SET',
      APITEMPLATE_API_KEY_LENGTH: process.env.APITEMPLATE_API_KEY?.length || 0,
      APITEMPLATE_TEMPLATE_ID_VALUE: process.env.APITEMPLATE_TEMPLATE_ID || 'NOT SET'
    };

    // Verificar los metadatos del recibo
    const metadata = receipt.metadatos || {};
    const pdfGeneration = metadata.pdf_generation || {};
    const mindeeData = metadata.mindee_data || {};

    // Diagnóstico completo
    const diagnosis = {
      receipt_id: receiptId,
      receipt_found: true,
      receipt_provider: receipt.proveedor,
      receipt_total: receipt.total,
      receipt_date: receipt.fecha_emision,
      
      environment_variables: envCheck,
      
      metadata_structure: {
        has_mindee_data: !!mindeeData && Object.keys(mindeeData).length > 0,
        mindee_data_keys: Object.keys(mindeeData),
        has_pdf_generation: !!pdfGeneration && Object.keys(pdfGeneration).length > 0,
        pdf_generation_keys: Object.keys(pdfGeneration),
        has_error: !!pdfGeneration.error,
        pdf_error: pdfGeneration.error || null,
        has_download_url: !!pdfGeneration.download_url,
        download_url: pdfGeneration.download_url || null,
        integrations_summary: metadata.integrations_summary || null
      },
      
      // Muestra de los datos de Mindee (primeros campos)
      mindee_sample: mindeeData ? {
        supplier_name: mindeeData.supplier_name,
        total_amount: mindeeData.total_amount,
        currency: mindeeData.currency,
        invoice_number: mindeeData.invoice_number,
        line_items_count: mindeeData.line_items?.length || 0
      } : null,
      
      // Información completa del PDF
      pdf_generation_full: pdfGeneration
    };

    return NextResponse.json({
      success: true,
      message: 'Diagnóstico completo del recibo',
      diagnosis,
      recommendations: generateRecommendations(diagnosis)
    });

  } catch (error) {
    console.error('Debug PDF error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Error en el endpoint de diagnóstico'
      },
      { status: 500 }
    );
  }
}

function generateRecommendations(diagnosis: any): string[] {
  const recommendations = [];

  // Verificar variables de entorno
  if (diagnosis.environment_variables.APITEMPLATE_API_KEY === 'NOT SET') {
    recommendations.push('❌ Variable APITEMPLATE_API_KEY no configurada en .env.local');
  }

  if (diagnosis.environment_variables.APITEMPLATE_TEMPLATE_ID === 'NOT SET') {
    recommendations.push('❌ Variable APITEMPLATE_TEMPLATE_ID no configurada en .env.local');
  }

  // Verificar estructura de datos
  if (!diagnosis.metadata_structure.has_mindee_data) {
    recommendations.push('❌ No hay datos de Mindee disponibles para generar PDF');
  }

  if (diagnosis.metadata_structure.has_error) {
    recommendations.push(`❌ Error en generación de PDF: ${diagnosis.metadata_structure.pdf_error}`);
  }

  if (!diagnosis.metadata_structure.has_pdf_generation) {
    recommendations.push('❌ No se intentó generar PDF o falló completamente');
  }

  if (!diagnosis.metadata_structure.has_download_url) {
    recommendations.push('❌ No hay URL de descarga del PDF disponible');
  }

  // Recomendaciones de solución
  if (recommendations.length === 0) {
    recommendations.push('✅ Todo parece estar configurado correctamente');
  } else {
    recommendations.push('💡 Soluciones sugeridas:');
    recommendations.push('1. Verificar variables de entorno en .env.local');
    recommendations.push('2. Probar el endpoint /api/test-pdf para verificar conexión');
    recommendations.push('3. Regenerar el PDF usando el botón "Regenerar" en la interfaz');
    recommendations.push('4. Verificar logs del servidor para más detalles');
  }

  return recommendations;
}

export async function POST(request: NextRequest) {
  try {
    const { receipt_id } = await request.json();

    if (!receipt_id) {
      return NextResponse.json(
        { error: 'receipt_id is required' },
        { status: 400 }
      );
    }

    // Intentar regenerar el PDF
    const { generatePdfWithApiTemplate } = await import('../upload-receipt/route');
    
    // Obtener datos del recibo
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receipt_id)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    const mindeeData = receipt.metadatos?.mindee_data;
    
    if (!mindeeData) {
      return NextResponse.json(
        { error: 'No Mindee data available' },
        { status: 400 }
      );
    }

    console.log('🔧 DEBUG: Attempting PDF generation...');
    const pdfResult = await generatePdfWithApiTemplate(mindeeData, receipt.user_id);

    if (pdfResult.success) {
      // Actualizar los metadatos del recibo
      const updatedMetadatos = {
        ...receipt.metadatos,
        pdf_generation: pdfResult.data
      };

      await supabase
        .from('receipts')
        .update({ metadatos: updatedMetadatos })
        .eq('id', receipt_id);

      console.log('✅ DEBUG: PDF generated and saved successfully');
    }

    return NextResponse.json({
      success: true,
      message: 'Intento de regeneración de PDF completado',
      pdf_result: pdfResult,
      mindee_data_available: !!mindeeData,
      mindee_data_keys: Object.keys(mindeeData)
    });

  } catch (error) {
    console.error('Debug PDF POST error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Error en la regeneración de PDF'
      },
      { status: 500 }
    );
  }
} 