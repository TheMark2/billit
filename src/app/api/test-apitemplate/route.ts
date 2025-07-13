import { NextResponse } from 'next/server';

// Función para crear un template de prueba
export async function POST() {
  try {
    console.log('📋 Creating test template...');
    
    const apiKey = process.env.APITEMPLATE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const response = await fetch('https://rest.apitemplate.io/v2/create-template', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test Template',
        type: 'pdf',
        content: '<h1>Test Template</h1><p>This is a test template.</p>',
      }),
    });

    if (!response.ok) {
      console.error('❌ APITemplate error:', response.statusText);
      return NextResponse.json({ error: 'Failed to create template' }, { status: response.status });
    }

    const data = await response.json();
    console.log('✅ Template created successfully');
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error creating template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Función para probar la generación de PDF
export async function GET() {
  try {
    console.log('🔍 Testing PDF generation...');
    
    const apiKey = process.env.APITEMPLATE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const testData = {
      supplier: 'Test Supplier',
      customer_name: 'Test Customer',
      date: '2024-01-01',
      total_amount: 100.00,
      currency: 'EUR',
      line_items: [
        {
          description: 'Test Item',
          quantity: 1,
          unit_price: 100.00,
          total: 100.00
        }
      ]
    };

    const templateId = process.env.APITEMPLATE_TEMPLATE_ID || '20877b23684b10a8';
    const response = await fetch(`https://rest.apitemplate.io/v2/create-pdf?template_id=${templateId}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    if (!response.ok) {
      console.error('❌ APITemplate error:', response.statusText);
      return NextResponse.json({ error: 'Failed to generate PDF' }, { status: response.status });
    }

    const data = await response.json();
    console.log('✅ PDF generated successfully');
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 