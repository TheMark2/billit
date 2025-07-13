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

    // Obtener la URL del PDF desde los metadatos
    const pdfUrl = receipt.metadatos?.pdf_url;

    if (!pdfUrl) {
      return NextResponse.json({ error: 'PDF no disponible para este recibo' }, { status: 404 });
    }

    // Hacer redirect a la URL del PDF
    return NextResponse.redirect(pdfUrl);

  } catch (error) {
    console.error('Error downloading PDF:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
} 