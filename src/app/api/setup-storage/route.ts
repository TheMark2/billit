import { NextRequest, NextResponse } from 'next/server';
import { ensurePdfStorageBucket } from '@/lib/pdf-generator';

export async function POST(request: NextRequest) {
  try {
    // Crear bucket de almacenamiento si no existe
    await ensurePdfStorageBucket();
    
    return NextResponse.json({
      success: true,
      message: 'PDF storage bucket configured successfully'
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Error setting up storage' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'PDF storage setup endpoint',
    usage: 'Send POST request to setup storage bucket'
  });
} 