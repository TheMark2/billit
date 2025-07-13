import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from '@/utils/encryption';

const MINDEE_API_KEY = '1d6ac579ba024d9fb6c0ebcffdf2b5a0';
const MINDEE_API_URL = 'https://api.mindee.net/v1/products/mindee/invoices/v4/predict';

// APITemplate.io Configuration
const APITEMPLATE_API_KEY = process.env.APITEMPLATE_API_KEY || 'bb6eMzI4MDY6Mjk5ODU6NWs4YmhqZ2NGC1ZjUDlNRg=';
const APITEMPLATE_TEMPLATE_ID = process.env.APITEMPLATE_TEMPLATE_ID || '20877b23684b10a8';
const APITEMPLATE_API_URL = 'https://rest.apitemplate.io/v2/create-pdf';

// Función para crear un evento SSE
function createSSEEvent(data: any, event?: string): string {
  const eventData = `data: ${JSON.stringify(data)}\n\n`;
  return event ? `event: ${event}\n${eventData}` : eventData;
}

// Función para procesar con progreso
async function processWithProgress(file: File, userId: string, controller: ReadableStreamDefaultController<any>) {
  const encoder = new TextEncoder();
  
  try {
    // Paso 1: Iniciando procesamiento (10%)
    controller.enqueue(encoder.encode(createSSEEvent({
      progress: 10,
      message: 'Iniciando procesamiento de la factura...',
      stage: 'init'
    })));

    // Paso 2: Obtener credenciales y procesar con Mindee (30%)
    controller.enqueue(encoder.encode(createSSEEvent({
      progress: 30,
      message: 'Extrayendo datos de la factura con IA...',
      stage: 'mindee'
    })));

    const [mindeeResult, allCredentials] = await Promise.all([
      processWithMindee(file),
      getAllCredentials(userId)
    ]);
    
    if (!mindeeResult.success) {
      controller.enqueue(encoder.encode(createSSEEvent({
        progress: 0,
        message: `Error procesando factura: ${mindeeResult.error}`,
        stage: 'error',
        error: mindeeResult.error
      })));
      return null;
    }

    // Paso 3: Preparando integraciones (50%)
    controller.enqueue(encoder.encode(createSSEEvent({
      progress: 50,
      message: 'Preparando integraciones con tus sistemas...',
      stage: 'integrations_prep'
    })));

    // Paso 4: Ejecutando integraciones (70%)
    controller.enqueue(encoder.encode(createSSEEvent({
      progress: 70,
      message: 'Sincronizando con tus sistemas de gestión...',
      stage: 'integrations_exec'
    })));

    // Ejecutar integraciones en paralelo
    const integrationPromises = [];
    
    integrationPromises.push(
      generatePdfWithApiTemplate(mindeeResult.data, userId)
        .then(result => ({ type: 'pdf', result }))
        .catch(error => ({ type: 'pdf', result: { success: false, error: error.message } }))
    );

    if (allCredentials.odoo) {
      integrationPromises.push(
        sendToOdoo(mindeeResult.data, allCredentials.odoo)
          .then(result => ({ type: 'odoo', result }))
          .catch(error => ({ type: 'odoo', result: { success: false, error: error.message } }))
      );
    }

    if (allCredentials.holded) {
      integrationPromises.push(
        sendToHolded(mindeeResult.data, allCredentials.holded)
          .then(result => ({ type: 'holded', result }))
          .catch(error => ({ type: 'holded', result: { success: false, error: error.message } }))
      );
    }

    const integrationResults = await Promise.all(integrationPromises);

    // Paso 5: Guardando en base de datos (90%)
    controller.enqueue(encoder.encode(createSSEEvent({
      progress: 90,
      message: 'Guardando datos en la base de datos...',
      stage: 'database'
    })));

    // Procesar resultados
    let pdfResult: { success: boolean; data?: any; error?: string } = { success: false, error: 'PDF generation not executed' };
    let odooResult: any = null;
    let holdedResult: any = null;

    for (const integration of integrationResults) {
      switch (integration.type) {
        case 'pdf':
          pdfResult = integration.result;
          break;
        case 'odoo':
          odooResult = integration.result;
          break;
        case 'holded':
          holdedResult = integration.result;
          break;
      }
    }

    // Determinar estado
    let estadoFinal = 'pendiente';
    let integrationStatus = 'not_configured';
    
    if ((allCredentials.odoo && odooResult?.success) || (allCredentials.holded && holdedResult?.success)) {
      estadoFinal = 'synced';
      integrationStatus = 'success';
    } else if ((allCredentials.odoo && !odooResult?.success) || (allCredentials.holded && !holdedResult?.success)) {
      estadoFinal = 'error';
      integrationStatus = 'failed';
    } else if (allCredentials.odoo || allCredentials.holded) {
      integrationStatus = 'partial';
    }

    return {
      mindeeResult,
      allCredentials,
      pdfResult,
      odooResult,
      holdedResult,
      estadoFinal,
      integrationStatus
    };

  } catch (error) {
    controller.enqueue(encoder.encode(createSSEEvent({
      progress: 0,
      message: `Error durante el procesamiento: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      stage: 'error',
      error: error instanceof Error ? error.message : 'Error desconocido'
    })));
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar si es una petición de streaming
    const acceptHeader = request.headers.get('accept');
    const isStreaming = acceptHeader?.includes('text/event-stream');

    // Obtener el token de autorización del header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Upload: No authorization header found');
      return NextResponse.json(
        { error: 'Unauthorized - Missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Crear cliente de Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Upload: Authentication error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Obtener archivo
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Si es streaming, usar Server-Sent Events
    if (isStreaming) {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          
          try {
            const result = await processWithProgress(file, user.id, controller);
            
            if (!result) {
              controller.close();
              return;
            }

            // Guardar en base de datos
            const { data: receiptData, error: dbError } = await supabase
              .from('receipts')
              .insert({
                user_id: user.id,
                fecha_emision: result.mindeeResult.data.date || new Date().toISOString().split('T')[0],
                fecha_subida: new Date().toISOString().split('T')[0],
                proveedor: result.mindeeResult.data.supplier_name || 'Proveedor no identificado',
                numero_factura: result.mindeeResult.data.invoice_number || `AUTO-${Date.now()}`,
                total: result.mindeeResult.data.total_amount || 0,
                moneda: result.mindeeResult.data.currency || 'EUR',
                estado: result.estadoFinal,
                url_archivo: file.name,
                texto_extraido: JSON.stringify(result.mindeeResult.data),
                metadatos: {
                  mindee_data: result.mindeeResult.data,
                  pdf_generation: result.pdfResult.success ? (result.pdfResult as any).data : { error: (result.pdfResult as any).error || 'PDF generation failed' },
                  odoo_integration: result.odooResult,
                  holded_integration: result.holdedResult,
                  file_size: file.size,
                  processed_at: new Date().toISOString(),
                  integration_status: result.integrationStatus,
                  integrations_summary: {
                    odoo: result.allCredentials.odoo ? (result.odooResult?.success ? 'success' : 'failed') : 'not_configured',
                    holded: result.allCredentials.holded ? (result.holdedResult?.success ? 'success' : 'failed') : 'not_configured',
                    pdf: result.pdfResult.success ? 'success' : 'failed'
                  }
                }
              })
              .select()
              .single();

            if (dbError) {
              controller.enqueue(encoder.encode(createSSEEvent({
                progress: 0,
                message: 'Error guardando en base de datos',
                stage: 'error',
                error: dbError.message
              })));
            } else {
              // Completado (100%)
              controller.enqueue(encoder.encode(createSSEEvent({
                progress: 100,
                message: 'Factura procesada correctamente',
                stage: 'completed',
                data: {
                  receipt_id: receiptData.id,
                  integrations: {
                    odoo: result.allCredentials.odoo ? (result.odooResult?.success ? 'success' : 'failed') : 'not_configured',
                    holded: result.allCredentials.holded ? (result.holdedResult?.success ? 'success' : 'failed') : 'not_configured',
                    pdf: result.pdfResult.success ? 'success' : 'failed'
                  }
                }
              })));
            }

            controller.close();
          } catch (error) {
            controller.enqueue(encoder.encode(createSSEEvent({
              progress: 0,
              message: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`,
              stage: 'error',
              error: error instanceof Error ? error.message : 'Error desconocido'
            })));
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
        },
      });
    }

    // Procesamiento normal sin streaming (para compatibilidad)
    console.log('Upload: Processing file:', file.name, 'Size:', file.size);

    const [mindeeResult, allCredentials] = await Promise.all([
      processWithMindee(file),
      getAllCredentials(user.id)
    ]);
    
    if (!mindeeResult.success) {
      console.error('Mindee processing failed:', mindeeResult.error);
      return NextResponse.json(
        { error: `Error procesando factura: ${mindeeResult.error}` },
        { status: 400 }
      );
    }

    console.log('Mindee processing successful and credentials loaded');

    // Ejecutar integraciones en paralelo
    const integrationPromises = [];
    
    integrationPromises.push(
      generatePdfWithApiTemplate(mindeeResult.data, user.id)
        .then(result => ({ type: 'pdf', result }))
        .catch(error => ({ type: 'pdf', result: { success: false, error: error.message } }))
    );

    if (allCredentials.odoo) {
      console.log('User has Odoo configured, sending to Odoo...');
      integrationPromises.push(
        sendToOdoo(mindeeResult.data, allCredentials.odoo)
          .then(result => ({ type: 'odoo', result }))
          .catch(error => ({ type: 'odoo', result: { success: false, error: error.message } }))
      );
    }

    if (allCredentials.holded) {
      console.log('User has Holded configured, sending to Holded...');
      integrationPromises.push(
        sendToHolded(mindeeResult.data, allCredentials.holded)
          .then(result => ({ type: 'holded', result }))
          .catch(error => ({ type: 'holded', result: { success: false, error: error.message } }))
      );
    }

    const integrationResults = await Promise.all(integrationPromises);

    // Procesar resultados
    let pdfResult: { success: boolean; data?: any; error?: string } = { success: false, error: 'PDF generation not executed' };
    let odooResult: any = null;
    let holdedResult: any = null;

    for (const integration of integrationResults) {
      switch (integration.type) {
        case 'pdf':
          pdfResult = integration.result;
          break;
        case 'odoo':
          odooResult = integration.result;
          break;
        case 'holded':
          holdedResult = integration.result;
          break;
      }
    }

    // Determinar estado
    let estadoFinal = 'pendiente';
    let integrationStatus = 'not_configured';
    
    if ((allCredentials.odoo && odooResult?.success) || (allCredentials.holded && holdedResult?.success)) {
      estadoFinal = 'synced';
      integrationStatus = 'success';
    } else if ((allCredentials.odoo && !odooResult?.success) || (allCredentials.holded && !holdedResult?.success)) {
      estadoFinal = 'error';
      integrationStatus = 'failed';
    } else if (allCredentials.odoo || allCredentials.holded) {
      integrationStatus = 'partial';
    }

    // Guardar en base de datos
    const { data: receiptData, error: dbError } = await supabase
      .from('receipts')
      .insert({
        user_id: user.id,
        fecha_emision: mindeeResult.data.date || new Date().toISOString().split('T')[0],
        fecha_subida: new Date().toISOString().split('T')[0],
        proveedor: mindeeResult.data.supplier_name || 'Proveedor no identificado',
        numero_factura: mindeeResult.data.invoice_number || `AUTO-${Date.now()}`,
        total: mindeeResult.data.total_amount || 0,
        moneda: mindeeResult.data.currency || 'EUR',
        estado: estadoFinal,
        url_archivo: file.name,
        texto_extraido: JSON.stringify(mindeeResult.data),
        metadatos: {
          mindee_data: mindeeResult.data,
          pdf_generation: pdfResult.success ? (pdfResult as any).data : { error: (pdfResult as any).error || 'PDF generation failed' },
          odoo_integration: odooResult,
          holded_integration: holdedResult,
          file_size: file.size,
          processed_at: new Date().toISOString(),
          integration_status: integrationStatus,
          integrations_summary: {
            odoo: allCredentials.odoo ? (odooResult?.success ? 'success' : 'failed') : 'not_configured',
            holded: allCredentials.holded ? (holdedResult?.success ? 'success' : 'failed') : 'not_configured',
            pdf: pdfResult.success ? 'success' : 'failed'
          }
        }
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Error saving to database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Factura procesada correctamente',
      data: {
        receipt_id: receiptData.id,
        mindee_data: mindeeResult.data,
        pdf_generation: pdfResult.success ? (pdfResult as any).data : { error: (pdfResult as any).error || 'PDF generation failed' },
        integrations: {
          odoo: allCredentials.odoo ? (odooResult?.success ? 'success' : 'failed') : 'not_configured',
          holded: allCredentials.holded ? (holdedResult?.success ? 'success' : 'failed') : 'not_configured',
          pdf: pdfResult.success ? 'success' : 'failed'
        },
        odoo_result: odooResult,
        holded_result: holdedResult
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Función para procesar factura con Mindee
export async function processWithMindee(file: File): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const formData = new FormData();
    formData.append('document', file);

    const response = await fetch(MINDEE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${MINDEE_API_KEY}`,
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mindee API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    if (result.document && result.document.inference) {
      const prediction = result.document.inference.prediction;
      
      return {
        success: true,
        data: {
          supplier_name: prediction.supplier_name?.value || null,
          supplier_company_registrations: prediction.supplier_company_registrations || [],
          supplier_address: prediction.supplier_address?.value || null,
          customer_name: prediction.customer_name?.value || null,
          customer_company_registrations: prediction.customer_company_registrations || [],
          customer_address: prediction.customer_address?.value || null,
          document_type: prediction.document_type?.value || null,
          invoice_number: prediction.invoice_number?.value || null,
          reference_numbers: prediction.reference_numbers || [],
          date: prediction.date?.value || null,
          due_date: prediction.due_date?.value || null,
          locale: prediction.locale?.value || null,
          currency: prediction.currency?.value || null,
          total_net: prediction.total_net?.value || null,
          total_amount: prediction.total_amount?.value || null,
          total_tax: prediction.total_tax?.value || null,
          taxes: prediction.taxes || [],
          line_items: prediction.line_items || [],
          payment_details: prediction.payment_details || [],
          raw_mindee_response: result
        }
      };
    } else {
      throw new Error('Invalid response from Mindee API');
    }

  } catch (error) {
    console.error('Mindee processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Función para generar PDF con APITemplate.io
export async function generatePdfWithApiTemplate(mindeeData: any, userId?: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    console.log('🔄 Starting PDF generation with APITemplate.io...');
    console.log('📥 Mindee data received:', JSON.stringify(mindeeData, null, 2));
    
    // Obtener información de la empresa del usuario si se proporciona userId
    let companyInfo = {
      nombre_fiscal: 'Tu Empresa',
      cif: '',
      direccion: '',
      email_facturacion: '',
      telefono: ''
    };

    if (userId) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Obtener información de la empresa del usuario
        const { data: profile } = await supabase
          .from('profiles')
          .select('empresa_id')
          .eq('id', userId)
          .single();

        if (profile?.empresa_id) {
          const { data: empresa } = await supabase
            .from('empresas')
            .select('nombre_fiscal, cif, direccion, email_facturacion, telefono')
            .eq('id', profile.empresa_id)
            .single();

          if (empresa) {
            companyInfo = empresa;
          }
        }
      } catch (error) {
        console.error('Error fetching company info:', error);
        // Continuar con valores por defecto si hay error
      }
    }
    
    // Extraer información del proveedor
    const supplierRegistration = mindeeData.supplier_company_registrations?.[0]?.value || '';
    const supplierPhone = mindeeData.supplier_phone_number?.value || '';
    const supplierEmail = mindeeData.supplier_email?.value || '';
    const taxInfo = mindeeData.taxes?.[0] || {};
    
    // Mapear los datos con variables estructuradas (sin emojis)
    const templateData = {
      // Información del proveedor - nombre con variables al lado
      supplier: mindeeData.supplier_name || 'Proveedor no identificado',
      supplier_details: `${supplierRegistration}${supplierPhone ? ' | ' + supplierPhone : ''}${supplierEmail ? ' | ' + supplierEmail : ''}`.trim(),
      supplier_cif: supplierRegistration,
      supplier_phone: supplierPhone,
      supplier_email: supplierEmail,
      
      // Información del cliente (empresa del usuario) - nombre con variables al lado
      customer_name: companyInfo.nombre_fiscal,
      customer_details: `${companyInfo.cif}${companyInfo.telefono ? ' | ' + companyInfo.telefono : ''}${companyInfo.email_facturacion ? ' | ' + companyInfo.email_facturacion : ''}`.trim(),
      customer_cif: companyInfo.cif,
      customer_address: companyInfo.direccion || '',
      customer_phone: companyInfo.telefono || '',
      customer_email: companyInfo.email_facturacion || '',
      
      // Fechas
      date: mindeeData.date || new Date().toISOString().split('T')[0],
      due_date: mindeeData.due_date?.value || null,
      current_date: new Date().toLocaleDateString('es-ES'),
      
      // Información financiera
      currency: mindeeData.currency || 'EUR',
      total_amount: mindeeData.total_amount || 0,
      total_net: mindeeData.total_net || 0,
      total_tax: mindeeData.total_tax || 0,
      
      // Información de impuestos
      tax_rate: taxInfo.rate || 0,
      tax_base: taxInfo.base || 0,
      tax_amount: taxInfo.value || 0,
      
      // Documento
      invoice_number: mindeeData.invoice_number || `AUTO-${Date.now()}`,
      document_type: mindeeData.document_type?.value || 'invoice',
      
      // Dirección del proveedor
      city: extractCityFromAddress(mindeeData.supplier_address),
      adress: mindeeData.supplier_address || 'Dirección no disponible',
      
      // Items
      line_items: mapLineItems(mindeeData.line_items || []),
      
      // Información de pago
      payment_method: extractPaymentMethod(mindeeData.payment_details || [])
    };

    console.log('📊 Template data prepared:', JSON.stringify(templateData, null, 2));

    // Verificar que tenemos las credenciales necesarias
    if (!APITEMPLATE_API_KEY || !APITEMPLATE_TEMPLATE_ID) {
      throw new Error('APITemplate.io credentials not configured. Check APITEMPLATE_API_KEY and APITEMPLATE_TEMPLATE_ID environment variables.');
    }

    console.log('🔑 Using API Key:', APITEMPLATE_API_KEY.substring(0, 10) + '...');
    console.log('📋 Using Template ID:', APITEMPLATE_TEMPLATE_ID);

    console.log('🔑 Final template data prepared:', Object.keys(templateData));
    console.log('🔑 Template ID to use:', APITEMPLATE_TEMPLATE_ID);

    // Formato correcto: Template ID como parámetro URL
    const apiUrl = `${APITEMPLATE_API_URL}?template_id=${APITEMPLATE_TEMPLATE_ID}`;

    console.log('📦 API request structure:');
    console.log('📦 - URL:', apiUrl);
    console.log('📦 - Data keys:', Object.keys(templateData));
    console.log('📦 - Sample data:', {
      supplier: templateData.supplier,
      customer_name: templateData.customer_name,
      date: templateData.date,
      total_amount: templateData.total_amount
    })

    // Llamar a la API de APITemplate.io
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': APITEMPLATE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templateData)
    });

    console.log('📡 APITemplate response status:', response.status);
    console.log('📡 APITemplate response headers:', response.headers.get('content-type'));

    const responseText = await response.text();
    console.log('📡 APITemplate raw response:', responseText.substring(0, 500) + '...');

    if (!response.ok) {
      console.error('❌ APITemplate API error:', response.status, responseText);
      throw new Error(`APITemplate API error: ${response.status} - ${responseText}`);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse APITemplate response:', parseError);
      throw new Error(`Invalid JSON response from APITemplate: ${responseText.substring(0, 200)}`);
    }

    console.log('✅ PDF generated successfully:', result);

    return {
      success: true,
      data: {
        download_url: result.download_url,
        pdf_url: result.pdf_url || result.download_url,
        template_id: APITEMPLATE_TEMPLATE_ID,
        generated_at: new Date().toISOString(),
        template_data: templateData,
        api_response: result
      }
    };

  } catch (error) {
    console.error('❌ Error generating PDF with APITemplate.io:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Función auxiliar para extraer la ciudad de la dirección
function extractCityFromAddress(address: string | null): string {
  if (!address) return 'Ciudad no disponible';
  
  // Buscar patrones comunes de ciudades en España
  const cityPatterns = [
    /([A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+)(?:,|\s+\d{5}|\s+[A-Z]{2})/,
    /([A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+)$/
  ];
  
  for (const pattern of cityPatterns) {
    const match = address.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return address.split(',')[0].trim() || 'Ciudad no disponible';
}

// Función auxiliar para mapear los items de línea
function mapLineItems(lineItems: any[]): any[] {
  if (!lineItems || lineItems.length === 0) {
    return [{
      description: 'Producto/Servicio no especificado',
      quantity: 1,
      unit_price: 0,
      total: 0
    }];
  }

  return lineItems.map(item => ({
    description: item.description || 'Producto/Servicio',
    quantity: parseFloat(item.quantity) || 1,
    unit_price: parseFloat(item.unit_price) || 0,
    total: parseFloat(item.total_amount) || 0
  }));
}

// Función auxiliar para extraer información de pago
function extractPaymentMethod(paymentDetails: any[]): string {
  if (!paymentDetails || paymentDetails.length === 0) {
    return 'Efectivo';
  }
  
  // Buscar métodos de pago comunes
  for (const detail of paymentDetails) {
    const paymentInfo = detail.payment_method?.toLowerCase() || '';
    const accountInfo = detail.account_number || '';
    
    if (paymentInfo.includes('card') || paymentInfo.includes('tarjeta')) {
      return 'Tarjeta de crédito/débito';
    } else if (paymentInfo.includes('transfer') || paymentInfo.includes('transfer') || accountInfo) {
      return 'Transferencia bancaria';
    } else if (paymentInfo.includes('cash') || paymentInfo.includes('efectivo')) {
      return 'Efectivo';
    }
  }
  
  return 'No especificado';
}

// OPTIMIZACIÓN: Función para obtener todas las credenciales en paralelo
export async function getAllCredentials(userId: string): Promise<{
  odoo: any | null;
  holded: any | null;
}> {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Ejecutar consultas en paralelo
    const [odooData, holdedData] = await Promise.all([
      supabaseAdmin
        .from('odoo_credentials')
        .select('url, database, username, password')
        .eq('user_id', userId)
        .single()
        .then(({ data, error }) => error ? null : data),
      supabaseAdmin
        .from('holded_credentials')
        .select('api_key, test_mode')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()
        .then(({ data, error }) => error ? null : data)
    ]);

    // Procesar credenciales
    let odooCredentials = null;
    let holdedCredentials = null;

    if (odooData) {
      try {
        odooCredentials = {
          url: decrypt(odooData.url),
          database: decrypt(odooData.database),
          username: decrypt(odooData.username),
          password: decrypt(odooData.password)
        };
      } catch (error) {
        console.error('Error decrypting Odoo credentials:', error);
      }
    }

    if (holdedData) {
      try {
        holdedCredentials = {
          api_key: decrypt(holdedData.api_key),
          test_mode: holdedData.test_mode
        };
      } catch (error) {
        console.error('Error decrypting Holded credentials:', error);
      }
    }

    return {
      odoo: odooCredentials,
      holded: holdedCredentials
    };

  } catch (error) {
    console.error('Error getting credentials:', error);
    return {
      odoo: null,
      holded: null
    };
  }
}

// Función optimizada para enviar datos a Holded
export async function sendToHolded(mindeeData: any, credentials: any): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    console.log('Starting optimized Holded integration...');
    
    // Configurar timeout para evitar bloqueos
    const TIMEOUT_MS = 25000; // 25 segundos
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    // Limpiar timeout al finalizar
    const cleanup = () => clearTimeout(timeoutId);

    try {
      // URL base de Holded
      const baseUrl = 'https://api.holded.com/api';

      // Preparar los items de la factura de forma optimizada
      const items = [];
      
      if (mindeeData.line_items && mindeeData.line_items.length > 0) {
        // Usar los items específicos de la factura
        for (const item of mindeeData.line_items) {
          const quantity = parseFloat(item.quantity) || 1;
          const unitPrice = parseFloat(item.unit_price) || (parseFloat(item.total_amount) / quantity) || 0;
          
          items.push({
            name: item.description || 'Producto/Servicio',
            quantity: quantity,
            price_unit: unitPrice
          });
        }
      } else {
        // Si no hay items específicos, crear uno con el total
        const totalAmount = parseFloat(mindeeData.total_net) || parseFloat(mindeeData.total_amount) || 0;
        items.push({
          name: `Factura de compra - ${mindeeData.supplier_name || 'Proveedor'}`,
          quantity: 1,
          price_unit: totalAmount
        });
      }

      // Preparar los datos para Holded de forma optimizada
      const holdedInvoiceData = {
        // Información del contacto/proveedor
        contactName: mindeeData.supplier_name || 'Proveedor no identificado',
        contactCode: mindeeData.supplier_company_registrations?.[0]?.value || '', 
        contactEmail: '',
        contactAddress: mindeeData.supplier_address || '',
        
        // Información de la factura
        date: mindeeData.date ? Math.floor(new Date(mindeeData.date).getTime() / 1000) : Math.floor(Date.now() / 1000),
        ref: mindeeData.invoice_number || `ReciptAI-${Date.now()}`,
        currency: mindeeData.currency || 'EUR',
        notes: `Factura procesada automáticamente por ReciptAI\nProveedor: ${mindeeData.supplier_name || 'N/A'}\nTotal: ${mindeeData.total_amount || 0} ${mindeeData.currency || 'EUR'}`,
        
        // Configuración para recibo de compra
        isReceipt: true,
        approveDoc: true,
        applyContactDefaults: true,
        
        // Items de la factura
        items: items
      };

      console.log('Sending optimized data to Holded...');

      // Crear factura en Holded con timeout
      const holdedResponse = await fetch(`${baseUrl}/invoicing/v1/receipts`, {
        method: 'POST',
        headers: {
          'Key': credentials.api_key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(holdedInvoiceData),
        signal: controller.signal
      });

      cleanup();

      if (!holdedResponse.ok) {
        const errorText = await holdedResponse.text();
        console.error('Holded API error:', holdedResponse.status, errorText);
        
        let errorMessage = `Error ${holdedResponse.status}`;
        
        if (holdedResponse.status === 401) {
          errorMessage = 'API Key inválida - Verifica tus credenciales de Holded';
        } else if (holdedResponse.status === 403) {
          errorMessage = 'Acceso denegado - Verifica los permisos de tu API Key';
        } else if (holdedResponse.status === 429) {
          errorMessage = 'Límite de API excedido - Intenta nuevamente más tarde';
        } else if (holdedResponse.status >= 500) {
          errorMessage = 'Error del servidor de Holded - Intenta nuevamente más tarde';
        } else if (errorText) {
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorText;
          } catch {
            errorMessage = errorText;
          }
        }
        
        throw new Error(errorMessage);
      }

      const holdedResult = await holdedResponse.json();
      console.log('Holded response received successfully');

      // Verificar que la respuesta sea válida
      if (holdedResult && (holdedResult.id || holdedResult.status === 'created')) {
        return {
          success: true,
          data: {
            holded_receipt_id: holdedResult.id || holdedResult.receiptId,
            holded_status: holdedResult.status,
            total_amount: mindeeData.total_amount,
            currency: mindeeData.currency,
            message: `Recibo creado exitosamente en Holded (ID: ${holdedResult.id || holdedResult.receiptId})`
          }
        };
      } else {
        console.error('Unexpected response from Holded:', holdedResult);
        throw new Error('Respuesta inesperada de Holded - La factura pudo no haberse creado correctamente');
      }

    } catch (error) {
      cleanup();
      throw error;
    }

  } catch (error) {
    console.error('Error optimized Holded integration:', error);
    
    let errorMessage = 'Error desconocido en Holded';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Timeout conectando con Holded - El servidor no respondió a tiempo';
      } else if (error.message.includes('API Key')) {
        errorMessage = 'Error de API Key con Holded - Verifica tus credenciales';
      } else if (error.message.includes('conexión')) {
        errorMessage = 'Error de conexión con Holded - Verifica tu conexión a internet';
      } else {
        errorMessage = error.message;
      }
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

// Función para categorizar gastos y determinar cuenta contable
function categorizeExpense(supplierName: string, lineItems: any[]): {
  category: string;
  accountCode: string;
  accountName: string;
} {
  const supplier = (supplierName || '').toLowerCase();
  const items = lineItems.map(item => (item.description || '').toLowerCase()).join(' ');
  const allText = `${supplier} ${items}`;

  // Restaurantes, bares, comidas
  if (allText.match(/(restaurante?|bar|cafe|cafeteria|comida|cena|almuerzo|desayuno|fritos|patatas|callos|copa|cerveza|vino|bebida|tapas|menu)/i)) {
    return {
      category: 'restaurant',
      accountCode: '627000',
      accountName: 'Gastos de representación - Comidas y bebidas'
    };
  }

  // Gasolina, combustible
  if (allText.match(/(gasolina|combustible|repsol|cepsa|bp|shell|estacion|servicio|diesel|petroleo)/i)) {
    return {
      category: 'fuel',
      accountCode: '628100',
      accountName: 'Gastos de combustible'
    };
  }

  // Material de oficina
  if (allText.match(/(papel|boligrafo|lapiz|carpeta|archivador|tinta|impresora|oficina|material|suministro)/i)) {
    return {
      category: 'office',
      accountCode: '629000',
      accountName: 'Material de oficina'
    };
  }

  // Servicios profesionales
  if (allText.match(/(consultoria|asesoria|abogado|gestor|notario|servicio|profesional|honorarios)/i)) {
    return {
      category: 'professional',
      accountCode: '623000',
      accountName: 'Servicios de profesionales independientes'
    };
  }

  // Telecomunicaciones
  if (allText.match(/(telefono|internet|movil|telefonica|vodafone|orange|telecomunicacion)/i)) {
    return {
      category: 'telecom',
      accountCode: '629200',
      accountName: 'Gastos de telecomunicaciones'
    };
  }

  // Default: Otros gastos de explotación
  return {
    category: 'other',
    accountCode: '629900',
    accountName: 'Otros gastos de explotación'
  };
}

// Función para buscar el ID del impuesto en Odoo
async function findTaxId(rate: number, credentials: any, odooUserId: string): Promise<number | null> {
  try {
    const searchTaxXml = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${credentials.database}</string></value></param>
    <param><value><int>${odooUserId}</int></value></param>
    <param><value><string>${credentials.password}</string></value></param>
    <param><value><string>account.tax</string></value></param>
    <param><value><string>search</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value>
              <array>
                <data>
                  <value>
                    <array>
                      <data>
                        <value><string>amount</string></value>
                        <value><string>=</string></value>
                        <value><double>${rate}</double></value>
                      </data>
                    </array>
                  </value>
                  <value>
                    <array>
                      <data>
                        <value><string>type_tax_use</string></value>
                        <value><string>=</string></value>
                        <value><string>purchase</string></value>
                      </data>
                    </array>
                  </value>
                </data>
              </array>
            </value>
          </data>
        </array>
      </value>
    </param>
    <param>
      <value>
        <struct>
          <member>
            <name>limit</name>
            <value><int>1</int></value>
          </member>
        </struct>
      </value>
    </param>
  </params>
</methodCall>`;

    const taxResponse = await fetch(`${credentials.url}/xmlrpc/2/object`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
      body: searchTaxXml
    });

    if (taxResponse.ok) {
      const taxText = await taxResponse.text();
      const taxIdMatch = taxText.match(/<(?:int|i4)>(\d+)<\/(?:int|i4)>/);
      if (taxIdMatch) {
        return parseInt(taxIdMatch[1]);
      }
    }
    return null;
  } catch (error) {
    console.error(`Error finding tax with rate ${rate}:`, error);
    return null;
  }
}

// Función optimizada para enviar datos a Odoo
export async function sendToOdoo(mindeeData: any, credentials: any): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    console.log('Starting optimized Odoo integration...');
    
    // Configurar timeout más corto para evitar bloqueos
    const TIMEOUT_MS = 30000; // 30 segundos
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    // Limpiar timeout al finalizar
    const cleanup = () => clearTimeout(timeoutId);

    try {
      // 1. Autenticar con Odoo de forma optimizada
      const authenticateXml = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>${credentials.database}</string></value></param>
    <param><value><string>${credentials.username}</string></value></param>
    <param><value><string>${credentials.password}</string></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>`;

      const authResponse = await fetch(`${credentials.url}/xmlrpc/2/common`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        body: authenticateXml,
        signal: controller.signal
      });

      if (!authResponse.ok) {
        throw new Error(`Error de autenticación: ${authResponse.status}`);
      }

      const authText = await authResponse.text();
      const userIdMatch = authText.match(/<(?:int|i4)>(\d+)<\/(?:int|i4)>/);
      
      if (!userIdMatch) {
        throw new Error('Credenciales de Odoo inválidas');
      }

      const odooUserId = userIdMatch[1];

      // 2. Buscar o crear proveedor optimizado
      let partnerId = null;
      
      // Buscar proveedor existente
      const searchPartnerXml = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${credentials.database}</string></value></param>
    <param><value><int>${odooUserId}</int></value></param>
    <param><value><string>${credentials.password}</string></value></param>
    <param><value><string>res.partner</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value>
              <array>
                <data>
                  <value>
                    <array>
                      <data>
                        <value><string>name</string></value>
                        <value><string>ilike</string></value>
                        <value><string>${mindeeData.supplier_name}</string></value>
                      </data>
                    </array>
                  </value>
                </data>
              </array>
            </value>
          </data>
        </array>
      </value>
    </param>
    <param>
      <value>
        <struct>
          <member>
            <name>fields</name>
            <value>
              <array>
                <data>
                  <value><string>id</string></value>
                  <value><string>name</string></value>
                </data>
              </array>
            </value>
          </member>
          <member>
            <name>limit</name>
            <value><int>1</int></value>
          </member>
        </struct>
      </value>
    </param>
  </params>
</methodCall>`;

      const searchResponse = await fetch(`${credentials.url}/xmlrpc/2/object`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        body: searchPartnerXml,
        signal: controller.signal
      });

      if (searchResponse.ok) {
        const searchText = await searchResponse.text();
        const partnerIdMatch = searchText.match(/<(?:int|i4)>(\d+)<\/(?:int|i4)>/);
        
        if (partnerIdMatch) {
          partnerId = parseInt(partnerIdMatch[1]);
        }
      }

      // Crear proveedor si no existe
      if (!partnerId) {
        const createPartnerXml = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${credentials.database}</string></value></param>
    <param><value><int>${odooUserId}</int></value></param>
    <param><value><string>${credentials.password}</string></value></param>
    <param><value><string>res.partner</string></value></param>
    <param><value><string>create</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value>
              <struct>
                <member>
                  <name>name</name>
                  <value><string>${mindeeData.supplier_name || 'Proveedor desconocido'}</string></value>
                </member>
                <member>
                  <name>is_company</name>
                  <value><boolean>1</boolean></value>
                </member>
                <member>
                  <name>supplier_rank</name>
                  <value><int>1</int></value>
                </member>
                ${mindeeData.supplier_company_registrations?.[0]?.value ? `
                <member>
                  <name>vat</name>
                  <value><string>${mindeeData.supplier_company_registrations[0].value}</string></value>
                </member>` : ''}
                ${mindeeData.supplier_address ? `
                <member>
                  <name>street</name>
                  <value><string>${mindeeData.supplier_address}</string></value>
                </member>` : ''}
              </struct>
            </value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`;

        const createResponse = await fetch(`${credentials.url}/xmlrpc/2/object`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml; charset=utf-8' },
          body: createPartnerXml,
          signal: controller.signal
        });

        if (createResponse.ok) {
          const createText = await createResponse.text();
          const newPartnerIdMatch = createText.match(/<(?:int|i4)>(\d+)<\/(?:int|i4)>/);
          
          if (newPartnerIdMatch) {
            partnerId = parseInt(newPartnerIdMatch[1]);
          }
        }
      }

      if (!partnerId) {
        throw new Error('No se pudo crear o encontrar el proveedor en Odoo');
      }

      // 3. Crear factura optimizada con líneas integradas
      const totalAmount = parseFloat(mindeeData.total_net) || parseFloat(mindeeData.total_amount) || 0;
      
      const invoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${credentials.database}</string></value></param>
    <param><value><int>${odooUserId}</int></value></param>
    <param><value><string>${credentials.password}</string></value></param>
    <param><value><string>account.move</string></value></param>
    <param><value><string>create</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value>
              <struct>
                <member>
                  <name>move_type</name>
                  <value><string>in_invoice</string></value>
                </member>
                <member>
                  <name>partner_id</name>
                  <value><int>${partnerId}</int></value>
                </member>
                <member>
                  <name>ref</name>
                  <value><string>${mindeeData.invoice_number || 'AUTO-' + Date.now()}</string></value>
                </member>
                <member>
                  <name>invoice_date</name>
                  <value><string>${mindeeData.date || new Date().toISOString().split('T')[0]}</string></value>
                </member>
                <member>
                  <name>invoice_line_ids</name>
                  <value>
                    <array>
                      <data>
                        <value>
                          <array>
                            <data>
                              <value><int>0</int></value>
                              <value><int>0</int></value>
                              <value>
                                <struct>
                                  <member>
                                    <name>name</name>
                                    <value><string>Factura de compra - ${mindeeData.supplier_name || 'Proveedor'}</string></value>
                                  </member>
                                  <member>
                                    <name>quantity</name>
                                    <value><double>1</double></value>
                                  </member>
                                  <member>
                                    <name>price_unit</name>
                                    <value><double>${totalAmount}</double></value>
                                  </member>
                                </struct>
                              </value>
                            </data>
                          </array>
                        </value>
                      </data>
                    </array>
                  </value>
                </member>
              </struct>
            </value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`;

      const invoiceResponse = await fetch(`${credentials.url}/xmlrpc/2/object`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        body: invoiceXml,
        signal: controller.signal
      });

      cleanup();

      if (!invoiceResponse.ok) {
        throw new Error(`Error creando factura: ${invoiceResponse.status}`);
      }

      const invoiceText = await invoiceResponse.text();
      const invoiceIdMatch = invoiceText.match(/<(?:int|i4)>(\d+)<\/(?:int|i4)>/);
      
      if (invoiceIdMatch) {
        const invoiceId = parseInt(invoiceIdMatch[1]);
        return {
          success: true,
          data: {
            invoice_id: invoiceId,
            partner_id: partnerId,
            total_amount: totalAmount,
            message: `Factura creada exitosamente en Odoo (ID: ${invoiceId})`
          }
        };
      } else {
        throw new Error('No se pudo obtener el ID de la factura creada');
      }

    } catch (error) {
      cleanup();
      throw error;
    }

  } catch (error) {
    console.error('Error optimized Odoo integration:', error);
    
    let errorMessage = 'Error desconocido en Odoo';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Timeout conectando con Odoo - El servidor no respondió a tiempo';
      } else if (error.message.includes('autenticación')) {
        errorMessage = 'Error de autenticación con Odoo - Verifica tus credenciales';
      } else if (error.message.includes('conexión')) {
        errorMessage = 'Error de conexión con Odoo - Verifica la URL del servidor';
      } else {
        errorMessage = error.message;
      }
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
} 