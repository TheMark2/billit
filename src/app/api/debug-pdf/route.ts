import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generatePdfWithPuppeteer } from '@/lib/pdf-generator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Obtener el recibo
    const { data: receipt, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (error || !receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Debug de metadatos
    console.log('🔍 [DEBUG_PDF] Receipt ID:', receiptId);
    console.log('🔍 [DEBUG_PDF] Receipt metadatos:', JSON.stringify(receipt.metadatos, null, 2));
    
    // Verificar si hay edited_line_items
    const hasEditedLineItems = receipt.metadatos?.edited_line_items;
    const hasMindeeLineItems = receipt.metadatos?.mindee_data?.line_items;
    
    console.log('🔍 [DEBUG_PDF] Has edited_line_items:', !!hasEditedLineItems);
    console.log('🔍 [DEBUG_PDF] Has mindee line_items:', !!hasMindeeLineItems);
    
    if (hasEditedLineItems) {
      console.log('✅ [DEBUG_PDF] Edited line items:', receipt.metadatos.edited_line_items);
    }
    
    if (hasMindeeLineItems) {
      console.log('📊 [DEBUG_PDF] Mindee line items:', receipt.metadatos.mindee_data.line_items);
    }

    // Preparar datos para generar PDF
    const mindeeData = {
      ...receipt.metadatos?.mindee_data,
      // Usar edited_line_items si están disponibles
      edited_line_items: receipt.metadatos?.edited_line_items,
      // Usar datos del recibo si están disponibles
      proveedor: receipt.proveedor,
      numero_factura: receipt.numero_factura,
      fecha_emision: receipt.fecha_emision,
      moneda: receipt.moneda,
      tipo_factura: receipt.tipo_factura,
      total: receipt.total
    };

    console.log('📊 [DEBUG_PDF] Data for PDF generation:', JSON.stringify(mindeeData, null, 2));

    // Generar PDF
    const pdfResult = await generatePdfWithPuppeteer(mindeeData, receipt.user_id);

    if (!pdfResult.success) {
      return NextResponse.json(
        { error: `Error generando PDF: ${pdfResult.error}` },
        { status: 500 }
      );
    }

    console.log('✅ [DEBUG_PDF] PDF generated successfully:', pdfResult.data);

    return NextResponse.json({
      success: true,
      debug_info: {
        receipt_id: receiptId,
        has_edited_line_items: !!hasEditedLineItems,
        has_mindee_line_items: !!hasMindeeLineItems,
        edited_line_items: receipt.metadatos?.edited_line_items || null,
        mindee_line_items: receipt.metadatos?.mindee_data?.line_items || null,
        pdf_generation_success: pdfResult.success
      },
      pdf_data: pdfResult.data,
      message: 'PDF debug completed successfully'
    });

  } catch (error) {
    console.error('❌ [DEBUG_PDF] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 