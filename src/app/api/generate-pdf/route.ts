import { NextRequest, NextResponse } from 'next/server';
import { generatePdfWithPuppeteer } from '@/lib/pdf-generator';

export async function POST(request: NextRequest) {
  try {
    const { mindeeData, userId, receiptImageUrl } = await request.json();
    
    if (!mindeeData) {
      return NextResponse.json(
        { error: 'mindeeData is required' },
        { status: 400 }
      );
    }

    // Generar el PDF usando la función existente
    const pdfResult = await generatePdfWithPuppeteer(mindeeData, userId, receiptImageUrl);
    
    if (!pdfResult.success) {
      return NextResponse.json(
        { error: pdfResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pdf_url: pdfResult.data.download_url,
      template_id: pdfResult.data.template_id || 'custom-template',
      transaction_ref: pdfResult.data.file_name || `tx-${Date.now()}`,
      total_pages: 1, // Por defecto 1 página
      generated_at: pdfResult.data.generated_at,
      full_response: pdfResult.data
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 