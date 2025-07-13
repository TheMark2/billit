import { NextResponse } from 'next/server';

// Test data similar to what we get from upload-receipt
const testReceiptData = {
  supplier_name: "LA PEPITA BURGER BAR",
  supplier_details: "B27803899",
  supplier_cif: "B27803899",
  supplier_phone: "",
  supplier_email: "",
  customer_name: "Asif Grup",
  customer_details: "49718724S | 682788998 | asifgrup@gmail.com",
  customer_cif: "49718724S",
  customer_address: "C/Montserrat, 2",
  customer_phone: "682788998",
  customer_email: "asifgrup@gmail.com",
  date: "2018-11-30",
  due_date: null,
  current_date: "15/1/2025",
  currency: "EUR",
  total_amount: 27,
  total_net: 24.55,
  total_tax: 2.45,
  tax_rate: 10,
  tax_base: 24.55,
  tax_amount: 2.45,
  invoice_number: "T001/96666",
  document_type: "invoice",
  city: "Florez",
  adress: "DACYS FOOO S.L B27803899 C/ Juan Florez NO13 15004 - A Coruña",
  line_items: [
    {
      description: "AGUA CON GAS 33 CL",
      quantity: 1,
      unit_price: 1.5,
      total: 1.5
    },
    {
      description: "CANA ESTRELLA GALIC",
      quantity: 1,
      unit_price: 2,
      total: 2
    },
    {
      description: "WICHITA",
      quantity: 1,
      unit_price: 12.5,
      total: 12.5
    },
    {
      description: "SORRENTINA",
      quantity: 1,
      unit_price: 8.5,
      total: 8.5
    },
    {
      description: "PATATAS FINAS",
      quantity: 1,
      unit_price: 2.5,
      total: 2.5
    }
  ],
  payment_method: "Efectivo"
};

export async function GET() {
  try {
    console.log('🔍 Testing data format for APITemplate...');
    
    const apiKey = process.env.APITEMPLATE_API_KEY;
    const templateId = process.env.APITEMPLATE_TEMPLATE_ID || '20877b23684b10a8';
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    console.log('📋 Testing with template ID:', templateId);
    console.log('📊 Test data keys:', Object.keys(testReceiptData));
    console.log('🔑 API Key length:', apiKey.length);

    const response = await fetch(`https://rest.apitemplate.io/v2/create-pdf?template_id=${templateId}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testReceiptData),
    });

    const responseText = await response.text();
    console.log('📡 Response status:', response.status);
    console.log('📡 Response text (first 200 chars):', responseText.substring(0, 200));

    if (!response.ok) {
      console.error('❌ APITemplate error:', response.statusText);
      return NextResponse.json({ 
        error: 'Failed to test format', 
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

    console.log('✅ Format test successful');
    
    return NextResponse.json({
      success: true,
      message: 'Format test completed successfully',
      test_data: testReceiptData,
      api_response: responseData,
      metadata: {
        template_id: templateId,
        data_keys: Object.keys(testReceiptData),
        response_status: response.status
      }
    });

  } catch (error) {
    console.error('❌ Error testing format:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 