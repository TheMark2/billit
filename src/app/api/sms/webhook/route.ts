import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabaseClient';
import { checkUserSubscription } from '@/utils/supabaseClient';
import { uploadOriginalImage } from '@/lib/supabase-storage';
import { createTwilioSMS, cleanPhoneNumberForSMS, type SMSWebhookPayload } from '@/lib/sms';

// Función para limpiar número de teléfono
function cleanPhoneNumber(phoneNumber: string): string {
  return cleanPhoneNumberForSMS(phoneNumber);
}

// Función para obtener perfil del usuario
async function getUserProfile(phoneNumber: string) {
  const supabase = getSupabaseService();
  
  // Intentar diferentes formatos del número
  const phoneFormats = [
    phoneNumber, // Formato original
    phoneNumber.replace('+', ''), // Quitar +
    phoneNumber.replace(/^34/, ''), // Quitar 34 del principio
    phoneNumber.replace(/^(\+34|34)/, ''), // Quitar +34 o 34 del principio
    `+34${phoneNumber}`, // Añadir +34
    phoneNumber.replace('+34', ''), // Quitar +34
    `+${phoneNumber}`, // Añadir +
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
      break;
    }
  }

  if (profile) {
    console.log('✅ getUserProfile - Usuario encontrado:', profile.id, 'con formato:', foundWithFormat);
  } else {
    console.log('❌ getUserProfile - Usuario no encontrado para ningún formato');
  }

  return profile;
}

