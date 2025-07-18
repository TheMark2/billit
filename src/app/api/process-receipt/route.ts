import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processWithMindee, getAllCredentials, sendToOdoo, sendToHolded } from '@/app/api/upload-receipt/route';
import { generatePdfWithPuppeteer } from '@/lib/pdf-generator';

// Variables de entorno para Twilio
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

// Función para crear un evento SSE
function createSSEEvent(data: any, event?: string): string {
  const eventData = `data: ${JSON.stringify(data)}\\n\\n`;
  return event ? `event: ${event}\\n${eventData}` : eventData;
}

// Función para procesar archivo desde WhatsApp
async function processFileFromWhatsApp(
  fileData: any,
  userId: string,
  additionalData: any,
  controller?: ReadableStreamDefaultController<any>
) {
  const encoder = new TextEncoder();
  
  try {
    console.log('📁 Procesando archivo desde WhatsApp...');
    console.log('📄 Tipo de fileData recibido:', typeof fileData);
    console.log('📄 FileData:', fileData);
    
    // Paso 1: Crear File object desde los datos de WhatsApp
    if (controller) {
      controller.enqueue(encoder.encode(createSSEEvent({ step: 'file_preparation', message: 'Preparando archivo...' })));
    }
    
    let buffer: Buffer;
    let filename = 'receipt.jpg';
    let mimeType = 'image/jpeg';
    
    // Detectar el tipo de datos recibidos
    if (typeof fileData === 'string' && (fileData.startsWith('http://') || fileData.startsWith('https://'))) {
      // Caso 1: URL directa - descargar archivo
      console.log('📄 Procesando como URL - descargando archivo...');
      
      if (controller) {
        controller.enqueue(encoder.encode(createSSEEvent({ step: 'download', message: 'Descargando archivo desde WhatsApp...' })));
      }
      
      // Configurar opciones de fetch
      const fetchOptions: RequestInit = {};
      
      // Si es una URL de Twilio, agregar autenticación básica
      if (fileData.includes('api.twilio.com')) {
        console.log('🔐 Detectada URL de Twilio, agregando autenticación...');
        
        if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
          throw new Error('Variables de entorno de Twilio no configuradas (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)');
        }
        
        // Crear autenticación básica para Twilio
        const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
        fetchOptions.headers = {
          'Authorization': `Basic ${auth}`
        };
        
        console.log('🔐 Autenticación Twilio configurada');
      }
      
      const response = await fetch(fileData, fetchOptions);
      
      if (!response.ok) {
        throw new Error(`Error descargando archivo: ${response.status} ${response.statusText}`);
      }
      
      buffer = Buffer.from(await response.arrayBuffer());
      
      // Intentar extraer filename de la URL o headers
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition && contentDisposition.includes('filename=')) {
        const matches = contentDisposition.match(/filename="?([^"]+)"?/);
        if (matches) filename = matches[1];
      }
      
      // Extraer mimeType de headers
      const contentType = response.headers.get('content-type');
      if (contentType) mimeType = contentType;
      
      console.log('📄 Archivo descargado:', buffer.length, 'bytes, tipo:', mimeType);
      
    } else if (typeof fileData === 'string') {
      // Caso 2: String base64 directo
      console.log('📄 Procesando como base64 string');
      buffer = Buffer.from(fileData, 'base64');
    } else if (fileData && fileData.data && typeof fileData.data === 'string') {
      // Caso 3: Objeto con propiedad data que contiene base64
      console.log('📄 Procesando como objeto con data base64');
      buffer = Buffer.from(fileData.data, 'base64');
      if (fileData.mimeType) mimeType = fileData.mimeType;
      if (fileData.fileName) filename = fileData.fileName;
    } else if (fileData && fileData.mimeType && fileData.fileType) {
      // Caso 4: Objeto binario de n8n (necesitamos la URL para descargarlo)
      console.log('📄 Procesando como objeto binario de n8n');
      
      // Si no hay data directa, intentar buscar en otras propiedades
      if (fileData.data) {
        if (Buffer.isBuffer(fileData.data)) {
          buffer = fileData.data;
        } else if (typeof fileData.data === 'string') {
          buffer = Buffer.from(fileData.data, 'base64');
        } else {
          throw new Error('Formato de datos binarios no reconocido');
        }
      } else {
        throw new Error('No se encontraron datos binarios en el objeto');
      }
      
      mimeType = fileData.mimeType || 'image/jpeg';
      filename = fileData.fileName || 'receipt.jpg';
    } else {
      console.error('❌ Formato de fileData no reconocido:', fileData);
      throw new Error('Formato de archivo no válido. Envía una URL, base64 string, o objeto con datos binarios.');
    }
    
    // Validar que tenemos datos
    if (!buffer || buffer.length === 0) {
      throw new Error('El archivo está vacío o no se pudo procesar');
    }
    
    // Crear File object
    const file = new File([buffer], filename, { type: mimeType });
    
    console.log('📄 Archivo creado:', file.name, file.size, 'bytes', file.type);
    
    // Paso 2: Procesar con Mindee
    if (controller) {
      controller.enqueue(encoder.encode(createSSEEvent({ step: 'mindee_processing', message: 'Procesando con Mindee...' })));
    }
    
    const mindeeResult = await processWithMindee(file);
    
    if (!mindeeResult.success) {
      throw new Error(`Error en Mindee: ${mindeeResult.error}`);
    }
    
    console.log('✅ Mindee procesado exitosamente');
    
    // Paso 3: Obtener credenciales de integración
    if (controller) {
      controller.enqueue(encoder.encode(createSSEEvent({ step: 'integration_check', message: 'Verificando integraciones...' })));
    }
    
    const allCredentials = await getAllCredentials(userId);
    
    // Paso 4: Procesar en paralelo (PDF + integraciones)
    if (controller) {
      controller.enqueue(encoder.encode(createSSEEvent({ step: 'parallel_processing', message: 'Generando PDF y procesando integraciones...' })));
    }
    
    const integrationPromises: Promise<{ type: string; result: any }>[] = [];
    
    // Generar PDF
    integrationPromises.push(
      generatePdfWithPuppeteer(mindeeResult.data, userId)
        .then((result: any) => ({ type: 'pdf', result }))
        .catch((error: any) => ({ type: 'pdf', result: { success: false, error: error.message } }))
    );
    
    // Enviar a Odoo si está configurado
    if (allCredentials.odoo) {
      integrationPromises.push(
        sendToOdoo(mindeeResult.data, allCredentials.odoo)
          .then(result => ({ type: 'odoo', result }))
          .catch(error => ({ type: 'odoo', result: { success: false, error: error.message } }))
      );
    }
    
    // Enviar a Holded si está configurado
    if (allCredentials.holded) {
      integrationPromises.push(
        sendToHolded(mindeeResult.data, allCredentials.holded)
          .then(result => ({ type: 'holded', result }))
          .catch(error => ({ type: 'holded', result: { success: false, error: error.message } }))
      );
    }
    
    // Esperar a que todas las integraciones terminen
    const integrationResults = await Promise.all(integrationPromises);
    
    // Procesar resultados
    let pdfResult: any = null;
    const integrations: any = {};
    
    integrationResults.forEach(({ type, result }) => {
      if (type === 'pdf') {
        pdfResult = result;
      } else {
        integrations[type] = result;
      }
    });
    
    console.log('📊 Resultados de integraciones:', integrations);
    
    // Paso 5: Guardar en base de datos
    if (controller) {
      controller.enqueue(encoder.encode(createSSEEvent({ step: 'database_save', message: 'Guardando en base de datos...' })));
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const receiptData = {
      user_id: userId,
      proveedor: mindeeResult.data.prediction?.supplier_name?.value || 'Proveedor no identificado',
      numero_factura: mindeeResult.data.prediction?.invoice_number?.value || null,
      total: mindeeResult.data.prediction?.total_amount?.value || 0,
      moneda: mindeeResult.data.prediction?.locale?.currency || 'EUR',
      fecha_emision: mindeeResult.data.prediction?.date?.value || new Date().toISOString().split('T')[0],
      fecha_subida: new Date().toISOString(),
      url_archivo: pdfResult?.success ? pdfResult.data.download_url : null,
      tipo_factura: 'ticket', // Always use 'ticket' for digitized receipts
      metadatos: {
        mindee_data: mindeeResult.data,
        pdf_generation: pdfResult?.success ? {
          download_url: pdfResult.data.download_url,
          template_id: pdfResult.data.template_id,
          transaction_ref: pdfResult.data.transaction_ref,
          total_pages: pdfResult.data.total_pages,
          generated_at: new Date().toISOString(),
          status: 'success'
        } : null,
        integration_results: integrations,
        integration_status: 'whatsapp_processed',
        whatsapp_data: {
          phone: additionalData.phone,
          processed_at: new Date().toISOString(),
          file_info: {
            filename,
            mimeType,
            size: buffer.length,
            original_url: typeof fileData === 'string' && fileData.startsWith('http') ? fileData : null
          }
        }
      }
    };
    
    const { data: savedReceipt, error: saveError } = await supabase
      .from('receipts')
      .insert([receiptData])
      .select()
      .single();
    
    if (saveError) {
      console.error('❌ Error guardando recibo:', saveError);
      throw new Error(`Error guardando recibo: ${saveError.message}`);
    }
    
    console.log('✅ Recibo guardado exitosamente:', savedReceipt.id);
    
    // Paso 6: Respuesta final
    if (controller) {
      controller.enqueue(encoder.encode(createSSEEvent({ 
        step: 'completed', 
        message: 'Procesamiento completado exitosamente',
        data: {
          success: true,
          receipt_id: savedReceipt.id,
          pdf_url: pdfResult?.success ? pdfResult.data.download_url : null,
          integrations
        }
      })));
    }
    
    return {
      success: true,
      message: 'Recibo procesado exitosamente',
      data: {
        receipt_id: savedReceipt.id,
        pdf_url: pdfResult?.success ? pdfResult.data.download_url : null,
        integrations,
        mindee_data: mindeeResult.data
      }
    };
    
  } catch (error) {
    console.error('❌ Error en processFileFromWhatsApp:', error);
    
    if (controller) {
      controller.enqueue(encoder.encode(createSSEEvent({ 
        step: 'error', 
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error)
      })));
    }
    
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { fileData, userId, source, additionalData } = await request.json();
    
    console.log('🔄 Procesando recibo desde:', source);
    console.log('👤 Usuario:', userId);
    
    if (!fileData || !userId) {
      return NextResponse.json(
        { error: 'fileData and userId are required' },
        { status: 400 }
      );
    }
    
    // Verificar si es streaming o respuesta directa
    const isStreaming = request.headers.get('accept')?.includes('text/event-stream');
    
    if (isStreaming) {
      // Respuesta con streaming
      const stream = new ReadableStream({
        start(controller) {
          processFileFromWhatsApp(fileData, userId, additionalData || {}, controller)
            .then(result => {
              controller.close();
            })
            .catch(error => {
              const encoder = new TextEncoder();
                             controller.enqueue(encoder.encode(createSSEEvent({ 
                 step: 'error', 
                 message: error instanceof Error ? error.message : String(error),
                 error: error instanceof Error ? error.message : String(error)
               })));
              controller.close();
            });
        }
      });
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Respuesta directa
      const result = await processFileFromWhatsApp(fileData, userId, additionalData || {});
      return NextResponse.json(result);
    }
    
  } catch (error) {
    console.error('❌ Error en process-receipt:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 