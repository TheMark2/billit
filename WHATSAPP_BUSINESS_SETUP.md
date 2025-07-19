# WhatsApp Business API Setup

## Variables de Entorno Requeridas

Para usar WhatsApp Business API, necesitas configurar las siguientes variables de entorno:

```bash
# WhatsApp Business API Configuration
WHATSAPP_BUSINESS_ACCESS_TOKEN=your_access_token_here
WHATSAPP_BUSINESS_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token_here
```

## Configuración en Meta for Developers

### 1. Crear una App en Meta for Developers
1. Ve a https://developers.facebook.com/
2. Crea una nueva app de tipo "Business"
3. Agrega el producto "WhatsApp Business API"

### 2. Configurar WhatsApp Business API
1. En el dashboard de tu app, ve a "WhatsApp" > "Getting Started"
2. Copia el `Access Token` temporal (luego necesitarás uno permanente)
3. Copia el `Phone Number ID` de tu número de prueba
4. Configura el webhook:
   - URL: `https://tu-dominio.com/api/whatsapp/webhook`
   - Verify Token: Un token secreto que tú defines
   - Suscríbete a los eventos: `messages`

### 3. Obtener Access Token Permanente
1. Ve a "WhatsApp" > "Configuration"
2. Genera un access token permanente o configura un Business Manager
3. Reemplaza el token temporal con el permanente

### 4. Configurar Número de Teléfono
1. Para producción, necesitas verificar tu número de teléfono comercial
2. Sigue el proceso de verificación en el dashboard
3. Una vez verificado, actualiza el `WHATSAPP_BUSINESS_PHONE_NUMBER_ID`

## Estructura del Webhook

### Verificación (GET)
WhatsApp enviará una petición GET para verificar tu webhook:
```
GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=tu_token&hub.challenge=challenge_string
```

### Mensajes Entrantes (POST)
WhatsApp enviará mensajes en este formato:
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "entry_id",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15550559999",
              "phone_number_id": "123456789"
            },
            "messages": [
              {
                "from": "16315551234",
                "id": "wamid.xxx",
                "timestamp": "1234567890",
                "type": "text",
                "text": {
                  "body": "Hello World"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

## Tipos de Mensajes Soportados

### Texto
```json
{
  "type": "text",
  "text": {
    "body": "Mensaje de texto"
  }
}
```

### Imagen
```json
{
  "type": "image",
  "image": {
    "id": "media_id",
    "mime_type": "image/jpeg",
    "sha256": "hash",
    "caption": "Descripción opcional"
  }
}
```

### Documento
```json
{
  "type": "document",
  "document": {
    "id": "media_id",
    "mime_type": "application/pdf",
    "sha256": "hash",
    "filename": "documento.pdf",
    "caption": "Descripción opcional"
  }
}
```

## Envío de Mensajes

### Mensaje de Texto
```bash
curl -X POST \
  https://graph.facebook.com/v18.0/PHONE_NUMBER_ID/messages \
  -H 'Authorization: Bearer ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messaging_product": "whatsapp",
    "to": "PHONE_NUMBER",
    "type": "text",
    "text": {
      "body": "Hello World"
    }
  }'
```

### Mensaje Template
```bash
curl -X POST \
  https://graph.facebook.com/v18.0/PHONE_NUMBER_ID/messages \
  -H 'Authorization: Bearer ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messaging_product": "whatsapp",
    "to": "PHONE_NUMBER",
    "type": "template",
    "template": {
      "name": "hello_world",
      "language": {
        "code": "en_US"
      }
    }
  }'
```

## Descarga de Media

1. Obtener URL del media:
```bash
curl -X GET \
  https://graph.facebook.com/v18.0/MEDIA_ID \
  -H 'Authorization: Bearer ACCESS_TOKEN'
```

2. Descargar el archivo:
```bash
curl -X GET \
  MEDIA_URL \
  -H 'Authorization: Bearer ACCESS_TOKEN'
```

## Migración desde WATI

### Cambios Principales:
1. **Estructura del webhook**: Completamente diferente
2. **Envío de mensajes**: Usar Graph API en lugar de WATI API
3. **Descarga de media**: Proceso de 2 pasos
4. **Verificación**: Usar parámetros `hub.*` en lugar de token simple

### Variables a Remover:
```bash
# Remover estas variables de WATI
WATI_API_ENDPOINT
WATI_API_TOKEN
WATI_WEBHOOK_VERIFY_TOKEN
```

### Variables a Agregar:
```bash
# Agregar estas variables de WhatsApp Business API
WHATSAPP_BUSINESS_ACCESS_TOKEN
WHATSAPP_BUSINESS_PHONE_NUMBER_ID
WHATSAPP_WEBHOOK_VERIFY_TOKEN
```

## Testing

### 1. Verificar Webhook
```bash
curl "https://tu-dominio.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=tu_token&hub.challenge=test123"
```

### 2. Enviar Mensaje de Prueba
Envía un mensaje desde tu número de WhatsApp al número de prueba configurado.

### 3. Verificar Logs
Revisa los logs de tu aplicación para ver si los mensajes se procesan correctamente.

## Troubleshooting

### Error: "Invalid access token"
- Verifica que el access token sea válido y no haya expirado
- Asegúrate de usar un token permanente para producción

### Error: "Phone number not found"
- Verifica que el `WHATSAPP_BUSINESS_PHONE_NUMBER_ID` sea correcto
- Asegúrate de que el número esté verificado en Meta for Developers

### Error: "Webhook verification failed"
- Verifica que el `WHATSAPP_WEBHOOK_VERIFY_TOKEN` coincida
- Asegúrate de que la URL del webhook sea accesible públicamente

### Mensajes no se reciben
- Verifica que el webhook esté configurado correctamente en Meta
- Revisa que estés suscrito al evento "messages"
- Verifica que la URL del webhook responda correctamente

## Límites y Consideraciones

### Límites de Rate
- 1000 mensajes por segundo por número de teléfono
- 250,000 mensajes por día para números verificados

### Ventana de Mensajería
- Puedes enviar mensajes de sesión durante 24 horas después del último mensaje del usuario
- Después de 24 horas, solo puedes enviar templates aprobados

### Templates
- Los templates deben ser aprobados por Meta antes de usar
- Proceso de aprobación puede tomar 24-48 horas
- Necesarios para mensajes fuera de la ventana de 24 horas
