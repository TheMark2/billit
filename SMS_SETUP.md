# Configuración de SMS con Twilio para ReciptAI

Esta guía explica cómo configurar el sistema de digitalización de tickets por SMS usando Twilio.

## ¿Por qué SMS en lugar de WhatsApp?

- **Más simple**: No requiere verificación de Meta ni configuración compleja
- **Más universal**: Funciona con cualquier teléfono, no solo smartphones
- **Más directo**: Los usuarios pueden enviar tickets directamente sin apps adicionales
- **Más económico**: Costes más predecibles y menores
- **Más rápido de implementar**: Configuración en minutos, no días

## 1. Configuración inicial de Twilio

### Crear cuenta y obtener número de teléfono
1. **Registrarse en Twilio**: Ve a [Twilio Sign Up](https://www.twilio.com/try-twilio)
   - Cuando te pida seleccionar un plan, haz clic en "Continue with trial"

2. **Obtener credenciales y número**:
   - En la página de inicio, haz clic en "Get phone number" para obtener un número
   - Copia tu **Account SID** y **Auth Token** y guárdalos temporalmente
   - Anota el **número de teléfono** que Twilio te asignó

### Probar con Twilio Virtual Phone
1. Abre la [página Send an SMS en Twilio Console](https://console.twilio.com/us1/develop/sms/try-it-out/send-an-sms)
2. En la pestaña "Send to Virtual Phone", selecciona tu número de la lista
3. Haz clic en "Virtual Phone" para ver los mensajes que envíes

## 2. Variables de entorno

Agrega estas variables a tu archivo `.env.local`:

```env
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=tu_account_sid_aqui
TWILIO_AUTH_TOKEN=tu_auth_token_aqui
TWILIO_PHONE_NUMBER=+1234567890
```

## 3. Configuración del webhook en Twilio

### Para desarrollo local (usando ngrok)
1. **Instalar ngrok**: Sigue la [guía de instalación de ngrok](https://ngrok.com/docs/getting-started/)

2. **Ejecutar tu aplicación local**:
   ```bash
   npm run dev
   ```

3. **Crear túnel ngrok** (en otra terminal):
   ```bash
   ngrok http 3000
   ```
   
4. **Configurar webhook en Twilio**:
   - Abre la [página Active Numbers en Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
   - Haz clic en tu número de teléfono Twilio
   - En la sección "Messaging Configuration", en el campo URL para "A message comes in":
   - Ingresa la URL temporal de ngrok con `/api/sms/webhook` al final
   - Ejemplo: `https://1aaa-123-45-678-910.ngrok-free.app/api/sms/webhook`
   - Haz clic en "Save configuration"

### Para producción
1. **Configurar webhook en Twilio**:
   - Ve a "Phone Numbers" > "Manage" > "Active numbers"
   - Haz clic en tu número comprado
   - En la sección "Messaging", configura:
     - **Webhook URL**: `https://tudominio.com/api/sms/webhook`
     - **HTTP Method**: POST
   - Guarda la configuración

> ⚠️ **Importante**: Usa ngrok solo para pruebas ya que crea una URL temporal que expone tu máquina de desarrollo a internet. Para producción, usa un proveedor de nube o tu servidor público.

## Estructura del Webhook SMS

### Payload de entrada (Twilio)
```typescript
interface SMSWebhookPayload {
  MessageSid: string;      // ID único del mensaje
  AccountSid: string;      // Tu Account SID
  From: string;           // Número del remitente
  To: string;             // Tu número Twilio
  Body: string;           // Texto del mensaje
  MediaUrl0?: string;     // URL del archivo adjunto
  MediaContentType0?: string; // Tipo de archivo
  NumMedia: string;       // Número de archivos adjuntos
}
```

### Tipos de mensajes soportados
- **Texto**: Comandos como "ayuda", "estado", "integraciones"
- **Imagen**: JPG, PNG para tickets
- **Documento**: PDF para tickets

## Comandos Disponibles

### Comandos de texto que pueden enviar los usuarios:

- **"ayuda"** o **"help"**: Muestra la lista de comandos disponibles
- **"estado"** o **"status"**: Muestra el estado de la cuenta y tickets restantes
- **"integraciones"**: Muestra las integraciones configuradas

### Envío de tickets:
- Los usuarios simplemente envían una foto del ticket como archivo adjunto
- El sistema procesa automáticamente la imagen con Mindee
- Responde con los datos extraídos y confirmación

## Flujo de Funcionamiento

1. **Usuario envía SMS** con foto de ticket a tu número Twilio
2. **Twilio recibe el mensaje** y envía webhook a tu API
3. **Tu API procesa**:
   - Verifica que el usuario esté registrado
   - Comprueba la suscripción activa
   - Descarga la imagen del ticket
   - Procesa con Mindee API
   - Guarda en Supabase
4. **Respuesta automática** con los datos extraídos

## Costes Estimados

### Twilio SMS (precios aproximados):
- **Número de teléfono**: ~$1-5/mes
- **SMS salientes**: ~$0.0075 por mensaje
- **SMS entrantes**: ~$0.0075 por mensaje  
- **MMS (con imagen)**: ~$0.02 por mensaje

### Ejemplo mensual (100 tickets):
- Número: $2/mes
- 100 MMS entrantes: $2/mes
- 100 SMS salientes: $0.75/mes
- **Total**: ~$5/mes

## Ventajas vs WhatsApp

| Característica | SMS | WhatsApp Business API |
|----------------|-----|----------------------|
| Configuración | 5 minutos | 2-7 días |
| Verificación | No requerida | Verificación de Meta |
| Costes | Predecibles | Variables + setup |
| Compatibilidad | 100% teléfonos | Solo smartphones |
| Límites | Muy altos | Estrictos |
| Mantenimiento | Mínimo | Complejo |

## Migración desde WhatsApp

Si ya tienes WhatsApp configurado:

1. **Mantén ambos sistemas** temporalmente
2. **Informa a usuarios** sobre la nueva opción SMS
3. **Migra gradualmente** usuarios a SMS
4. **Desactiva WhatsApp** cuando todos estén migrados

## 4. Probar el sistema SMS

### Probar con Twilio Virtual Phone
1. **Con ngrok y tu aplicación ejecutándose**:
   - Ve a la [página Send an SMS en Twilio Console](https://console.twilio.com/us1/develop/sms/try-it-out/send-an-sms)
   - En la pestaña "Send to Virtual Phone", selecciona tu número
   - Haz clic en "Virtual Phone"

2. **Enviar mensaje de prueba**:
   - En el Virtual Phone, escribe un mensaje en el campo "Click here to reply"
   - Haz clic en el icono de enviar
   - Deberías ver una petición HTTP en tu consola de ngrok
   - El Virtual Phone mostrará la respuesta de tu webhook

### Comandos SMS disponibles
Puedes probar estos comandos enviando SMS a tu número Twilio:

- **"ayuda"** - Muestra información de ayuda
- **"estado"** - Muestra el estado de tu suscripción
- **"integraciones"** - Muestra configuración de integraciones
- **Enviar imagen** - Adjunta una foto de ticket para procesar

### Verificar logs
```bash
# Ver logs de tu aplicación Next.js
npm run dev

# Configurar webhook en Twilio con URL de ngrok:
# https://abc123.ngrok.io/api/sms/webhook
```

### Enviar mensaje de prueba:
1. Envía "ayuda" a tu número Twilio
2. Debería responder con la lista de comandos
3. Envía una foto de ticket
4. Debería procesar y responder con datos extraídos

## Troubleshooting

### Error: "Usuario no encontrado"
- Verificar que el número esté registrado en la tabla `profiles`
- Comprobar diferentes formatos de número (+34, 34, sin prefijo)

### Error: "Suscripción inactiva"
- Usuario debe tener suscripción activa en Stripe
- Verificar webhook de Stripe funcionando

### Error: "No se puede descargar media"
- Verificar credenciales de Twilio
- Comprobar que el archivo no sea demasiado grande

### Webhook no recibe mensajes:
- Verificar URL del webhook en Twilio
- Comprobar que la URL sea accesible públicamente
- Revisar logs del servidor

## Próximos Pasos

1. **Configurar variables de entorno**
2. **Comprar número Twilio**
3. **Configurar webhook**
4. **Probar con mensaje de prueba**
5. **Informar a usuarios sobre nueva funcionalidad**
6. **Monitorear uso y costes**

## Mejoras Futuras

- **Templates de respuesta** personalizables
- **Integración directa** con contabilidad desde SMS
- **Reportes por SMS** de gastos mensuales
- **Múltiples idiomas** en respuestas
- **Análisis de uso** y estadísticas