// Función para obtener integraciones del usuario
async function getUserIntegrations(phoneNumber: string) {
  const profile = await getUserProfile(phoneNumber);
  
  if (!profile) {
    console.log('❌ getUserIntegrations - No se encontró perfil para:', phoneNumber);
    return [];
  }

  const supabase = getSupabaseService();
  
  console.log('🔍 getUserIntegrations - Buscando integraciones para usuario:', profile.id);
  
  const { data: integrations, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', profile.id)
    .eq('is_active', true);

  if (error) {
    console.error('❌ getUserIntegrations - Error:', error);
    return [];
  }

  console.log('✅ getUserIntegrations - Integraciones encontradas:', integrations?.length || 0);
  return integrations || [];
}

// Función para generar menú de integraciones
function generateIntegrationsMenu(integrations: any[], phoneNumber: string): string {
  if (!integrations || integrations.length === 0) {
    return `❌ No tienes integraciones configuradas.

Para configurar integraciones:
1. Ve a tu dashboard: https://reciptai.com/dashboard
2. Accede a la sección "Integraciones"
3. Configura Holded, Odoo, Xero u otras

Una vez configuradas, podrás enviar tickets directamente desde SMS.`;
  }

  let menu = `🔗 *Integraciones disponibles:*\n\n`;
  
  integrations.forEach((integration, index) => {
    menu += `${index + 1}. ${integration.integration_type.toUpperCase()}\n`;
  });
  
  menu += `\nResponde con el número de la integración para enviar el último ticket procesado.`;
  
  return menu;
}

// Función para enviar mensaje SMS
async function sendSMSMessage(phoneNumber: string, message: string): Promise<void> {
  try {
    const smsClient = createTwilioSMS();
    if (!smsClient) {
      console.error('❌ Cliente SMS no disponible');
      return;
    }

    await smsClient.sendMessage(phoneNumber, message);
  } catch (error) {
    console.error('❌ Error enviando SMS:', error);
  }
}

// Función para descargar archivo multimedia
async function downloadMedia(mediaUrl: string): Promise<Buffer> {
  try {
    const smsClient = createTwilioSMS();
    if (!smsClient) {
      throw new Error('Cliente SMS no disponible');
    }

    return await smsClient.downloadMedia(mediaUrl);
  } catch (error) {
    console.error('❌ Error descargando media:', error);
    throw error;
  }
}

// Función para procesar recibo usando la API de Mindee directamente
async function processReceipt(phoneNumber: string, mediaBuffer: Buffer, mediaType: string) {
  try {
    console.log('🎯 processReceipt - Iniciando procesamiento para:', phoneNumber);
    console.log('📄 processReceipt - Tipo de media:', mediaType);
    console.log('📊 processReceipt - Tamaño del buffer:', mediaBuffer.length, 'bytes');

    // Obtener perfil del usuario
    const profile = await getUserProfile(phoneNumber);
    if (!profile) {
      console.log('❌ processReceipt - Usuario no encontrado');
      await sendSMSMessage(phoneNumber, 
        `❌ No tienes una cuenta registrada con este número.

Para usar ReciptAI:
1. Regístrate en: https://reciptai.com
2. Añade tu número de teléfono en tu perfil
3. ¡Empieza a enviar tickets por SMS!`
      );
      return;
    }

    console.log('✅ processReceipt - Usuario encontrado:', profile.id);

    // Verificar suscripción
    const subscription = await checkUserSubscription(phoneNumber);
    console.log('💳 processReceipt - Suscripción:', subscription);

    if (!subscription.isSubscribed) {
      console.log('❌ processReceipt - Suscripción inactiva');
      await sendSMSMessage(phoneNumber, 
        `❌ Tu suscripción no está activa.

Para continuar usando ReciptAI:
1. Ve a: https://reciptai.com/dashboard/pricing
2. Activa tu suscripción
3. ¡Vuelve a enviar tus tickets!`
      );
      return;
    }

    // Verificar límites de la suscripción
    if (!subscription.quotaAvailable) {
      console.log('❌ processReceipt - Límite de tickets alcanzado');
      await sendSMSMessage(phoneNumber, 
        `❌ Has alcanzado el límite de tickets este mes.

Para procesar más tickets:
1. Ve a: https://reciptai.com/dashboard/pricing
2. Mejora tu plan
3. ¡Continúa digitalizando tickets!`
      );
      return;
    }

    console.log('✅ processReceipt - Suscripción válida, procesando ticket...');

    // Crear archivo temporal para Mindee
    const fileName = `sms-receipt-${Date.now()}.${mediaType.includes('pdf') ? 'pdf' : 'jpg'}`;
    
    // Subir imagen original al storage
    console.log('📤 processReceipt - Subiendo imagen original...');
    let imageUploadResult;
    try {
      imageUploadResult = await uploadOriginalImage(mediaBuffer, fileName, profile.id);
      console.log('✅ processReceipt - Imagen subida:', imageUploadResult.path);
    } catch (uploadError) {
      console.error('❌ processReceipt - Error subiendo imagen:', uploadError);
      await sendSMSMessage(phoneNumber, '❌ Error procesando la imagen. Inténtalo de nuevo.');
      return;
    }

    // Procesar con Mindee API directamente
    console.log('🧠 processReceipt - Procesando con Mindee...');
    
    try {
      // Llamar a la API de upload-receipt con FormData
      const formData = new FormData();
      const blob = new Blob([mediaBuffer], { type: mediaType });
      const file = new File([blob], fileName, { type: mediaType });
      formData.append('file', file);
      formData.append('userId', profile.id);
      formData.append('source', 'sms');
      if (imageUploadResult.path) {
        formData.append('originalImagePath', imageUploadResult.path);
      }
      if (imageUploadResult.publicUrl) {
        formData.append('originalImageUrl', imageUploadResult.publicUrl);
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/upload-receipt`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.data) {
        console.log('✅ processReceipt - Procesado exitosamente:', result.data.id);

        // Enviar confirmación por SMS
        const confirmationMessage = `✅ *Ticket procesado exitosamente*

📄 *Detalles:*
• Proveedor: ${result.data.proveedor || 'No detectado'}
• Total: ${result.data.total ? `${result.data.total}€` : 'No detectado'}
• Fecha: ${result.data.fecha_emision || 'No detectada'}

🔗 Ver detalles: https://reciptai.com/dashboard/recibos

💡 *Comandos disponibles:*
• "ayuda" - Ver todos los comandos
• "estado" - Ver tu estado de cuenta
• "integraciones" - Configurar envíos automáticos`;

        await sendSMSMessage(phoneNumber, confirmationMessage);
      } else {
        throw new Error(result.error || 'Error procesando ticket');
      }

    } catch (mindeeError) {
      console.error('❌ processReceipt - Error con Mindee:', mindeeError);
      await sendSMSMessage(phoneNumber, 
        `❌ Error procesando el ticket. 

Posibles causas:
• La imagen no es clara
• No es un ticket válido
• Error temporal del servicio

Inténtalo de nuevo con una imagen más clara.`
      );
    }

  } catch (error) {
    console.error('❌ processReceipt - Error general:', error);
    await sendSMSMessage(phoneNumber, '❌ Error procesando el ticket. Inténtalo de nuevo.');
  }
}

// Función para manejar comandos de texto
async function handleTextCommand(phoneNumber: string, command: string) {
  const lowerCommand = command.toLowerCase().trim();
  
  console.log('💬 handleTextCommand - Comando recibido:', lowerCommand, 'de:', phoneNumber);

  switch (lowerCommand) {
    case 'ayuda':
    case 'help':
      await sendSMSMessage(phoneNumber, 
        `🤖 *ReciptAI - Comandos disponibles:*

📸 *Enviar tickets:*
• Envía una foto de tu ticket
• Formatos: JPG, PNG, PDF

💬 *Comandos de texto:*
• "ayuda" - Ver esta ayuda
• "estado" - Ver tu estado de cuenta
• "integraciones" - Configurar envíos automáticos

🔗 *Dashboard:* https://reciptai.com/dashboard

¿Necesitas ayuda? Contacta con soporte.`
      );
      break;

    case 'estado':
    case 'status':
      const profile = await getUserProfile(phoneNumber);
      if (!profile) {
        await sendSMSMessage(phoneNumber, 
          `❌ No tienes una cuenta registrada.

Regístrate en: https://reciptai.com`
        );
        return;
      }

      const subscription = await checkUserSubscription(phoneNumber);
      
      await sendSMSMessage(phoneNumber, 
        `📊 *Tu estado de cuenta:*

💳 Suscripción: ${subscription.isSubscribed ? 'Activa' : 'Inactiva'}
📄 Cuota disponible: ${subscription.quotaAvailable ? 'Sí' : 'No'}
✅ Tickets restantes: ${subscription.remainingQuota}

🔗 Dashboard: https://reciptai.com/dashboard`
      );
      break;

    case 'integraciones':
    case 'integrations':
      const integrations = await getUserIntegrations(phoneNumber);
      const menuMessage = generateIntegrationsMenu(integrations, phoneNumber);
      await sendSMSMessage(phoneNumber, menuMessage);
      break;

    default:
      // Verificar si es un número (selección de integración)
      const integrationNumber = parseInt(lowerCommand);
      if (!isNaN(integrationNumber) && integrationNumber > 0) {
        const integrations = await getUserIntegrations(phoneNumber);
        
        if (integrationNumber <= integrations.length) {
          const selectedIntegration = integrations[integrationNumber - 1];
          await sendSMSMessage(phoneNumber, 
            `🔗 Función de integración con ${selectedIntegration.integration_type.toUpperCase()} en desarrollo.

Por ahora, puedes enviar tickets manualmente desde:
https://reciptai.com/dashboard/recibos`
          );
        } else {
          await sendSMSMessage(phoneNumber, '❌ Número de integración inválido. Envía "integraciones" para ver las opciones.');
        }
      } else {
        await sendSMSMessage(phoneNumber, 
          `❓ Comando no reconocido: "${command}"

Envía "ayuda" para ver los comandos disponibles.`
        );
      }
      break;
  }
}

// Handler GET - Verificación del webhook (Twilio no lo requiere, pero lo mantenemos por compatibilidad)
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    status: 'SMS Webhook activo',
    timestamp: new Date().toISOString()
  });
}

