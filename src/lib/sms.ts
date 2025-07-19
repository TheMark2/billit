import twilio from 'twilio';

// Configuración de Twilio SMS
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !twilioPhoneNumber) {
  console.warn('⚠️ Twilio SMS credentials not configured');
}

const client = twilio(accountSid, authToken);

// Interfaces para SMS
export interface SMSMessage {
  to: string;
  body: string;
  mediaUrl?: string[];
}

export interface SMSWebhookPayload {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  NumMedia: string;
  [key: string]: string | undefined;
}

// Clase para manejar SMS con Twilio
export class TwilioSMS {
  private client: twilio.Twilio;
  private fromNumber: string;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.client = twilio(accountSid, authToken);
    this.fromNumber = fromNumber;
  }

  // Enviar mensaje SMS
  async sendMessage(to: string, body: string, mediaUrl?: string[]): Promise<any> {
    try {
      console.log('📱 Enviando SMS a:', to);
      console.log('💬 Mensaje:', body);
      
      const messageOptions: any = {
        body,
        from: this.fromNumber,
        to: cleanPhoneNumberForSMS(to),
      };

      if (mediaUrl && mediaUrl.length > 0) {
        messageOptions.mediaUrl = mediaUrl;
      }

      const message = await this.client.messages.create(messageOptions);
      
      console.log('✅ SMS enviado exitosamente:', message.sid);
      return message;
    } catch (error) {
      console.error('❌ Error enviando SMS:', error);
      throw error;
    }
  }

  // Descargar archivo multimedia de SMS
  async downloadMedia(mediaUrl: string): Promise<Buffer> {
    try {
      console.log('📥 Descargando media de SMS:', mediaUrl);
      
      const response = await fetch(mediaUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Error descargando media: ${response.status} ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      console.log('✅ Media descargada exitosamente, tamaño:', buffer.length, 'bytes');
      
      return buffer;
    } catch (error) {
      console.error('❌ Error descargando media de SMS:', error);
      throw error;
    }
  }
}

// Función para crear instancia de TwilioSMS
export function createTwilioSMS(): TwilioSMS | null {
  if (!accountSid || !authToken || !twilioPhoneNumber) {
    console.warn('⚠️ Twilio SMS no configurado correctamente');
    return null;
  }

  return new TwilioSMS(accountSid, authToken, twilioPhoneNumber);
}

// Función para limpiar número de teléfono para SMS
export function cleanPhoneNumberForSMS(phoneNumber: string): string {
  // Remover espacios y caracteres especiales
  let cleaned = phoneNumber.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  
  // Si no tiene código de país, añadir +34 (España)
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('34')) {
      cleaned = '+' + cleaned;
    } else if (cleaned.length === 9) {
      cleaned = '+34' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  
  console.log('📞 Número limpiado para SMS:', phoneNumber, '->', cleaned);
  return cleaned;
}

// Función para validar si es un número de teléfono válido
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const cleaned = cleanPhoneNumberForSMS(phoneNumber);
  // Validar formato básico de número internacional
  return /^\+\d{10,15}$/.test(cleaned);
}
