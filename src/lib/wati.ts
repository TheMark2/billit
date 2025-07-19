// WATI WhatsApp API Configuration
export interface WatiConfig {
  apiEndpoint: string;
  apiToken: string;
  webhookVerifyToken: string;
}

export interface WatiMessage {
  id: string;
  created: string;
  whatsappMessageId: string;
  conversationId: string;
  ticketId: string;
  text: string | null;
  type: 'text' | 'image' | 'document' | 'location' | 'voice' | 'audio' | 'button' | 'video' | 'sticker';
  data: string | null; // Media path if message is media, null for text message
  timestamp: string;
  owner: boolean; // true = sent by WATI, false = incoming message
  eventType: string;
  statusString: string;
  avatarUrl: string | null;
  assignedId: string | null;
  operatorName: string | null;
  operatorEmail: string | null;
  waId: string; // WhatsApp ID: country code + phone number
  senderName: string;
  messageContact: any | null;
  listReply: any | null;
  replyContextId: string | null;
}

export interface WatiWebhookPayload {
  eventType: 'message' | 'newContactMessageReceived' | 'sessionMessageSent' | 'templateMessageSent' | 'messageDelivered' | 'messageRead' | 'messageReplied' | 'templateMessageFailed';
  id: string;
  created?: string;
  whatsappMessageId?: string;
  conversationId?: string;
  ticketId?: string;
  text?: string;
  type?: string;
  data?: string | null;
  timestamp?: string;
  owner?: boolean;
  statusString?: string;
  assignedId?: string;
  operatorName?: string;
  operatorEmail?: string;
  waId: string;
  senderName?: string;
  messageContact?: any;
  listReply?: any;
  replyContextId?: string;
  // For new contact messages
  sourceId?: string | null;
  sourceUrl?: string | null;
  sourceType?: number;
}

export class WatiAPI {
  private config: WatiConfig;

  constructor(config: WatiConfig) {
    this.config = config;
  }

  /**
   * Send a session message to an opened WhatsApp session
   */
  async sendSessionMessage(whatsappNumber: string, message: string): Promise<any> {
    const url = `${this.config.apiEndpoint}/api/v1/sendSessionMessage/${whatsappNumber}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messageText: message
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WATI API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Send a template message (for new conversations or after 24h window)
   */
  async sendTemplateMessage(whatsappNumber: string, templateName: string, parameters: any[] = []): Promise<any> {
    const url = `${this.config.apiEndpoint}/api/v1/sendTemplateMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        whatsappNumber,
        template_name: templateName,
        broadcast_name: `template_${Date.now()}`,
        parameters
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WATI API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Download media file from WATI
   */
  async downloadMedia(mediaUrl: string): Promise<Buffer> {
    console.log('⬇️ Descargando archivo multimedia desde WATI:', mediaUrl);
    
    const response = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`
      }
    });
    
    console.log('📥 Respuesta de descarga WATI:', response.status, response.statusText);
    
    if (!response.ok) {
      console.log('❌ Error descargando archivo desde WATI:', response.status, response.statusText);
      throw new Error(`Failed to download media from WATI: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('✅ Archivo descargado exitosamente desde WATI, tamaño:', buffer.length, 'bytes');
    
    return buffer;
  }

  /**
   * Verify webhook signature (if WATI provides signature verification)
   */
  verifyWebhook(payload: string, signature: string): boolean {
    // WATI webhook verification logic would go here
    // For now, we'll just verify the token in the webhook endpoint
    return true;
  }
}

// Helper function to create WATI API instance
export function createWatiAPI(): WatiAPI {
  const config: WatiConfig = {
    apiEndpoint: process.env.WATI_API_ENDPOINT || '',
    apiToken: process.env.WATI_API_TOKEN || '',
    webhookVerifyToken: process.env.WATI_WEBHOOK_VERIFY_TOKEN || ''
  };

  if (!config.apiEndpoint || !config.apiToken) {
    throw new Error('WATI configuration is missing. Please set WATI_API_ENDPOINT and WATI_API_TOKEN environment variables.');
  }

  return new WatiAPI(config);
}

// Helper function to clean phone number for WATI format
export function cleanPhoneNumberForWati(phone: string): string {
  // Remove any prefixes and normalize to international format
  let cleaned = phone.replace(/^whatsapp:/, '').replace(/^\+/, '');
  
  // If it starts with country code, keep it as is
  // If it's a Spanish number without country code, add 34
  if (!cleaned.startsWith('34') && cleaned.length === 9) {
    cleaned = '34' + cleaned;
  }
  
  return cleaned;
}