// Handler POST - Procesar mensajes SMS entrantes
export async function POST(request: NextRequest) {
  try {
    console.log('📨 SMS Webhook - Mensaje entrante recibido');
    
    // Obtener datos del formulario (Twilio envía form data)
    const formData = await request.formData();
    
    // Convertir FormData a objeto
    const formDataObj: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      formDataObj[key] = value.toString();
    }
    
    // Crear payload con propiedades requeridas
    const payload: SMSWebhookPayload = {
      MessageSid: formDataObj.MessageSid || '',
      AccountSid: formDataObj.AccountSid || '',
      From: formDataObj.From || '',
      To: formDataObj.To || '',
      Body: formDataObj.Body || '',
      NumMedia: formDataObj.NumMedia || '0',
      MediaUrl0: formDataObj.MediaUrl0,
      MediaContentType0: formDataObj.MediaContentType0,
      ...formDataObj
    };
    
    console.log('📋 SMS Webhook - Payload recibido:', JSON.stringify(payload, null, 2));

    const { From: fromNumber, Body: messageBody, NumMedia, MediaUrl0, MediaContentType0 } = payload;

    if (!fromNumber) {
      console.log('❌ SMS Webhook - Número de origen faltante');
      return NextResponse.json({ error: 'Número de origen requerido' }, { status: 400 });
    }

    const cleanedPhoneNumber = cleanPhoneNumber(fromNumber);
    console.log('📞 SMS Webhook - Número limpiado:', cleanedPhoneNumber);

    // Verificar si hay archivos multimedia
    const hasMedia = NumMedia && parseInt(NumMedia) > 0;
    
    if (hasMedia && MediaUrl0) {
      console.log('📎 SMS Webhook - Archivo multimedia detectado');
      console.log('🔗 SMS Webhook - URL del archivo:', MediaUrl0);
      console.log('📄 SMS Webhook - Tipo de contenido:', MediaContentType0);

      try {
        // Descargar el archivo
        const mediaBuffer = await downloadMedia(MediaUrl0);
        
        // Procesar el recibo
        await processReceipt(cleanedPhoneNumber, mediaBuffer, MediaContentType0 || 'image/jpeg');
        
      } catch (error) {
        console.error('❌ SMS Webhook - Error procesando multimedia:', error);
        await sendSMSMessage(cleanedPhoneNumber, '❌ Error procesando el archivo. Inténtalo de nuevo.');
      }
      
    } else if (messageBody && messageBody.trim()) {
      console.log('💬 SMS Webhook - Mensaje de texto recibido:', messageBody);
      
      // Manejar comando de texto
      await handleTextCommand(cleanedPhoneNumber, messageBody.trim());
      
    } else {
      console.log('❓ SMS Webhook - Mensaje vacío o sin contenido válido');
      await sendSMSMessage(cleanedPhoneNumber, 
        `❓ No se detectó contenido válido.

Para usar ReciptAI:
📸 Envía una foto de tu ticket
💬 Envía "ayuda" para ver comandos

🔗 Dashboard: https://reciptai.com/dashboard`
      );
    }

    return NextResponse.json({ status: 'ok' });

  } catch (error) {
    console.error('❌ SMS Webhook - Error general:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
