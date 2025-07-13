import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔍 Listing APITemplate templates...');
    
    const apiKey = process.env.APITEMPLATE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const response = await fetch('https://rest.apitemplate.io/v2/list-templates', {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ APITemplate error:', response.statusText);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: response.status });
    }

    const data = await response.json();
    console.log('✅ Templates fetched successfully');
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error listing templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 