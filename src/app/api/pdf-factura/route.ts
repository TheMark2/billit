import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // Obtener el token de autorización del header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { searchParams } = new URL(request.url);
    const receiptId = searchParams.get('receipt_id');

    if (!receiptId) {
      return NextResponse.json(
        { error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    // Crear cliente de Supabase con el token del usuario
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Obtener el recibo de la base de datos
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .eq('user_id', user.id)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Verificar si existe el PDF generado en los metadatos
    const pdfGeneration = receipt.metadatos?.pdf_generation;
    
    if (!pdfGeneration || !pdfGeneration.download_url) {
      return NextResponse.json(
        { error: 'PDF no disponible para este recibo' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        pdf_url: pdfGeneration.download_url,
        pdf_direct_url: pdfGeneration.pdf_url,
        generated_at: pdfGeneration.generated_at,
        template_id: pdfGeneration.template_id,
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
    console.error('Error getting PDF:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Obtener el token de autorización del header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { receipt_id, regenerate } = await request.json();

    if (!receipt_id) {
      return NextResponse.json(
        { error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    // Crear cliente de Supabase con el token del usuario
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Obtener el recibo de la base de datos
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receipt_id)
      .eq('user_id', user.id)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Si no es regeneración y ya existe el PDF, devolverlo
    if (!regenerate && receipt.metadatos?.pdf_generation?.download_url) {
      return NextResponse.json({
        success: true,
        data: receipt.metadatos.pdf_generation,
        message: 'PDF ya existente'
      });
    }

    // Regenerar el PDF con los datos de Mindee
    const mindeeData = receipt.metadatos?.mindee_data;
    
    if (!mindeeData) {
      return NextResponse.json(
        { error: 'No hay datos de Mindee disponibles para regenerar el PDF' },
        { status: 400 }
      );
    }

    // Importar la función de generación de PDF
    const { generatePdfWithApiTemplate } = await import('../upload-receipt/route');
    const pdfResult = await generatePdfWithApiTemplate(mindeeData, user.id);

    if (!pdfResult.success) {
      return NextResponse.json(
        { error: `Error generando PDF: ${pdfResult.error}` },
        { status: 500 }
      );
    }

    // Actualizar los metadatos del recibo con el nuevo PDF
    const updatedMetadatos = {
      ...receipt.metadatos,
      pdf_generation: pdfResult.data
    };

    const { error: updateError } = await supabase
      .from('receipts')
      .update({ metadatos: updatedMetadatos })
      .eq('id', receipt_id);

    if (updateError) {
      console.error('Error updating receipt metadata:', updateError);
      return NextResponse.json(
        { error: 'Error actualizando el recibo' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: pdfResult.data,
      message: 'PDF generado exitosamente'
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 