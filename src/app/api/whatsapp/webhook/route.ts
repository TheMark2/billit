import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabaseClient';
import { checkUserSubscription } from '@/utils/supabaseClient';
import { processWithMindee } from '@/app/api/upload-receipt/route';

interface WhatsAppMessage {
  From: string;
  To: string;
  Body?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  NumMedia: string;
}

interface WhatsAppBusinessWebhook {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          text?: { body: string };
          image?: {
            mime_type: string;
            sha256: string;
            id: string;
          };
          type: string;
        }>;
      };
    }>;
  }>;
}

// Función para limpiar número de teléfono
function cleanPhoneNumber(phone: string): string {
  return phone.replace('whatsapp:', '').replace('+', '');
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
      .select('id, empresa_id, telefono')
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
    .eq('empresa_id', profile.empresa_id)
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
    .eq('empresa_id', profile.empresa_id)
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
    .eq('empresa_id', profile.empresa_id)
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
      message: `❌ *No tienes integraciones configuradas*\n\nVe a tu dashboard para configurar Odoo, Holded o Xero.`,
      hasIntegrations: false
    };
  }

  let message = `✅ *Factura procesada correctamente*\n\n🔗 *Selecciona dónde enviar la factura:*\n\n`;
  
  integrations.forEach((integration, index) => {
    const numero = index + 1;
    message += `${numero}. ${integration.icon} ${integration.name}\n`;
  });

  message += `\n💬 *Responde con el número de tu elección*`;

  return {
    message,
    hasIntegrations: true,
    integrations
  };
}

