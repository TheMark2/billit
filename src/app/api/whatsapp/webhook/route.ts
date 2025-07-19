import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabaseClient';
import { checkUserSubscription } from '@/utils/supabaseClient';
import { processWithMindee } from '@/app/api/upload-receipt/route';
import { uploadOriginalImage } from '@/lib/supabase-storage';
import { createWhatsAppBusinessAPI, cleanPhoneNumberForWhatsApp, type WhatsAppWebhookPayload } from '@/lib/whatsapp-business';

// Función para limpiar número de teléfono
function cleanPhoneNumber(phoneNumber: string): string {
  return cleanPhoneNumberForWhatsApp(phoneNumber);
}

// Función para obtener perfil del usuario
async function getUserProfile(phoneNumber: string) {
  const supabase = getSupabaseService();
  
  // Intentar diferentes formatos del número
  const phoneFormats = [
    phoneNumber, // Formato original
    phoneNumber.replace('whatsapp:', ''), // Quitar prefijo whatsapp:
    phoneNumber.replace('whatsapp:', '').replace('+', ''), // Quitar whatsapp: y +
    phoneNumber.replace('+', ''), // Solo quitar +
    phoneNumber.replace(/^34/, ''), // Quitar 34 del principio (ESTE ES EL IMPORTANTE)
    phoneNumber.replace(/^(\+34|34)/, ''), // Quitar +34 o 34 del principio
    `+34${phoneNumber}`, // Añadir +34
    phoneNumber.replace('+34', ''), // Quitar +34
    `+${phoneNumber}`, // Añadir +
    phoneNumber.replace('+', ''), // Quitar +
    phoneNumber.replace(/\D/g, '') // Solo números
  ];

  console.log('🔍 getUserProfile - Buscando con número:', phoneNumber);
  console.log('📱 getUserProfile - Formatos a probar:', phoneFormats);

  let profile = null;
  let foundWithFormat = '';

  // Buscar el usuario con diferentes formatos
  for (const phoneFormat of phoneFormats) {
    console.log(`🔎 getUserProfile - Probando formato: "${phoneFormat}"`);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, telefono')
      .eq('telefono', phoneFormat)
      .single();

    if (!error && data) {
      profile = data;
      foundWithFormat = phoneFormat;
      console.log(`✅ getUserProfile - Usuario encontrado con formato: "${phoneFormat}"`);
      break;
    } else {
      console.log(`❌ getUserProfile - No encontrado con formato: "${phoneFormat}"`);
    }
  }

  return profile;
}

// Función para obtener integraciones del usuario
async function getUserIntegrations(phoneNumber: string) {
  const supabase = getSupabaseService();
  
  // Intentar diferentes formatos del número
  const phoneFormats = [
    phoneNumber, // Formato original
    phoneNumber.replace('whatsapp:', ''), // Quitar prefijo whatsapp:
    phoneNumber.replace('whatsapp:', '').replace('+', ''), // Quitar whatsapp: y +
    phoneNumber.replace('+', ''), // Solo quitar +
    phoneNumber.replace(/^34/, ''), // Quitar 34 del principio (ESTE ES EL IMPORTANTE)
    phoneNumber.replace(/^(\+34|34)/, ''), // Quitar +34 o 34 del principio
    `+34${phoneNumber}`, // Añadir +34
    phoneNumber.replace('+34', ''), // Quitar +34
    `+${phoneNumber}`, // Añadir +
    phoneNumber.replace('+', ''), // Quitar +
    phoneNumber.replace(/\D/g, '') // Solo números
  ];

  console.log('🔍 getUserIntegrations - Buscando con número:', phoneNumber);
  console.log('📱 getUserIntegrations - Formatos a probar:', phoneFormats);

  let profile = null;
  let foundWithFormat = '';

  // Buscar el usuario con diferentes formatos
  for (const phoneFormat of phoneFormats) {
    console.log(`🔎 getUserIntegrations - Probando formato: "${phoneFormat}"`);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, telefono')
      .eq('telefono', phoneFormat)
      .single();

    if (!error && data) {
      profile = data;
      foundWithFormat = phoneFormat;
      console.log(`✅ getUserIntegrations - Usuario encontrado con formato: "${phoneFormat}"`);
      break;
    } else {
      console.log(`❌ getUserIntegrations - No encontrado con formato: "${phoneFormat}"`);
    }
  }

  if (!profile) {
    console.log('❌ getUserIntegrations - Usuario no encontrado');
    return [];
  }

  const integrations = [];
  
  // Verificar Holded
  const { data: holded } = await supabase
    .from('holded_credentials')
    .select('*')
    .eq('user_id', profile.id)
    .single();
  
  if (holded) {
    integrations.push({
      type: 'holded',
      name: 'Holded',
      icon: '🟢'
    });
  }

  // Verificar Odoo
  const { data: odoo } = await supabase
    .from('odoo_credentials')
    .select('*')
    .eq('user_id', profile.id)
    .single();
  
  if (odoo) {
    integrations.push({
      type: 'odoo',
      name: 'Odoo',
      icon: '🟣'
    });
  }

  // Verificar Xero
  const { data: xero } = await supabase
    .from('xero_credentials')
    .select('*')
    .eq('user_id', profile.id)
    .single();
  
  if (xero) {
    integrations.push({
      type: 'xero',
      name: 'Xero',
      icon: '🔵'
    });
  }

  return integrations;
}

