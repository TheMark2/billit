import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔍 Testing PDF generation...');
    
    const apiKey = process.env.APITEMPLATE_API_KEY;
    const templateId = process.env.APITEMPLATE_TEMPLATE_ID || '20877b23684b10a8';
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Test data structure similar to upload-receipt
    const testData = {
      supplier: "Test Supplier Name",
      supplier_details: "B12345678",
      supplier_cif: "B12345678",
      supplier_phone: "123456789",
      supplier_email: "test@supplier.com",
      customer_name: "Test Customer",
      customer_details: "12345678A | 987654321 | test@customer.com",
      customer_cif: "12345678A",
      customer_address: "Test Address, 123",
      customer_phone: "987654321",
      customer_email: "test@customer.com",
      date: "2025-01-15",
      due_date: null,
      current_date: "15/1/2025",
      currency: "EUR",
      total_amount: 121.00,
      total_net: 100.00,
      total_tax: 21.00,
      tax_rate: 21,
      tax_base: 100.00,
      tax_amount: 21.00,
      invoice_number: "TEST-001",
      document_type: "invoice",
      city: "Test City",
      adress: "Test Address, 123, Test City",
      line_items: [
        {
          description: "Test Service 1",
          quantity: 2,
          unit_price: 25.00,
          total: 50.00
        },
        {
          description: "Test Product 1",
          quantity: 1,
          unit_price: 50.00,
          total: 50.00
        }
      ],
      payment_method: "Transferencia"
    };

    console.log('📋 Using template ID:', templateId);
    console.log('📊 Test data keys:', Object.keys(testData));

    const response = await fetch(`https://rest.apitemplate.io/v2/create-pdf?template_id=${templateId}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const responseText = await response.text();
    console.log('📡 Response status:', response.status);
    console.log('📡 Response text (first 200 chars):', responseText.substring(0, 200));

    if (!response.ok) {
      console.error('❌ APITemplate error:', response.statusText);
      return NextResponse.json({ 
        error: 'Failed to generate PDF', 
        status: response.status,
        response: responseText
      }, { status: response.status });
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse response:', parseError);
      return NextResponse.json({ 
        error: 'Invalid JSON response', 
        raw_response: responseText 
      }, { status: 500 });
    }

    console.log('✅ PDF generation test successful');
    
    return NextResponse.json({
      success: true,
      message: 'PDF generation test completed successfully',
      test_data: testData,
      api_response: responseData,
      metadata: {
        template_id: templateId,
        data_keys: Object.keys(testData),
        response_status: response.status
      }
    });

  } catch (error) {
    console.error('❌ Error testing PDF generation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    console.log('🔍 Testing PDF generation with POST...');
    
    const apiKey = process.env.APITEMPLATE_API_KEY;
    const templateId = process.env.APITEMPLATE_TEMPLATE_ID || '20877b23684b10a8';
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Simple test data
    const testData = {
      supplier: "POST Test Supplier",
      customer_name: "POST Test Customer",
      date: "2025-01-15",
      total_amount: 100.00,
      currency: "EUR"
    };

    console.log('📋 Using template ID:', templateId);
    console.log('📊 Test data:', testData);

    const response = await fetch(`https://rest.apitemplate.io/v2/create-pdf?template_id=${templateId}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const responseText = await response.text();
    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      console.error('❌ APITemplate error:', response.statusText);
      return NextResponse.json({ 
        error: 'Failed to generate PDF', 
        status: response.status,
        response: responseText
      }, { status: response.status });
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse response:', parseError);
      return NextResponse.json({ 
        error: 'Invalid JSON response', 
        raw_response: responseText 
      }, { status: 500 });
    }

    console.log('✅ POST PDF generation test successful');
    
    return NextResponse.json({
      success: true,
      message: 'POST PDF generation test completed successfully',
      test_data: testData,
      api_response: responseData
    });

  } catch (error) {
    console.error('❌ Error testing PDF generation with POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 