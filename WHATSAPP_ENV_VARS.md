# 🔧 Variables de Entorno para WhatsApp

## 📋 **Variables requeridas en .env.local**

```env
# ==========================================
# SUPABASE CONFIGURATION
# ==========================================
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# ==========================================
# WHATSAPP CONFIGURATION
# ==========================================

# Para testing con Twilio (desarrollo)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Para producción con WhatsApp Business API
WHATSAPP_BUSINESS_TOKEN=your_whatsapp_business_token
WHATSAPP_BUSINESS_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# URL base de tu aplicación
NEXT_PUBLIC_BASE_URL=https://tu-dominio.vercel.app

# ==========================================
# MINDEE API (INVOICE PROCESSING)
# ==========================================
MINDEE_API_KEY=1d6ac579ba024d9fb6c0ebcffdf2b5a0

# ==========================================
# STRIPE CONFIGURATION
# ==========================================
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# ==========================================
# INTEGRATIONS
# ==========================================
XERO_CLIENT_ID=your_xero_client_id
XERO_CLIENT_SECRET=your_xero_client_secret

# ==========================================
# ENCRYPTION
# ==========================================
ENCRYPTION_KEY=your_encryption_key_for_credentials

# ==========================================
# N8N (OPCIONAL - YA NO NECESARIO)
# ==========================================
N8N_SECRET_KEY=your_n8n_secret_key_here
N8N_API_KEY=your_n8n_api_key_here
```

## 📱 **Para configurar WhatsApp con Twilio:**

1. **Crea cuenta en Twilio**: [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)

2. **Obtén credenciales**:
   - `TWILIO_ACCOUNT_SID`: En Console → Account Info
   - `TWILIO_AUTH_TOKEN`: En Console → Account Info
   - `TWILIO_WHATSAPP_NUMBER`: Siempre `whatsapp:+14155238886` (sandbox)

3. **Configura webhook en Twilio**:
   - Ve a Messaging → Try it out → Send a WhatsApp message
   - **When a message comes in**: `https://tu-dominio.vercel.app/api/whatsapp/webhook`
   - **HTTP Method**: POST

4. **Prueba el bot**:
   - Envía `join <código>` al número +1 415 523 8886
   - Envía una imagen de factura
   - Deberías recibir el menú de integraciones

## 🏢 **Para configurar WhatsApp Business API:**

1. **Crea cuenta Meta Business**: [https://business.facebook.com](https://business.facebook.com)

2. **Crea aplicación**:
   - [https://developers.facebook.com](https://developers.facebook.com)
   - Create App → Business → WhatsApp Business API

3. **Obtén credenciales**:
   - `WHATSAPP_BUSINESS_TOKEN`: En WhatsApp → Getting Started → Access Token
   - `WHATSAPP_BUSINESS_PHONE_NUMBER_ID`: En WhatsApp → Getting Started → Phone Number ID
   - `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: Token que tú generas (ej: `mi_token_secreto_123`)

4. **Configura webhook**:
   - En WhatsApp → Configuration → Webhook
   - **Callback URL**: `https://tu-dominio.vercel.app/api/whatsapp/webhook`
   - **Verify Token**: El token que generaste
   - **Webhook Fields**: Selecciona `messages`

## 🔑 **Formato correcto del número de Twilio:**

```env
# ✅ CORRECTO
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# ❌ INCORRECTO
TWILIO_WHATSAPP_NUMBER=+14155238886
TWILIO_WHATSAPP_NUMBER=14155238886
```

## 🚀 **Verificar configuración:**

```bash
# Test webhook
curl -X GET "https://tu-dominio.vercel.app/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=tu_token&hub.challenge=test"

# Debe responder: "test"
```

## 🎯 **Debugging:**

Si no funciona, verifica:
1. ✅ Variables de entorno correctas
2. ✅ Webhook configurado en Twilio/WhatsApp
3. ✅ Usuario conectado al sandbox (`join código`)
4. ✅ Dominio desplegado y accesible
5. ✅ Logs en Vercel para errores 