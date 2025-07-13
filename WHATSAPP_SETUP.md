# 📱 Configuración de WhatsApp con n8n

## 📋 **1. Variables de Entorno Necesarias**

Configura estas variables en tu archivo `.env.local`:

```env
# ==========================================
# SUPABASE CONFIGURATION
# ==========================================
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# ==========================================
# N8N WEBHOOK CONFIGURATION
# ==========================================
N8N_SECRET_KEY=your_n8n_secret_key_here
N8N_API_KEY=your_n8n_api_key_here

# ==========================================
# TWILIO WHATSAPP CONFIGURATION (TESTING)
# ==========================================
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# ==========================================
# WHATSAPP BUSINESS API (PRODUCTION)
# ==========================================
WHATSAPP_BUSINESS_TOKEN=your_whatsapp_business_token
WHATSAPP_BUSINESS_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# ==========================================
# STRIPE CONFIGURATION
# ==========================================
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# ==========================================
# MINDEE API (INVOICE PROCESSING)
# ==========================================
MINDEE_API_KEY=1d6ac579ba024d9fb6c0ebcffdf2b5a0

# ==========================================
# APITEMPLATE.IO (PDF GENERATION)
# ==========================================
APITEMPLATE_API_KEY=bb6eMzI4MDY6Mjk5ODU6NWs4YmhqZ2NGC1ZjUDlNRg=
APITEMPLATE_TEMPLATE_ID=20877b23684b10a8

# ==========================================
# INTEGRATIONS
# ==========================================
XERO_CLIENT_ID=your_xero_client_id
XERO_CLIENT_SECRET=your_xero_client_secret

# ==========================================
# ENCRYPTION
# ==========================================
ENCRYPTION_KEY=your_encryption_key_for_credentials
```

## 🔧 **2. Configuración del Flujo n8n**

### **Tu flujo actual ya está bien estructurado. Aquí está la configuración detallada:**

### **A. Webhook Node (Primer nodo)**
```javascript
// URL del webhook: https://tu-dominio-n8n.com/webhook/whatsapp
// Método: POST
// Tipo de respuesta: JSON
```

### **B. Leer Phone Number (Segundo nodo)**
```javascript
// Este nodo extrae el número de teléfono del mensaje de WhatsApp
// Expresión para obtener el número:
{{ $json.From.replace('whatsapp:', '') }}
```

### **C. HTTP Request - Verificar Usuario (Tercer nodo)**
```javascript
// URL: https://tu-dominio.com/api/users/check-subscription
// Método: POST
// Headers: 
{
  "x-api-key": "{{ $env.N8N_API_KEY }}",
  "Content-Type": "application/json"
}
// Body:
{
  "phoneNumber": "{{ $node['Leer Phone Number'].json.phoneNumber }}"
}
```

### **D. Is User Authorized & Has Quote? (Cuarto nodo)**
```javascript
// Expresión de condición:
{{ $json.isSubscribed === true && $json.quotaAvailable === true }}
```

### **E. Download Media File (Quinto nodo)**
```javascript
// URL: {{ $json.MediaUrl0 }}
// Método: GET
// Descargar archivo binario: true
```

### **F. HTTP Request - Procesar Recibo (Sexto nodo)**
```javascript
// URL: https://tu-dominio.com/api/upload-receipt
// Método: POST
// Headers:
{
  "Authorization": "Bearer {{ $json.userToken }}",
  "Content-Type": "multipart/form-data"
}
// Body: 
{
  "file": "{{ $node['Download Media File'].json }}"
}
```

### **G. Save Receipt Data (Séptimo nodo)**
```javascript
// URL: https://tu-dominio.com/supabase/functions/v1/log-receipt
// Método: POST
// Headers:
{
  "x-api-key": "{{ $env.N8N_SECRET_KEY }}",
  "Content-Type": "application/json"
}
// Body:
{
  "userId": "{{ $json.userId }}",
  "receiptData": "{{ $json.receiptData }}",
  "originalPdfUrl": "{{ $json.pdfUrl }}",
  "status": "procesado"
}
```

### **H. Send WhatsApp Response (Octavo nodo)**
```javascript
// URL: https://api.twilio.com/2010-04-01/Accounts/{{ $env.TWILIO_ACCOUNT_SID }}/Messages.json
// Método: POST
// Authentication: Basic Auth
// User: {{ $env.TWILIO_ACCOUNT_SID }}
// Password: {{ $env.TWILIO_AUTH_TOKEN }}
// Body:
{
  "From": "{{ $env.TWILIO_WHATSAPP_NUMBER }}",
  "To": "{{ $json.phoneNumber }}",
  "Body": "✅ Factura procesada correctamente. PDF generado: {{ $json.pdfUrl }}"
}
```

## 🚀 **3. Migrar de Twilio Sandbox a WhatsApp Business API**

### **Pasos para obtener WhatsApp Business API:**

