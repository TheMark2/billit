import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '@/utils/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const receiptId = searchParams.get('receipt_id');

    if (!receiptId) {
      return NextResponse.json({ error: 'Receipt ID es requerido' }, { status: 400 });
    }

    const supabase = supabaseService();

    // Obtener información del recibo
    const { data: receipt, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (error || !receipt) {
      console.error('Error fetching receipt:', error);
      return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
    }

    // Obtener información del PDF desde los metadatos
    const pdfUrl = receipt.metadatos?.pdf_url;
    const pdfTransactionRef = receipt.metadatos?.pdf_transaction_ref;

    if (!pdfUrl) {
      return NextResponse.json({ 
        available: false, 
        message: 'PDF no disponible para este recibo' 
      }, { status: 200 });
    }

    return NextResponse.json({
      available: true,
      pdf_url: pdfUrl,
      transaction_ref: pdfTransactionRef,
      download_url: `/api/pdf-download?receipt_id=${receiptId}`,
      receipt_id: receiptId
    });

  } catch (error) {
    console.error('Error getting PDF info:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
} 