// Función para enviar mensaje de WhatsApp
async function sendWhatsAppMessage(phoneNumber: string, message: string) {
  const isTwilio = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN;
  const isWhatsAppBusiness = process.env.WHATSAPP_BUSINESS_TOKEN;

  if (isTwilio) {
    // Usar Twilio (para testing)
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`
        },
        body: new URLSearchParams({
          From: process.env.TWILIO_WHATSAPP_NUMBER!,
          To: `whatsapp:+${phoneNumber}`,
          Body: message
        })
      }
    );
    return response.json();
  } else if (isWhatsAppBusiness) {
    // Usar WhatsApp Business API (para producción)
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_BUSINESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'text',
          text: {
            body: message
          }
        })
      }
    );
    return response.json();
  }

  throw new Error('No WhatsApp service configured');
}

// Función para descargar archivo multimedia
async function downloadMedia(mediaUrl: string): Promise<Buffer> {
  console.log('⬇️ Descargando archivo multimedia desde:', mediaUrl);
  
  // Usar autenticación básica para Twilio
  const authString = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  
  const response = await fetch(mediaUrl, {
    headers: {
      'Authorization': `Basic ${authString}`
    }
  });
  
  console.log('📥 Respuesta de descarga:', response.status, response.statusText);
  
  if (!response.ok) {
    console.log('❌ Error descargando archivo:', response.status, response.statusText);
    throw new Error(`Failed to download media: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log('✅ Archivo descargado exitosamente, tamaño:', buffer.length, 'bytes');
  
  return buffer;
}

// Función para procesar recibo
async function processReceipt(phoneNumber: string, mediaBuffer: Buffer, mediaType: string) {
  try {
    // Crear un File object desde el buffer
    const file = new File([mediaBuffer], 'receipt.jpg', { type: mediaType });
    
    // Llamar directamente a la función de procesamiento de Mindee
    console.log('🧠 Llamando a Mindee API...');
    const mindeeResult = await processWithMindee(file);
    console.log('📊 Resultado de Mindee:', mindeeResult);
    
    if (!mindeeResult.success) {
      console.log('❌ Error de Mindee:', mindeeResult.error);
      throw new Error(mindeeResult.error || 'Error procesando factura');
    }
    
    console.log('✅ Mindee procesó exitosamente');
    
    // Obtener el usuario por número de teléfono
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

    let profile = null;
    let foundWithFormat = '';

    // Buscar el usuario con diferentes formatos
    for (const phoneFormat of phoneFormats) {
      console.log(`🔎 processReceipt - Probando formato: "${phoneFormat}"`);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, empresa_id, telefono')
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
    
    // Guardar el recibo en la base de datos
    console.log('💾 Guardando recibo en base de datos...');
    const { data: receipt, error } = await supabase
      .from('receipts')
      .insert({
        user_id: profile.id,
        empresa_id: profile.empresa_id,
        fecha_emision: mindeeResult.data.date || new Date().toISOString().split('T')[0],
        proveedor: mindeeResult.data.supplier_name || 'Desconocido',
        numero_factura: mindeeResult.data.invoice_number || null,
        total: mindeeResult.data.total_amount || 0,
        moneda: mindeeResult.data.currency || 'EUR',
        estado: 'procesado',
        file_name: 'whatsapp_receipt.jpg',
        file_type: 'image/jpeg',
        status: 'completed',
        metadatos: mindeeResult.data,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.log('❌ Error guardando recibo:', error);
      throw new Error(`Error guardando recibo: ${error.message}`);
    }
    
    console.log('✅ Recibo guardado exitosamente con ID:', receipt.id);
    
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
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      // WhatsApp Business API
      const body: WhatsAppBusinessWebhook = await request.json();
      
      if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry) {
          for (const change of entry.changes) {
            if (change.value.messages) {
              for (const message of change.value.messages) {
                const phoneNumber = message.from;
                
                if (message.type === 'text' && message.text) {
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
                    
                    console.log('✅ Usuario verificado, procesando imagen...');
                    
                    // Obtener URL del archivo
                    console.log('📥 Obteniendo URL del archivo con ID:', message.image.id);
                    const mediaResponse = await fetch(
                      `https://graph.facebook.com/v18.0/${message.image.id}`,
                      {
                        headers: {
                          'Authorization': `Bearer ${process.env.WHATSAPP_BUSINESS_TOKEN}`
                        }
                      }
                    );
                    
                    const mediaData = await mediaResponse.json();
                    console.log('🔗 Respuesta de Facebook API:', mediaData);
                    
                    if (!mediaData.url) {
                      console.log('❌ No se encontró URL del archivo');
                      throw new Error('No media URL found');
                    }
                    
                    console.log('⬇️ Descargando archivo desde:', mediaData.url);
                    const mediaBuffer = await downloadMedia(mediaData.url);
                    console.log('✅ Archivo descargado, tamaño:', mediaBuffer.length, 'bytes');
                    
                    // Procesar recibo
                    console.log('🔄 Procesando recibo...');
                    const result = await processReceipt(phoneNumber, mediaBuffer, message.image.mime_type);
                    console.log('📊 Resultado del procesamiento:', result);
                    
                    console.log('✅ Recibo procesado exitosamente');
                    
                    // Obtener integraciones y enviar menú
                    console.log('🔍 Obteniendo integraciones...');
                    const integrations = await getUserIntegrations(phoneNumber);
                    console.log('🔗 Integraciones encontradas:', integrations.length);
                    
                    console.log('📋 Generando menú...');
                    const menu = generateIntegrationsMenu(integrations, phoneNumber);
                    console.log('📤 Enviando menú al usuario...');
                    
                    await sendWhatsAppMessage(phoneNumber, menu.message);
                    console.log('✅ Menú enviado correctamente');
                  } catch (error) {
                    console.error('❌ Error completo en procesamiento de imagen:', error);
                    await sendWhatsAppMessage(phoneNumber, 
                      `❌ *Error al procesar factura*\n\nHubo un problema procesando tu factura. Inténtalo nuevamente.`
                    );
                  }
                }
              }
            }
          }
        }
      }
    } else {
      // Twilio webhook (para testing)
      const formData = await request.formData();
      const message: WhatsAppMessage = {
        From: formData.get('From') as string,
        To: formData.get('To') as string,
        Body: formData.get('Body') as string || '',
        MediaUrl0: formData.get('MediaUrl0') as string || '',
        MediaContentType0: formData.get('MediaContentType0') as string || '',
        NumMedia: formData.get('NumMedia') as string || '0'
      };
      
      const phoneNumber = cleanPhoneNumber(message.From);
      const hasMedia = parseInt(message.NumMedia) > 0;
      
      if (hasMedia && message.MediaUrl0) {
        // Verificar usuario
        const userStatus = await checkUserSubscription(phoneNumber);
        
        if (!userStatus.isSubscribed || !userStatus.quotaAvailable) {
          await sendWhatsAppMessage(phoneNumber, 
            `❌ *Suscripción inactiva o sin cuota*\n\nVe a tu dashboard para activar tu plan.`
          );
          return NextResponse.json({ status: 'error', message: 'User not authorized' });
        }
        
        // Verificar que el archivo multimedia existe
        if (!message.MediaUrl0 || !message.MediaContentType0) {
          await sendWhatsAppMessage(phoneNumber, 
            `❌ *Error al procesar archivo*\n\nNo se pudo obtener la información del archivo multimedia.`
          );
          return NextResponse.json({ status: 'error', message: 'No media URL or content type' });
        }
        
        // Descargar archivo
        const mediaBuffer = await downloadMedia(message.MediaUrl0);
        
        // Procesar recibo
        try {
          const result = await processReceipt(phoneNumber, mediaBuffer, message.MediaContentType0);
          
          if (result.success) {
            // Obtener integraciones y enviar menú
            const integrations = await getUserIntegrations(phoneNumber);
            const menu = generateIntegrationsMenu(integrations, phoneNumber);
            await sendWhatsAppMessage(phoneNumber, menu.message);
          } else {
            await sendWhatsAppMessage(phoneNumber, 
              `❌ *Error al procesar factura*\n\nHubo un problema procesando tu factura. Inténtalo nuevamente.`
            );
          }
        } catch (error) {
          await sendWhatsAppMessage(phoneNumber, 
            `❌ *Error al procesar factura*\n\nHubo un problema procesando tu factura. Inténtalo nuevamente.`
          );
        }
      } else if (message.Body) {
        // Manejar comando de texto
        await handleTextCommand(message.From, message.Body);
      }
    }
    
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    return NextResponse.json({ 
      status: 'error', 
      message: 'Internal server error' 
    }, { status: 500 });
  }
} 