1. **Registrarse en Meta Business:**
   - Ve a [business.facebook.com](https://business.facebook.com)
   - Crea una cuenta de Meta Business
   - Verifica tu negocio

2. **Configurar WhatsApp Business API:**
   - Ve a [developers.facebook.com](https://developers.facebook.com)
   - Crea una nueva aplicación
   - Añade el producto "WhatsApp Business API"
   - Configura tu número de teléfono

3. **Obtener credenciales:**
   - **Token de acceso permanente**
   - **Phone Number ID**
   - **Webhook Verify Token**

### **Actualizar n8n para usar WhatsApp Business API:**

#### **Nodo de Webhook (Recibir mensajes):**
```javascript
// URL: https://tu-dominio-n8n.com/webhook/whatsapp-business
// Método: POST
// Verificación de webhook:
if ($json['hub.mode'] === 'subscribe' && 
    $json['hub.verify_token'] === $env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
  return { 'hub.challenge': $json['hub.challenge'] };
}
```

#### **Nodo de Envío (Enviar respuesta):**
```javascript
// URL: https://graph.facebook.com/v17.0/{{ $env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID }}/messages
// Método: POST
// Headers:
{
  "Authorization": "Bearer {{ $env.WHATSAPP_BUSINESS_TOKEN }}",
  "Content-Type": "application/json"
}
// Body:
{
  "messaging_product": "whatsapp",
  "to": "{{ $json.phoneNumber }}",
  "type": "text",
  "text": {
    "body": "✅ Factura procesada correctamente. PDF generado: {{ $json.pdfUrl }}"
  }
}
```

## 📊 **4. Estructura de Datos del Webhook**

### **Mensaje de WhatsApp entrante:**
```json
{
  "From": "whatsapp:+34600123456",
  "To": "whatsapp:+14155238886",
  "Body": "Texto del mensaje",
  "MediaUrl0": "https://api.twilio.com/2010-04-01/Accounts/ACxxxx/Messages/MMxxxx/Media/MExxxx",
  "MediaContentType0": "image/jpeg",
  "NumMedia": "1"
}
```

### **Respuesta de verificación de usuario:**
```json
{
  "isSubscribed": true,
  "userId": "uuid-del-usuario",
  "planId": "plan-id",
  "quotaAvailable": true,
  "remainingQuota": 45
}
```

## 🛠️ **5. Comandos para Testing**

### **Probar el webhook localmente:**
```bash
# Instalar ngrok para exponer localhost
npm install -g ngrok

# Exponer puerto 3000
ngrok http 3000

# La URL del webhook será: https://abc123.ngrok.io/api/upload-receipt
```

### **Probar las APIs:**
```bash
# Verificar estado de usuario
curl -X POST https://tu-dominio.com/api/users/check-subscription \
  -H "x-api-key: tu-api-key" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+34600123456"}'

# Procesar factura
curl -X POST https://tu-dominio.com/api/upload-receipt \
  -H "Authorization: Bearer tu-token" \
  -F "file=@test-invoice.jpg"
```

## 📱 **6. Configuración de Webhook en WhatsApp Business**

1. **En Meta for Developers:**
   - Ve a tu aplicación WhatsApp Business
   - Configuración → Webhooks
   - URL del webhook: `https://tu-dominio-n8n.com/webhook/whatsapp-business`
   - Verify Token: tu token de verificación

2. **Eventos a suscribir:**
   - `messages` (mensajes entrantes)
   - `message_deliveries` (confirmaciones de entrega)
   - `message_reads` (confirmaciones de lectura)

## 🔐 **7. Seguridad y Mejores Prácticas**

1. **Validar webhooks:**
   ```javascript
   // Verificar signature de Facebook
   const signature = $headers['x-hub-signature-256'];
   const payload = $json;
   // Validar con tu webhook secret
   ```

2. **Rate limiting:**
   - Implementar límites de velocidad
   - Controlar cuotas de usuarios

3. **Logs y monitoreo:**
   - Registrar todos los mensajes
   - Monitorear errores y fallos

## 📋 **8. Checklist para Go-Live**

- [ ] Variables de entorno configuradas
- [ ] Webhook de n8n funcionando
- [ ] APIs de verificación de usuario probadas
- [ ] Procesamiento de facturas funcionando
- [ ] Generación de PDF funcionando
- [ ] Integraciones con Odoo/Holded/Xero probadas
- [ ] WhatsApp Business API configurada
- [ ] Webhook de WhatsApp verificado
- [ ] Pruebas end-to-end completadas
- [ ] Monitoreo y logs configurados

## 🚨 **9. Troubleshooting Común**

### **Webhook no recibe mensajes:**
- Verificar URL del webhook
- Confirmar que el token de verificación es correcto
- Revisar logs de n8n

### **Usuario no autorizado:**
- Verificar que el número está registrado en tu DB
- Confirmar que la suscripción está activa
- Revisar el campo `telefono` en la tabla `profiles`

### **Error en procesamiento de factura:**
- Verificar que Mindee API key es válida
- Confirmar que el archivo es una imagen válida
- Revisar logs de `/api/upload-receipt`

### **PDF no se genera:**
- Verificar APITemplate.io credentials
- Confirmar que el template ID existe
- Revisar logs de generación de PDF

¿Necesitas ayuda con algún paso específico de la configuración? 