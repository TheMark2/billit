import { NextRequest, NextResponse } from 'next/server';

const APITEMPLATE_API_KEY = process.env.APITEMPLATE_API_KEY || 'bb6eMzI4MDY6Mjk5ODU6NWs4YmhqZ2NGUlZjUDlNRg=';
const APITEMPLATE_TEMPLATE_ID = process.env.APITEMPLATE_TEMPLATE_ID || '20877b23684b10a8';

export async function POST(request: NextRequest) {
  try {
    // Datos de prueba mínimos
    const testData = {
      supplier: "Test Supplier",
      date: "2025-01-15",
      currency: "EUR",
      total_amount: 100.50
    };

    const results = [];

    // FORMATO 1: Template ID en el cuerpo (formato que estaba usando)
    console.log('\n📋 FORMATO 1: Template ID en el cuerpo');
    const format1 = {
      template_id: APITEMPLATE_TEMPLATE_ID,
      ...testData
    };
    
    try {
      const response1 = await fetch('https://rest.apitemplate.io/v2/create-pdf', {
        method: 'POST',
        headers: {
          'X-API-KEY': APITEMPLATE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(format1)
      });
      
      const result1 = await response1.text();
      results.push({
        format: 'Template ID en el cuerpo',
        status: response1.status,
        success: response1.ok,
        response: result1.substring(0, 500)
      });
    } catch (error) {
      results.push({
        format: 'Template ID en el cuerpo',
        status: 'ERROR',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // FORMATO 2: Template ID como parámetro URL
    console.log('\n📋 FORMATO 2: Template ID como parámetro URL');
    const url2 = `https://rest.apitemplate.io/v2/create-pdf?template_id=${APITEMPLATE_TEMPLATE_ID}`;
    
    try {
      const response2 = await fetch(url2, {
        method: 'POST',
        headers: {
          'X-API-KEY': APITEMPLATE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
      });
      
      const result2 = await response2.text();
      results.push({
        format: 'Template ID como parámetro URL',
        status: response2.status,
        success: response2.ok,
        response: result2.substring(0, 500)
      });
    } catch (error) {
      results.push({
        format: 'Template ID como parámetro URL',
        status: 'ERROR',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // FORMATO 3: Según documentación oficial (estructura con template_id separado)
    console.log('\n📋 FORMATO 3: Estructura oficial con template_id separado');
    const format3 = {
      template_id: APITEMPLATE_TEMPLATE_ID,
      supplier: testData.supplier,
      date: testData.date,
      currency: testData.currency,
      total_amount: testData.total_amount
    };
    
    try {
      const response3 = await fetch('https://rest.apitemplate.io/v2/create-pdf', {
        method: 'POST',
        headers: {
          'X-API-KEY': APITEMPLATE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(format3)
      });
      
      const result3 = await response3.text();
      results.push({
        format: 'Estructura oficial con template_id separado',
        status: response3.status,
        success: response3.ok,
        response: result3.substring(0, 500)
      });
    } catch (error) {
      results.push({
        format: 'Estructura oficial con template_id separado',
        status: 'ERROR',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // FORMATO 4: Template ID en header
    console.log('\n📋 FORMATO 4: Template ID en header');
    
    try {
      const response4 = await fetch('https://rest.apitemplate.io/v2/create-pdf', {
        method: 'POST',
        headers: {
          'X-API-KEY': APITEMPLATE_API_KEY,
          'Content-Type': 'application/json',
          'X-Template-ID': APITEMPLATE_TEMPLATE_ID
        },
        body: JSON.stringify(testData)
      });
      
      const result4 = await response4.text();
      results.push({
        format: 'Template ID en header',
        status: response4.status,
        success: response4.ok,
        response: result4.substring(0, 500)
      });
    } catch (error) {
      results.push({
        format: 'Template ID en header',
        status: 'ERROR',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Tested different request formats',
      results: results,
      successful_formats: results.filter(r => r.success).map(r => r.format)
    });

  } catch (error) {
    console.error('❌ Test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 