// Función para generar menú de integraciones
function generateIntegrationsMenu(integrations: any[], phoneNumber: string) {
  if (integrations.length === 0) {
    return {
      message: `❌ *No tienes integraciones configuradas*\n\nVe a tu dashboard para configurar Odoo, Holded o Xero.\n\n📄 *Comando útil:*\n• Escribe "*pdf*" para descargar tu factura en PDF`,
      hasIntegrations: false
    };
  }

  let message = `✅ *Factura procesada correctamente*\n\n🔗 *Selecciona dónde enviar la factura:*\n\n`;
  
  integrations.forEach((integration, index) => {
    const numero = index + 1;
    message += `${numero}. ${integration.icon} ${integration.name}\n`;
  });

  message += `\n💬 *Responde con el número de tu elección*`;
  message += `\n\n📄 *Comando útil:*\n• Escribe "*pdf*" para descargar tu factura en PDF`;

  return {
    message,
    hasIntegrations: true,
    integrations
  };
}

// Función para enviar mensaje de WhatsApp usando WhatsApp Business API
async function sendWhatsAppMessage(phoneNumber: string, message: string) {
  try {
    const whatsappAPI = createWhatsAppBusinessAPI();
    const result = await whatsappAPI.sendMessage(phoneNumber, message);
    return result;
  } catch (error) {
    console.error('❌ Error enviando mensaje WhatsApp Business:', error);
    throw error;
  }
}

// Función para descargar archivo multimedia usando WhatsApp Business API
async function downloadMedia(mediaId: string): Promise<Buffer> {
  console.log('⬇️ Descargando archivo multimedia desde WhatsApp Business:', mediaId);
  
  try {
    const whatsappAPI = createWhatsAppBusinessAPI();
    const buffer = await whatsappAPI.downloadMedia(mediaId);
    console.log('✅ Archivo descargado exitosamente desde WhatsApp Business, tamaño:', buffer.length, 'bytes');
    return buffer;
  } catch (error) {
    console.error('❌ Error descargando archivo desde WhatsApp Business:', error);
    throw error;
  }
}

