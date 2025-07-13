import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generatePdfWithApiTemplate, processWithMindee, getAllCredentials, sendToOdoo, sendToHolded } from '@/app/api/upload-receipt/route';

// Función para crear un evento SSE
function createSSEEvent(data: any, event?: string): string {
  const eventData = `data: ${JSON.stringify(data)}\n\n`;
  return event ? `event: ${event}\n${eventData}` : eventData;
}

// Función para procesar recibo completo (tanto web como WhatsApp)
async function processReceiptComplete(
  mindeeData: any, 
  userId: string, 
  source: 'web' | 'whatsapp',
  additionalData?: any,
  controller?: ReadableStreamDefaultController<any>
) {
  const encoder = new TextEncoder();
  
  try {
    // Paso 1: Preparar integraciones (50%)
    if (controller) {
      controller.enqueue(encoder.encode(createSSEEvent({
        progress: 50,
        message: 'Preparando integraciones con tus sistemas...',
        stage: 'integrations_prep'
      })));
    }

    const allCredentials = await getAllCredentials(userId);

    // Paso 2: Ejecutando integraciones (70%)
    if (controller) {
      controller.enqueue(encoder.encode(createSSEEvent({
        progress: 70,
        message: 'Sincronizando con tus sistemas de gestión...',
        stage: 'integrations_exec'
      })));
    }

    // Ejecutar integraciones en paralelo
    const integrationPromises = [];
    
    integrationPromises.push(
      generatePdfWithApiTemplate(mindeeData, userId)
        .then((result: any) => ({ type: 'pdf', result }))
        .catch((error: any) => ({ type: 'pdf', result: { success: false, error: error.message } }))
    );

    if (allCredentials.odoo) {
      integrationPromises.push(
        sendToOdoo(mindeeData, allCredentials.odoo)
          .then((result: any) => ({ type: 'odoo', result }))
          .catch((error: any) => ({ type: 'odoo', result: { success: false, error: error.message } }))
      );
    }

    if (allCredentials.holded) {
      integrationPromises.push(
        sendToHolded(mindeeData, allCredentials.holded)
          .then((result: any) => ({ type: 'holded', result }))
          .catch((error: any) => ({ type: 'holded', result: { success: false, error: error.message } }))
      );
    }

    const integrationResults = await Promise.all(integrationPromises);

    // Paso 3: Guardando en base de datos (90%)
    if (controller) {
      controller.enqueue(encoder.encode(createSSEEvent({
        progress: 90,
        message: 'Guardando datos en la base de datos...',
        stage: 'database'
      })));
    }

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
      mindeeResult: { success: true, data: mindeeData },
      allCredentials,
      pdfResult,
      odooResult,
      holdedResult,
      estadoFinal,
      integrationStatus,
      source,
      additionalData
    };

  } catch (error) {
    if (controller) {
      controller.enqueue(encoder.encode(createSSEEvent({
        progress: 0,
        message: `Error durante el procesamiento: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        stage: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido'
      })));
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar si es una petición de streaming
    const acceptHeader = request.headers.get('accept');
    const isStreaming = acceptHeader?.includes('text/event-stream');

    const contentType = request.headers.get('content-type');
    const isFormData = contentType?.includes('multipart/form-data');
    const isJson = contentType?.includes('application/json');

    let userId: string;
    let mindeeData: any;
    let source: 'web' | 'whatsapp';
    let additionalData: any = {};

    // Crear cliente de Supabase con service role key para WhatsApp
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (isFormData) {
      // Caso WEB: Archivo subido desde dashboard
      source = 'web';
      
      // Obtener el token de autorización del header
      const authHeader = request.headers.get('authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Unauthorized - Missing authorization header' },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7);

      // Crear cliente de Supabase con token de usuario para web
      const userSupabase = createClient(
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
      const { data: { user }, error: authError } = await userSupabase.auth.getUser(token);
      
      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized - Invalid token' },
          { status: 401 }
        );
      }

      userId = user.id;

      // Obtener archivo y procesarlo con Mindee
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }

      const mindeeResult = await processWithMindee(file);
      
      if (!mindeeResult.success) {
        return NextResponse.json(
          { error: mindeeResult.error },
          { status: 500 }
        );
      }

      mindeeData = mindeeResult.data;
      additionalData.fileName = file.name;
      additionalData.fileSize = file.size;

    } else if (isJson) {
      // Caso WHATSAPP: Datos ya procesados por Mindee
      source = 'whatsapp';
      
      const body = await request.json();
      mindeeData = body.mindeeData;
      userId = body.userId;
      additionalData = body.additionalData || {};

      if (!mindeeData || !userId) {
        return NextResponse.json(
          { error: 'mindeeData and userId are required' },
          { status: 400 }
        );
      }

    } else {
      return NextResponse.json(
        { error: 'Unsupported content type' },
        { status: 400 }
      );
    }

    // Si es streaming, usar Server-Sent Events
    if (isStreaming) {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          
          try {
            const result = await processReceiptComplete(mindeeData, userId, source, additionalData, controller);
            
            if (!result) {
              controller.close();
              return;
            }

            // Guardar en base de datos
            const { data: receiptData, error: dbError } = await supabase
              .from('receipts')
              .insert({
                user_id: userId,
                empresa_id: additionalData.empresa_id || null,
                fecha_emision: result.mindeeResult.data.date || new Date().toISOString().split('T')[0],
                fecha_subida: new Date().toISOString().split('T')[0],
                proveedor: result.mindeeResult.data.supplier_name || 'Proveedor no identificado',
                numero_factura: result.mindeeResult.data.invoice_number || `AUTO-${Date.now()}`,
                total: result.mindeeResult.data.total_amount || 0,
                moneda: result.mindeeResult.data.currency || 'EUR',
                estado: result.estadoFinal,
                url_archivo: result.pdfResult.success ? result.pdfResult.data.download_url : (additionalData.fileName || 'unknown'),
                texto_extraido: JSON.stringify(result.mindeeResult.data),
                metadatos: {
                  mindee_data: result.mindeeResult.data,
                  pdf_generation: result.pdfResult.success ? result.pdfResult.data : { error: result.pdfResult.error || 'PDF generation failed' },
                  odoo_integration: result.odooResult,
                  holded_integration: result.holdedResult,
                  file_size: additionalData.fileSize || null,
                  processed_at: new Date().toISOString(),
                  integration_status: result.integrationStatus,
                  processing_source: source,
                  integrations_summary: {
                    odoo: result.allCredentials.odoo ? (result.odooResult?.success ? 'success' : 'failed') : 'not_configured',
                    holded: result.allCredentials.holded ? (result.holdedResult?.success ? 'success' : 'failed') : 'not_configured',
                    pdf: result.pdfResult.success ? 'success' : 'failed'
                  },
                  ...(source === 'whatsapp' && {
                    whatsapp_data: additionalData
                  })
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
                  pdf_url: result.pdfResult.success ? result.pdfResult.data.download_url : null,
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
    } else {
      // Respuesta JSON simple (no streaming)
      const result = await processReceiptComplete(mindeeData, userId, source, additionalData);

      // Guardar en base de datos
      const { data: receiptData, error: dbError } = await supabase
        .from('receipts')
        .insert({
          user_id: userId,
          empresa_id: additionalData.empresa_id || null,
          fecha_emision: result.mindeeResult.data.date || new Date().toISOString().split('T')[0],
          fecha_subida: new Date().toISOString().split('T')[0],
          proveedor: result.mindeeResult.data.supplier_name || 'Proveedor no identificado',
          numero_factura: result.mindeeResult.data.invoice_number || `AUTO-${Date.now()}`,
          total: result.mindeeResult.data.total_amount || 0,
          moneda: result.mindeeResult.data.currency || 'EUR',
          estado: result.estadoFinal,
          url_archivo: result.pdfResult.success ? result.pdfResult.data.download_url : (additionalData.fileName || 'unknown'),
          texto_extraido: JSON.stringify(result.mindeeResult.data),
          metadatos: {
            mindee_data: result.mindeeResult.data,
            pdf_generation: result.pdfResult.success ? result.pdfResult.data : { error: result.pdfResult.error || 'PDF generation failed' },
            odoo_integration: result.odooResult,
            holded_integration: result.holdedResult,
            file_size: additionalData.fileSize || null,
            processed_at: new Date().toISOString(),
            integration_status: result.integrationStatus,
            processing_source: source,
            integrations_summary: {
              odoo: result.allCredentials.odoo ? (result.odooResult?.success ? 'success' : 'failed') : 'not_configured',
              holded: result.allCredentials.holded ? (result.holdedResult?.success ? 'success' : 'failed') : 'not_configured',
              pdf: result.pdfResult.success ? 'success' : 'failed'
            },
            ...(source === 'whatsapp' && {
              whatsapp_data: additionalData
            })
          }
        })
        .select()
        .single();

      if (dbError) {
        return NextResponse.json(
          { error: 'Error guardando en base de datos: ' + dbError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        receipt_id: receiptData.id,
        pdf_url: result.pdfResult.success ? result.pdfResult.data.download_url : null,
        integrations: {
          odoo: result.allCredentials.odoo ? (result.odooResult?.success ? 'success' : 'failed') : 'not_configured',
          holded: result.allCredentials.holded ? (result.holdedResult?.success ? 'success' : 'failed') : 'not_configured',
          pdf: result.pdfResult.success ? 'success' : 'failed'
        },
        data: {
          receipt: receiptData,
          mindee_data: result.mindeeResult.data,
          pdf_result: result.pdfResult,
          odoo_result: result.odooResult,
          holded_result: result.holdedResult
        }
      });
    }

  } catch (error) {
    console.error('Error in process-receipt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 