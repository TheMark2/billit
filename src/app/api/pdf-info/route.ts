import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generatePdfWithPuppeteer } from '@/lib/pdf-generator';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const receiptId = searchParams.get('receipt_id');

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
      .select('*')
      .eq('id', receiptId)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Verificar si existe el PDF generado en los metadatos
    let pdfGeneration = receipt.metadatos?.pdf_generation;
    
    if (!pdfGeneration || !pdfGeneration.download_url) {
      // Si no existe el PDF, intentar generarlo on-demand
      console.log('PDF no encontrado en metadatos, generando on-demand...');
      
      // Verificar si tenemos los datos necesarios para generar el PDF
      let mindeeData = null;
      
      if (receipt.metadatos?.mindee_data) {
        mindeeData = receipt.metadatos.mindee_data;
      } else if (receipt.texto_extraido) {
        // Intentar parsear el texto extraído
        try {
          mindeeData = JSON.parse(receipt.texto_extraido);
        } catch (parseError) {
          console.error('Error parsing texto_extraido:', parseError);
        }
      }
      
      if (!mindeeData) {
        return NextResponse.json(
          { error: 'No hay datos suficientes para generar el PDF. Este recibo fue procesado antes de la implementación de PDF.' },
          { status: 404 }
        );
      }
      
      // Generar el PDF
      const pdfResult = await generatePdfWithPuppeteer(mindeeData, receipt.user_id);
      
      if (!pdfResult.success) {
        console.error('Error generando PDF on-demand:', pdfResult.error);
        return NextResponse.json(
          { error: 'Error generando PDF: ' + pdfResult.error },
          { status: 500 }
        );
      }
      
      // Actualizar los metadatos del recibo con el PDF generado
      const updatedMetadatos = {
        ...receipt.metadatos,
        pdf_generation: {
          download_url: pdfResult.data.download_url,
          pdf_url: pdfResult.data.pdf_url || pdfResult.data.download_url,
          template_id: pdfResult.data.template_id,
          transaction_ref: pdfResult.data.api_response?.transaction_ref,
          total_pages: pdfResult.data.api_response?.total_pages,
          generated_at: pdfResult.data.generated_at,
          status: "success",
          generated_on_demand: true
        }
      };
      
      // Actualizar el recibo en la base de datos
      await supabase
        .from('receipts')
        .update({ 
          metadatos: updatedMetadatos,
          url_archivo: pdfResult.data.download_url 
        })
        .eq('id', receiptId);
      
      pdfGeneration = updatedMetadatos.pdf_generation;
    }

    // Devolver información del PDF
    return NextResponse.json({
      success: true,
      data: {
        pdf_url: pdfGeneration.download_url,
        pdf_direct_url: pdfGeneration.pdf_url || pdfGeneration.download_url,
        generated_at: pdfGeneration.generated_at,
        template_id: pdfGeneration.template_id,
        generated_on_demand: pdfGeneration.generated_on_demand || false,
        receipt_info: {
          id: receipt.id,
          proveedor: receipt.proveedor,
          total: receipt.total,
          fecha_emision: receipt.fecha_emision,
          numero_factura: receipt.numero_factura
        }
      }
    });

  } catch (error) {
    console.error('Error getting PDF info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 