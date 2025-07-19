// WhatsApp Business API Client
interface WhatsAppMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text' | 'template';
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: any[];
  };
}

interface WhatsAppWebhookPayload {
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
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: 'text' | 'image' | 'document' | 'audio' | 'video';
          text?: {
            body: string;
          };
          image?: {
            id: string;
            mime_type: string;
            sha256: string;
            caption?: string;
          };
          document?: {
            id: string;
            mime_type: string;
            sha256: string;
            filename?: string;
            caption?: string;
          };
          audio?: {
            id: string;
            mime_type: string;
            sha256: string;
          };
          video?: {
            id: string;
            mime_type: string;
            sha256: string;
            caption?: string;
          };
        }>;
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

class WhatsAppBusinessAPI {
  private accessToken: string;
  private phoneNumberId: string;
  private baseUrl: string;

  constructor(accessToken: string, phoneNumberId: string) {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
    this.baseUrl = 'https://graph.facebook.com/v18.0';
  }

  async sendMessage(to: string, message: string): Promise<any> {
    const cleanTo = this.cleanPhoneNumber(to);
    
    const payload: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      to: cleanTo,
      type: 'text',
      text: {
        body: message
      }
    };

    console.log('📤 Enviando mensaje WhatsApp Business a:', cleanTo);
    
    try {
      const response = await fetch(`${this.baseUrl}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Error enviando mensaje WhatsApp Business:', errorData);
        throw new Error(`WhatsApp Business API Error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      console.log('✅ Mensaje WhatsApp Business enviado exitosamente:', result);
      return result;
    } catch (error) {
      console.error('❌ Error en sendMessage:', error);
      throw error;
    }
  }

  async sendTemplate(to: string, templateName: string, languageCode: string = 'es', components?: any[]): Promise<any> {
    const cleanTo = this.cleanPhoneNumber(to);
    
    const payload: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      to: cleanTo,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode
        },
        components: components || []
      }
    };

    console.log('📤 Enviando template WhatsApp Business a:', cleanTo);
    
    try {
      const response = await fetch(`${this.baseUrl}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Error enviando template WhatsApp Business:', errorData);
        throw new Error(`WhatsApp Business API Error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      console.log('✅ Template WhatsApp Business enviado exitosamente:', result);
      return result;
    } catch (error) {
      console.error('❌ Error en sendTemplate:', error);
      throw error;
    }
  }

  async downloadMedia(mediaId: string): Promise<Buffer> {
    console.log('⬇️ Descargando archivo multimedia desde WhatsApp Business:', mediaId);
    
    try {
      // Primero obtener la URL del archivo
      const mediaResponse = await fetch(`${this.baseUrl}/${mediaId}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        }
      });

      if (!mediaResponse.ok) {
        const errorData = await mediaResponse.json();
        console.error('❌ Error obteniendo URL del archivo:', errorData);
        throw new Error(`WhatsApp Business API Error: ${mediaResponse.status} - ${JSON.stringify(errorData)}`);
      }

      const mediaData = await mediaResponse.json();
      const mediaUrl = mediaData.url;

      // Ahora descargar el archivo
      const fileResponse = await fetch(mediaUrl, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        }
      });

      if (!fileResponse.ok) {
        throw new Error(`Error descargando archivo: ${fileResponse.status}`);
      }

      const arrayBuffer = await fileResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      console.log('✅ Archivo descargado exitosamente desde WhatsApp Business, tamaño:', buffer.length, 'bytes');
      return buffer;
    } catch (error) {
      console.error('❌ Error descargando archivo multimedia:', error);
      throw error;
    }
  }

  verifyWebhook(token: string, verifyToken: string): boolean {
    return token === verifyToken;
  }

  private cleanPhoneNumber(phoneNumber: string): string {
    // Remover todos los caracteres no numéricos
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Si empieza con 34 (España), mantenerlo
    if (cleaned.startsWith('34')) {
      return cleaned;
    }
    
    // Si empieza con 0, removerlo y agregar 34
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // Si no tiene código de país, agregar 34 (España)
    if (cleaned.length === 9) {
      cleaned = '34' + cleaned;
    }
    
    return cleaned;
  }
}

// Función para crear instancia de WhatsApp Business API
export function createWhatsAppBusinessAPI(): WhatsAppBusinessAPI {
  const accessToken = process.env.WHATSAPP_BUSINESS_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    throw new Error('WhatsApp Business API configuration is missing. Please set WHATSAPP_BUSINESS_ACCESS_TOKEN and WHATSAPP_BUSINESS_PHONE_NUMBER_ID environment variables.');
  }

  return new WhatsAppBusinessAPI(accessToken, phoneNumberId);
}

// Función para limpiar número de teléfono
export function cleanPhoneNumberForWhatsApp(phoneNumber: string): string {
  const api = new WhatsAppBusinessAPI('', '');
  return api['cleanPhoneNumber'](phoneNumber);
}

export type { WhatsAppMessage, WhatsAppWebhookPayload };
export { WhatsAppBusinessAPI };
