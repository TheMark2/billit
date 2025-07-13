import { NextRequest, NextResponse } from 'next/server';
import { generatePdfWithApiTemplate } from '@/app/api/upload-receipt/route';

export async function POST(request: NextRequest) {
  try {
    const { mindeeData, userId } = await request.json();
    
    if (!mindeeData) {
      return NextResponse.json(
        { error: 'mindeeData is required' },
        { status: 400 }
      );
    }

    // Generar el PDF usando la función existente
    const pdfResult = await generatePdfWithApiTemplate(mindeeData, userId);
    
    if (!pdfResult.success) {
      return NextResponse.json(
        { error: pdfResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pdf_url: pdfResult.data.download_url,
      template_id: pdfResult.data.template_id,
      transaction_ref: pdfResult.data.api_response.transaction_ref,
      total_pages: pdfResult.data.api_response.total_pages,
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