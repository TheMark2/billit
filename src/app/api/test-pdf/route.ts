import { NextRequest, NextResponse } from 'next/server';
import { generatePdfWithApiTemplate } from '../upload-receipt/route';

export async function POST(request: NextRequest) {
  try {
    // Datos de prueba basados en la factura del restaurante LA BIMBA
    const testMindeeData = {
      supplier_name: "BAR RESTAURANT LA BIMBA",
      supplier_company_registrations: [{ value: "31822090A" }],
      supplier_address: "Sta. Eulalia de Ronçana Av. Verge de La Salud, 8",
      supplier_phone_number: { value: "+34 93 123 45 67" },
      supplier_email: { value: "info@labimba.es" },
      
      customer_name: { value: "ReciptAI Cliente" },
      customer_company_registrations: [{ value: "B12345678" }],
      customer_address: { value: "Calle Ejemplo 123, Madrid" },
      
      invoice_number: "T1-1-09359",
      document_type: { value: "invoice" },
      date: "2019-08-02",
      due_date: { value: "2019-09-02" },
      
      currency: "EUR",
      total_amount: 38.95,
      total_net: 35.41,
      total_tax: 3.54,
      
      taxes: [{
        rate: 10,
        base: 35.41,
        value: 3.54
      }],
      
      line_items: [
        {
          description: "FRITOS LA BIMBA",
          quantity: 1,
          unit_price: 11.5,
          total_amount: 11.5
        },
        {
          description: "PATATAS BRAVAS",
          quantity: 1,
          unit_price: 4.5,
          total_amount: 4.5
        },
        {
          description: "CALLOS",
          quantity: 1,
          unit_price: 5,
          total_amount: 5
        },
        {
          description: "CARAJILO",
          quantity: 1,
          unit_price: 1.5,
          total_amount: 1.5
        },
        {
          description: "CAFE",
          quantity: 1,
          unit_price: 1.15,
          total_amount: 1.15
        },
        {
          description: "PAN",
          quantity: 4,
          unit_price: 0.5,
          total_amount: 2.0
        },
        {
          description: "CAFE LECHE",
          quantity: 1,
          unit_price: 1.5,
          total_amount: 1.5
        },
        {
          description: "CORTADO",
          quantity: 1,
          unit_price: 1.3,
          total_amount: 1.3
        },
        {
          description: "MEDIANA",
          quantity: 5,
          unit_price: 1.75,
          total_amount: 8.75
        },
        {
          description: "COPA",
          quantity: 1,
          unit_price: 1.75,
          total_amount: 1.75
        }
      ],
      
      payment_details: [
        { payment_method: "cash" }
      ]
    };

    console.log('🧪 Testing PDF generation with sample data...');
    
    // Generar PDF con los datos de prueba
    const result = await generatePdfWithApiTemplate(testMindeeData);
    
    return NextResponse.json({
      success: result.success,
      message: result.success ? 'PDF de prueba generado exitosamente' : 'Error generando PDF de prueba',
      data: result.data,
      error: result.error,
      test_data: testMindeeData,
      complete_json_variables: result.data?.template_data || null
    });

  } catch (error) {
    console.error('Test PDF error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Error en el endpoint de prueba'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Endpoint de prueba para APITemplate.io',
    instructions: 'Usa POST para generar un PDF de prueba',
    variables_available: [
      // Información del proveedor
      'supplier', 'supplier_details', 'supplier_cif', 'supplier_phone', 'supplier_email',
      
      // Información del cliente (empresa del usuario)
      'customer_name', 'customer_details', 'customer_cif', 'customer_address', 'customer_phone', 'customer_email',
      
      // Fechas
      'date', 'due_date', 'current_date',
      
      // Información financiera
      'currency', 'total_amount', 'total_net', 'total_tax',
      
      // Información de impuestos
      'tax_rate', 'tax_base', 'tax_amount',
      
      // Documento
      'invoice_number', 'document_type',
      
      // Dirección
      'city', 'adress',
      
      // Items y pago
      'line_items', 'payment_method'
    ],
    variable_structure: {
      provider: {
        main: 'supplier',
        details: 'supplier_details (combinado: cif | telefono | email)',
        individual: ['supplier_cif', 'supplier_phone', 'supplier_email']
      },
      customer: {
        main: 'customer_name',
        details: 'customer_details (combinado: cif | telefono | email)',
        individual: ['customer_cif', 'customer_phone', 'customer_email', 'customer_address']
      }
    }
  });
} 