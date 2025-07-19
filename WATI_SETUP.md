# Configuración de WATI WhatsApp API

Este documento describe cómo configurar la integración con WATI para reemplazar Twilio en el sistema de WhatsApp.

## Variables de Entorno Requeridas

Agrega las siguientes variables a tu archivo `.env.local`:

```bash
# WATI Configuration
WATI_API_ENDPOINT=https://live-server-xxxxx.wati.io
WATI_API_TOKEN=your_wati_api_token_here
WATI_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token_here

# Deprecated - Remove these Twilio variables
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_WHATSAPP_NUMBER=

# Deprecated - Remove these WhatsApp Business API variables  
# WHATSAPP_BUSINESS_TOKEN=
# WHATSAPP_BUSINESS_PHONE_NUMBER_ID=
# WHATSAPP_WEBHOOK_VERIFY_TOKEN=
```

## Configuración en WATI

### 1. Obtener API Token
1. Inicia sesión en tu cuenta de WATI
2. Ve a **Settings** → **API Access**
3. Copia tu **API Token**
4. Agrega el token a `WATI_API_TOKEN` en tu archivo `.env.local`

### 2. Obtener API Endpoint
1. En la misma página de **API Access**, encontrarás tu **API Endpoint**
2. Será algo como: `https://live-server-xxxxx.wati.io`
3. Agrega este endpoint a `WATI_API_ENDPOINT` en tu archivo `.env.local`

### 3. Configurar Webhook
1. Ve a **Settings** → **Webhooks**
2. Configura la URL del webhook: `https://tu-dominio.com/api/whatsapp/webhook`
3. Selecciona los siguientes eventos:
   - **Message Received**
   - **New Contact Message Received**
4. Crea un token de verificación seguro y agrégalo a `WATI_WEBHOOK_VERIFY_TOKEN`

### 4. Configurar Verificación de Webhook
Para verificar el webhook, WATI enviará una petición GET a tu endpoint con el parámetro `token`.
Tu endpoint debe responder con status 200 si el token coincide.

URL de verificación: `https://tu-dominio.com/api/whatsapp/webhook?token=your_webhook_verify_token_here`

## Diferencias con Twilio/WhatsApp Business API

### Estructura de Mensajes
- **WATI**: Los mensajes llegan directamente con la URL del archivo multimedia en `body.data`
- **Twilio**: Requería descarga separada usando credenciales de autenticación básica
- **WhatsApp Business API**: Requería llamada adicional a Facebook Graph API

### Tipos de Mensaje Soportados
- **Texto**: `body.type === 'text'`
- **Imagen**: `body.type === 'image'`
- **Documento**: `body.type === 'document'`
- **Audio**: `body.type === 'audio'` (no implementado aún)
- **Video**: `body.type === 'video'` (no implementado aún)

### Envío de Mensajes
- **Mensajes de Sesión**: Para conversaciones activas (ventana de 24 horas)
- **Mensajes de Template**: Para nuevas conversaciones o después de 24 horas

## Migración desde Twilio

### Cambios en el Código
1. ✅ Actualizada función `sendWhatsAppMessage()` para usar WATI API
2. ✅ Actualizada función `downloadMedia()` para usar autenticación WATI
3. ✅ Actualizado webhook POST handler para procesar payloads WATI
4. ✅ Actualizado webhook GET handler para verificación WATI
5. ✅ Actualizada función `cleanPhoneNumber()` para formato WATI

### Funcionalidades Preservadas
- ✅ Procesamiento de recibos con Mindee
- ✅ Integración con Supabase Storage
- ✅ Verificación de suscripciones de usuario
- ✅ Menú de integraciones (Holded, Odoo, Xero)
- ✅ Comandos de texto (ayuda, estado, etc.)
- ✅ Manejo de errores y logging

## Testing

### 1. Verificar Webhook
```bash
curl "https://tu-dominio.com/api/whatsapp/webhook?token=your_webhook_verify_token_here"
```
Debería responder: `Webhook verified`

### 2. Enviar Mensaje de Prueba
Envía un mensaje de WhatsApp a tu número de WATI y verifica los logs en la consola.

### 3. Enviar Imagen de Prueba
Envía una imagen de factura y verifica que se procese correctamente.

## Troubleshooting

### Error: "WATI configuration is missing"
- Verifica que `WATI_API_ENDPOINT` y `WATI_API_TOKEN` estén configurados
- Asegúrate de que no tengan espacios en blanco al inicio o final

### Error: "Failed to download media from WATI"
- Verifica que el token de API tenga permisos para descargar archivos
- Revisa que la URL del archivo multimedia sea válida

### Error: "WATI API Error: 401"
- El token de API es inválido o ha expirado
- Regenera el token en la configuración de WATI

### Error: "WATI API Error: 403"
- El número de teléfono no está autorizado
- Verifica que el número esté en la lista de contactos de WATI

## Logs de Debug

El sistema incluye logging detallado para facilitar el debugging:

```bash
# Webhook recibido
📨 Webhook WATI recibido

# Payload procesado
📝 Payload WATI: {...}

# Número procesado
📱 Número de teléfono procesado: 34XXXXXXXXX

# Descarga de archivo
⬇️ Descargando archivo multimedia desde WATI: https://...
✅ Archivo descargado exitosamente desde WATI, tamaño: XXXX bytes

# Envío de mensaje
📤 Enviando mensaje WATI a: 34XXXXXXXXX
✅ Mensaje de sesión WATI enviado exitosamente
```

## Próximos Pasos

1. **Templates**: Configurar templates en WATI para mensajes fuera de la ventana de 24 horas
2. **Audio/Video**: Implementar soporte para mensajes de audio y video
3. **Botones**: Implementar soporte para botones interactivos de WATI
4. **Listas**: Implementar soporte para listas interactivas
5. **Monitoreo**: Configurar alertas para errores de API de WATI