// Función para procesar recibo (simplificada, reutiliza lógica de upload-receipt)
async function processReceipt(phoneNumber: string, mediaBuffer: Buffer, mediaType: string) {
  try {
    // Generar ID temporal para el recibo
    const tempReceiptId = `whatsapp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Crear un File object desde el buffer
    const file = new File([mediaBuffer], 'receipt.jpg', { type: mediaType });
    
    // Obtener el usuario por número de teléfono primero para tener el userId
    const supabase = getSupabaseService();
    
    // Intentar diferentes formatos del número
    const phoneFormats = [
      phoneNumber, // Formato original
      phoneNumber.replace('whatsapp:', ''), // Quitar prefijo whatsapp:
      phoneNumber.replace('whatsapp:', '').replace('+', ''), // Quitar whatsapp: y +
      phoneNumber.replace('+', ''), // Solo quitar +
      phoneNumber.replace(/^34/, ''), // Quitar 34 del principio (ESTE ES EL IMPORTANTE)
      phoneNumber.replace(/^(\+34|34)/, ''), // Quitar +34 o 34 del principio
      `+34${phoneNumber}`, // Añadir +34
      phoneNumber.replace('+34', ''), // Quitar +34
      `+${phoneNumber}`, // Añadir +
      phoneNumber.replace('+', ''), // Quitar +
      phoneNumber.replace(/\D/g, '') // Solo números
    ];

    console.log('🔍 processReceipt - Buscando con número:', phoneNumber);
    console.log('📱 processReceipt - Formatos a probar:', phoneFormats);

    let profile: any = null;
    let foundWithFormat = '';

    // Buscar el usuario con diferentes formatos
    for (const phoneFormat of phoneFormats) {
      console.log(`🔎 processReceipt - Probando formato: "${phoneFormat}"`);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, telefono')
        .eq('telefono', phoneFormat)
        .single();

      if (!error && data) {
        profile = data;
        foundWithFormat = phoneFormat;
        console.log(`✅ processReceipt - Usuario encontrado con formato: "${phoneFormat}"`);
        break;
      } else {
        console.log(`❌ processReceipt - No encontrado con formato: "${phoneFormat}"`);
      }
    }
    
    if (!profile) {
      console.log('❌ processReceipt - Usuario no encontrado');
      throw new Error('Usuario no encontrado');
    }

    // Guardar imagen original en Supabase Storage
    console.log('📸 Guardando imagen original en Supabase Storage...');
    const imageUploadResult = await uploadOriginalImage(mediaBuffer, profile.id, tempReceiptId, 'receipt.jpg');
    
    if (!imageUploadResult.success) {
      console.warn('⚠️ Warning: Could not save original image:', imageUploadResult.error);
      // Continuar el procesamiento aunque falle el guardado de imagen
    }
    
    // Llamar directamente a la función de procesamiento de Mindee
    console.log('🧠 Llamando a Mindee API...');
    const mindeeResult = await processWithMindee(file);
    console.log('📊 Resultado de Mindee:', mindeeResult);
    
    if (!mindeeResult.success) {
      console.log('❌ Error de Mindee:', mindeeResult.error);
      throw new Error(mindeeResult.error || 'Error procesando factura');
    }
    
    console.log('✅ Mindee procesó exitosamente');
    
    // Procesar integraciones antes de guardar (similar a upload-receipt)
    console.log('🔗 Obteniendo credenciales y procesando integraciones...');
    
    // Importar funciones de integración
    const { getAllCredentials, sendToOdoo, sendToHolded } = await import('@/app/api/upload-receipt/route');
    const { generatePdfWithPuppeteer } = await import('@/lib/pdf-generator');
    
    const allCredentials = await getAllCredentials(profile.id);
    
    // Ejecutar integraciones en paralelo
    const integrationPromises = [];
    
    integrationPromises.push(
      generatePdfWithPuppeteer(mindeeResult.data, profile.id)
        .then((result: any) => ({ type: 'pdf', result }))
        .catch((error: any) => ({ type: 'pdf', result: { success: false, error: error.message } }))
    );

    if (allCredentials.odoo) {
      console.log('📋 Usuario tiene Odoo configurado, enviando a Odoo...');
      integrationPromises.push(
        sendToOdoo(mindeeResult.data, allCredentials.odoo)
          .then(result => ({ type: 'odoo', result }))
          .catch(error => ({ type: 'odoo', result: { success: false, error: error.message } }))
      );
    }

    if (allCredentials.holded) {
      console.log('💼 Usuario tiene Holded configurado, enviando a Holded...');
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

    // Determinar estado según integraciones
    let estadoFinal = 'pendiente';
    let integrationStatus = 'not_configured';
    
    console.log('🔍 [WHATSAPP] Evaluando estado del ticket:');
    console.log('📊 Credenciales:', { 
      odoo: !!allCredentials.odoo, 
      holded: !!allCredentials.holded 
    });
    console.log('📊 Resultados Odoo:', { 
      executed: !!odooResult, 
      success: odooResult?.success 
    });
    console.log('📊 Resultados Holded:', { 
      executed: !!holdedResult, 
      success: holdedResult?.success 
    });
    
    if ((allCredentials.odoo && odooResult?.success) || (allCredentials.holded && holdedResult?.success)) {
      estadoFinal = 'procesado';
      integrationStatus = 'success';
      console.log('✅ [WHATSAPP] Estado final: PROCESADO (integración exitosa)');
    } else if ((allCredentials.odoo && !odooResult?.success) || (allCredentials.holded && !holdedResult?.success)) {
      estadoFinal = 'error';
      integrationStatus = 'failed';
      console.log('❌ [WHATSAPP] Estado final: ERROR (integración falló)');
    } else if (allCredentials.odoo || allCredentials.holded) {
      integrationStatus = 'partial';
      console.log('⚠️ [WHATSAPP] Estado final: PENDIENTE (sin integraciones configuradas/ejecutadas)');
    } else {
      console.log('📝 [WHATSAPP] Estado final: PENDIENTE (sin integraciones configuradas)');
    }

    // Guardar el recibo en la base de datos con el estado correcto
    console.log('💾 Guardando recibo en base de datos...');
    const { data: receipt, error } = await supabase
      .from('receipts')
      .insert({
        user_id: profile.id,
        fecha_emision: mindeeResult.data.date || new Date().toISOString().split('T')[0],
        fecha_subida: new Date().toISOString().split('T')[0],
        proveedor: mindeeResult.data.supplier_name || 'Desconocido',
        numero_factura: mindeeResult.data.invoice_number || `AUTO-${Date.now()}`,
        total: mindeeResult.data.total_amount || 0,
        moneda: mindeeResult.data.currency || 'EUR',
        estado: estadoFinal, // Estado determinado por integraciones
        url_archivo: 'whatsapp_receipt.jpg',
        texto_extraido: JSON.stringify(mindeeResult.data),
        tipo_factura: 'ticket',
        original_image_path: imageUploadResult.success ? imageUploadResult.path : null,
        metadatos: {
          mindee_data: mindeeResult.data,
          pdf_generation: pdfResult.success ? pdfResult.data : { error: pdfResult.error || 'PDF generation failed' },
          odoo_integration: odooResult,
          holded_integration: holdedResult,
          file_size: mediaBuffer.length,
          processed_at: new Date().toISOString(),
          source: 'whatsapp',
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
    
    if (error) {
      console.log('❌ Error guardando recibo:', error);
      throw new Error(`Error guardando recibo: ${error.message}`);
    }
    
    console.log('✅ Recibo guardado exitosamente con ID:', receipt.id);

    // Detectar duplicados automáticamente
    try {
      console.log('🔍 Detectando duplicados automáticamente...');
      
      const { data: duplicates } = await supabase
        .rpc('find_potential_duplicates', {
          user_id_param: profile.id,
          proveedor_param: mindeeResult.data.supplier_name || 'Desconocido',
          total_param: mindeeResult.data.total_amount || 0,
          fecha_emision_param: mindeeResult.data.date || new Date().toISOString().split('T')[0],
          threshold_days: 7,
          threshold_amount: 5.0
        });

      const filteredDuplicates = duplicates?.filter((dup: any) => dup.receipt_id !== receipt.id) || [];
      
      if (filteredDuplicates.length > 0) {
        console.log(`⚠️ Se encontraron ${filteredDuplicates.length} posibles duplicados`);
        
        // Guardar detección en histórico
        await supabase
          .from('duplicate_detections')
          .insert({
            user_id: profile.id,
            receipt_id: receipt.id,
            potential_duplicates: filteredDuplicates.map((dup: any) => dup.receipt_id),
            similarity_scores: filteredDuplicates.map((dup: any) => dup.similarity_score),
            action_taken: 'pending'
          });

        console.log('📝 Detección de duplicados guardada en histórico');
      }
    } catch (error) {
      console.warn('⚠️ Error detecting duplicates:', error);
    }
    
    // Nota: El PDF se generará on-demand cuando se necesite
    // para evitar problemas con Puppeteer en el webhook de Vercel
    console.log('✅ Recibo procesado, PDF se generará on-demand cuando se necesite');
    
    return {
      success: true,
      receiptId: receipt.id,
      data: mindeeResult.data
    };
    
  } catch (error) {
    throw error;
  }
}

// Función processWithMindee importada desde upload-receipt
// Esta función maneja toda la lógica de procesamiento con Mindee API

// Función para manejar comandos de texto
async function handleTextCommand(phoneNumber: string, command: string) {
  const cleanPhone = cleanPhoneNumber(phoneNumber);
  
  switch (command.toLowerCase()) {
    case 'menu':
    case 'menú':
      const integrations = await getUserIntegrations(cleanPhone);
      const menu = generateIntegrationsMenu(integrations, cleanPhone);
      await sendWhatsAppMessage(cleanPhone, menu.message);
      break;
    
    case 'ayuda':
    case 'help':
      const helpMessage = `🤖 *Comandos disponibles:*\n\n` +
        `📷 *Envía una imagen* - Procesar factura\n` +
        `📋 *menu* - Ver integraciones\n` +
        `📄 *pdf* - Descargar PDF de tu última factura\n` +
        `❓ *ayuda* - Ver este mensaje\n` +
        `📊 *estado* - Ver tu plan actual`;
      await sendWhatsAppMessage(cleanPhone, helpMessage);
      break;
    
    case 'estado':
      const userStatus = await checkUserSubscription(cleanPhone);
      const statusMessage = userStatus.isSubscribed
        ? `✅ *Plan activo*\n\n📊 Facturas restantes: ${userStatus.remainingQuota}`
        : `❌ *Plan inactivo*\n\nVe a tu dashboard para activar tu suscripción.`;
      await sendWhatsAppMessage(cleanPhone, statusMessage);
      break;
    
    case 'pdf':
      // Obtener el último recibo del usuario y enviar el PDF
      const pdfUser = await getUserProfile(cleanPhone);
      if (!pdfUser) {
        await sendWhatsAppMessage(cleanPhone, 
          `❌ *Usuario no encontrado*\n\nNo se pudo encontrar tu perfil.`
        );
        break;
      }
      
      const supabaseForPdf = getSupabaseService();
      const { data: lastReceipt } = await supabaseForPdf
        .from('receipts')
        .select('id, proveedor, numero_factura, total, metadatos, url_archivo')
        .eq('user_id', pdfUser.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!lastReceipt) {
        await sendWhatsAppMessage(cleanPhone, 
          `❌ *No hay facturas*\n\nNo tienes facturas procesadas para descargar.`
        );
        break;
      }
      
      // Verificar si existe el PDF
      const pdfUrl = lastReceipt.metadatos?.pdf_generation?.download_url || lastReceipt.url_archivo;
      
      if (pdfUrl) {
        const pdfMessage = `📄 *Tu factura PDF*\n\n` +
          `📋 Proveedor: ${lastReceipt.proveedor}\n` +
          `💰 Total: €${lastReceipt.total}\n` +
          `📄 Factura: ${lastReceipt.numero_factura}\n\n` +
          `🔗 Descarga tu PDF aquí: ${pdfUrl}`;
        await sendWhatsAppMessage(cleanPhone, pdfMessage);
      } else {
        await sendWhatsAppMessage(cleanPhone, 
          `❌ *PDF no disponible*\n\nNo se pudo generar el PDF para tu última factura.`
        );
      }
      break;
    
    default:
      // Verificar si es una selección numérica para integraciones
      const selection = parseInt(command);
      if (!isNaN(selection) && selection > 0) {
        const integrations = await getUserIntegrations(cleanPhone);
        if (selection <= integrations.length) {
          const selectedIntegration = integrations[selection - 1];
          await sendWhatsAppMessage(cleanPhone, 
            `🔄 *Enviando a ${selectedIntegration.name}...*\n\n` +
            `Tu factura será procesada en ${selectedIntegration.name}.`
          );
          
          // Obtener el recibo más reciente del usuario
          const supabase = getSupabaseService();
          
          // Intentar diferentes formatos del número
          const phoneFormats = [
            cleanPhone, // Formato original
            cleanPhone.replace('whatsapp:', ''), // Quitar prefijo whatsapp:
            cleanPhone.replace('whatsapp:', '').replace('+', ''), // Quitar whatsapp: y +
            cleanPhone.replace('+', ''), // Solo quitar +
            cleanPhone.replace(/^34/, ''), // Quitar 34 del principio (ESTE ES EL IMPORTANTE)
            cleanPhone.replace(/^(\+34|34)/, ''), // Quitar +34 o 34 del principio
            `+34${cleanPhone}`, // Añadir +34
            cleanPhone.replace('+34', ''), // Quitar +34
            `+${cleanPhone}`, // Añadir +
            cleanPhone.replace('+', ''), // Quitar +
            cleanPhone.replace(/\D/g, '') // Solo números
          ];

          console.log('🔍 handleTextCommand - Buscando con número:', cleanPhone);
          console.log('📱 handleTextCommand - Formatos a probar:', phoneFormats);

          let userProfile = null;
          let foundWithFormat = '';

          // Buscar el usuario con diferentes formatos
          for (const phoneFormat of phoneFormats) {
            console.log(`🔎 handleTextCommand - Probando formato: "${phoneFormat}"`);
            
            const { data, error } = await supabase
              .from('profiles')
              .select('id, telefono')
              .eq('telefono', phoneFormat)
              .single();

            if (!error && data) {
              userProfile = data;
              foundWithFormat = phoneFormat;
              console.log(`✅ handleTextCommand - Usuario encontrado con formato: "${phoneFormat}"`);
              break;
            } else {
              console.log(`❌ handleTextCommand - No encontrado con formato: "${phoneFormat}"`);
            }
          }
          
          if (!userProfile) {
            await sendWhatsAppMessage(cleanPhone, 
              `❌ *Usuario no encontrado*\n\nNo se pudo encontrar tu perfil.`
            );
            return;
          }
          
          const { data: recentReceipt } = await supabase
            .from('receipts')
            .select('*')
            .eq('user_id', userProfile.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (recentReceipt) {
            // Enviar a la integración específica
            try {
              const integrationResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://tu-dominio.vercel.app'}/api/whatsapp/send-to-integration`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  phoneNumber: cleanPhone,
                  receiptId: recentReceipt.id,
                  integrationType: selectedIntegration.type,
                  receiptData: recentReceipt.processed_data
                })
              });
              
              if (integrationResponse.ok) {
                await sendWhatsAppMessage(cleanPhone, 
                  `✅ *Factura enviada correctamente*\n\n` +
                  `Tu factura ha sido enviada a ${selectedIntegration.name} exitosamente.`
                );
              } else {
                await sendWhatsAppMessage(cleanPhone, 
                  `❌ *Error al enviar factura*\n\n` +
                  `Hubo un problema al enviar tu factura a ${selectedIntegration.name}. Inténtalo más tarde.`
                );
              }
            } catch (error) {
              await sendWhatsAppMessage(cleanPhone, 
                `❌ *Error al enviar factura*\n\n` +
                `Hubo un problema al enviar tu factura a ${selectedIntegration.name}. Inténtalo más tarde.`
              );
            }
          } else {
            await sendWhatsAppMessage(cleanPhone, 
              `❌ *No hay facturas recientes*\n\n` +
              `Envía una imagen de tu factura primero para poder procesarla.`
            );
          }
        } else {
          await sendWhatsAppMessage(cleanPhone, 
            `❌ *Opción inválida*\n\nResponde con un número del 1 al ${integrations.length}`
          );
        }
      } else {
        await sendWhatsAppMessage(cleanPhone, 
          `❓ *Comando no reconocido*\n\nEscribe "ayuda" para ver los comandos disponibles.`
        );
      }
  }
}

export async function GET(request: NextRequest) {
  // Verificación de webhook para WhatsApp Business API
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook de WhatsApp Business verificado');
    return new NextResponse(challenge, { status: 200 });
  } else {
    console.log('❌ Verificación de webhook fallida');
    return new NextResponse('Unauthorized', { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  console.log('📨 Webhook WhatsApp Business recibido');
  
  try {
    const body: WhatsAppWebhookPayload = await request.json();
    console.log('📝 Payload WhatsApp Business:', JSON.stringify(body, null, 2));
    
    // Verificar que es un webhook de WhatsApp
    if (body.object !== 'whatsapp_business_account') {
      console.log('⚠️ No es un webhook de WhatsApp Business');
      return NextResponse.json({ status: 'success' });
    }
    
    // Procesar cada entrada
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages') {
          const value = change.value;
          
          // Procesar mensajes entrantes
          if (value.messages) {
            for (const message of value.messages) {
              const phoneNumber = cleanPhoneNumber(message.from);
              console.log('📱 Número de teléfono procesado:', phoneNumber);
              
              if (message.type === 'text' && message.text) {
                console.log('💬 Procesando mensaje de texto:', message.text.body);
                await handleTextCommand(phoneNumber, message.text.body);
              } else if (message.type === 'image' && message.image) {
                console.log('🖼️ Procesando imagen de:', phoneNumber);
                
                try {
                  // Verificar usuario
                  console.log('🔍 Verificando usuario...');
                  const userStatus = await checkUserSubscription(phoneNumber);
                  
                  if (!userStatus.isSubscribed || !userStatus.quotaAvailable) {
                    console.log('❌ Usuario sin suscripción o cuota');
                    await sendWhatsAppMessage(phoneNumber, 
                      `❌ *Suscripción inactiva o sin cuota*\n\nVe a tu dashboard para activar tu plan.`
                    );
                    continue;
                  }
                  
                  console.log('⬇️ Descargando imagen desde WhatsApp Business...');
                  const mediaBuffer = await downloadMedia(message.image.id);
                  
                  console.log('🧠 Procesando recibo con IA...');
                  const result = await processReceipt(phoneNumber, mediaBuffer, 'image/jpeg');
                  
                  console.log('✅ Recibo procesado exitosamente');
                  
                  // Obtener integraciones del usuario
                  const integrations = await getUserIntegrations(phoneNumber);
                  const menu = generateIntegrationsMenu(integrations, phoneNumber);
                  
                  await sendWhatsAppMessage(phoneNumber, menu.message);
                } catch (error) {
                  console.error('❌ Error procesando imagen:', error);
                  await sendWhatsAppMessage(phoneNumber, 
                    `❌ *Error procesando imagen*\n\nInténtalo de nuevo más tarde.`
                  );
                }
              } else if (message.type === 'document' && message.document) {
                console.log('📄 Procesando documento de:', phoneNumber);
                
                try {
                  // Verificar usuario
                  const userStatus = await checkUserSubscription(phoneNumber);
                  
                  if (!userStatus.isSubscribed || !userStatus.quotaAvailable) {
                    await sendWhatsAppMessage(phoneNumber, 
                      `❌ *Suscripción inactiva o sin cuota*\n\nVe a tu dashboard para activar tu plan.`
                    );
                    continue;
                  }
                  
                  console.log('⬇️ Descargando documento desde WhatsApp Business...');
                  const mediaBuffer = await downloadMedia(message.document.id);
                  
                  console.log('🧠 Procesando documento con IA...');
                  const result = await processReceipt(phoneNumber, mediaBuffer, 'application/pdf');
                  
                  console.log('✅ Documento procesado exitosamente');
                  
                  // Obtener integraciones del usuario
                  const integrations = await getUserIntegrations(phoneNumber);
                  const menu = generateIntegrationsMenu(integrations, phoneNumber);
                  
                  await sendWhatsAppMessage(phoneNumber, menu.message);
                } catch (error) {
                  console.error('❌ Error procesando documento:', error);
                  await sendWhatsAppMessage(phoneNumber, 
                    `❌ *Error procesando documento*\n\nInténtalo de nuevo más tarde.`
                  );
                }
              } else {
                console.log('⚠️ Tipo de mensaje no soportado:', message.type);
                await sendWhatsAppMessage(phoneNumber, 
                  `⚠️ *Tipo de mensaje no soportado*\n\nPor favor, envía una imagen o documento PDF de tu recibo.`
                );
              }
            }
          }
        }
      }
    }
    
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('❌ Error procesando webhook WhatsApp Business:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}