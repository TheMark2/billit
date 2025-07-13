# 🔧 Configuración de n8n para WhatsApp - Guía Completa

## 📋 **PASO 1: Configuración después del despliegue**

Una vez que Vercel complete el despliegue, tendrás una URL como:
```
https://billit-xxx.vercel.app
```

### **Endpoints disponibles:**
- **Consultar integraciones**: `https://tu-dominio.vercel.app/api/users/get-user-integrations?phone=+34XXXXXXXX`
- **Verificar usuario**: `https://tu-dominio.vercel.app/api/users/check-subscription`
- **Procesar recibo**: `https://tu-dominio.vercel.app/api/upload-receipt`

## 🔧 **PASO 2: Configurar nodos en n8n**

### **Nodo 1: HTTP Request - "Consultar Integraciones Usuario"**
- **Método**: GET
- **URL**: `https://tu-dominio.vercel.app/api/users/get-user-integrations`
- **Query Parameters**:
  - `phone`: `{{ $('Clean Phone Number').item.json.phoneNumber }}`
- **Headers**:
  - `Authorization`: `Bearer tu_supabase_service_role_key`

### **Nodo 2: Function - "Generar Menu Integraciones"**
```javascript
const integraciones = $input.first().json.integraciones || [];
const phoneNumber = $('Clean Phone Number').item.json.phoneNumber;

// Crear mensaje dinámico basado en integraciones activas
let mensaje = `✅ *Factura procesada correctamente*\n\n`;

if (integraciones.length === 0) {
  mensaje += `❌ *No tienes integraciones configuradas*\n\n`;
  mensaje += `Ve a tu dashboard para configurar Odoo, Holded o Xero.`;
  
  return [{
    message: mensaje,
    hasIntegrations: false,
    phoneNumber: phoneNumber
  }];
}

mensaje += `🔗 *Selecciona dónde enviar la factura:*\n\n`;

let opciones = [];
integraciones.forEach((integracion, index) => {
  const numero = index + 1;
  let icono = integracion.icon || '🔵';
  mensaje += `${numero}. ${icono} ${integracion.name}\n`;
  opciones.push({
    numero: numero,
    tipo: integracion.type,
    nombre: integracion.name
  });
});

mensaje += `\n💬 *Responde con el número de tu elección*`;

return [{
  message: mensaje,
  hasIntegrations: true,
  opciones: opciones,
  phoneNumber: phoneNumber
}];
```

### **Nodo 3: HTTP Request - "Enviar Menu Integraciones"**
- **Método**: POST
- **URL**: `https://api.twilio.com/2010-04-01/Accounts/{{ $env.TWILIO_ACCOUNT_SID }}/Messages.json`
- **Authentication**: Basic Auth
  - **User**: `{{ $env.TWILIO_ACCOUNT_SID }}`
  - **Password**: `{{ $env.TWILIO_AUTH_TOKEN }}`
- **Headers**:
  - `Content-Type`: `application/x-www-form-urlencoded`
- **Body (Form)**:
  - `From`: `{{ $env.TWILIO_WHATSAPP_NUMBER }}`
  - `To`: `{{ $json.phoneNumber }}`
  - `Body`: `{{ $json.message }}`

## 🔧 **PASO 3: Modificar nodos existentes**

### **Nodo "Detectar Tipo Mensaje" (Switch)**
- **Regla 1**: `{{ parseInt($('Webhook').item.json.body.NumMedia) }}` **is greater than** `0` → **Imagen**
- **Regla 2**: `{{ $('Webhook').item.json.body.Body }}` **is not empty** → **Texto**

### **Conexiones:**
1. **Webhook** → **Clean Phone Number** → **Detectar Tipo Mensaje**
2. **Imagen** → **HTTP Request** (verificar usuario) → **Download Media** → **Upload Receipt** → **Save Receipt** → **Consultar Integraciones Usuario**
3. **Texto** → **Function** (procesar comando) → **Switch** (ejecutar comando)

## 📱 **PASO 4: Para WhatsApp Business API**

### **Configurar WhatsApp Business:**
1. **Crea una cuenta en Meta Business**: https://business.facebook.com/
2. **Configura WhatsApp Business API**
3. **Obtén credenciales**:
   - **Token de acceso**
   - **Phone Number ID**
   - **Webhook URL**

### **Cambiar de Twilio a WhatsApp Business:**
1. **Reemplaza URLs de Twilio** por endpoints de WhatsApp:
   ```
   https://graph.facebook.com/v18.0/{phone-number-id}/messages
   ```
2. **Actualiza headers**:
   - `Authorization`: `Bearer {access-token}`
   - `Content-Type`: `application/json`
3. **Cambia formato del cuerpo**:
   ```json
   {
     "messaging_product": "whatsapp",
     "to": "{{ $json.phoneNumber }}",
     "type": "text",
     "text": {
       "body": "{{ $json.message }}"
     }
   }
   ```

## 🔧 **PASO 5: Variables de entorno para n8n**

En tu instancia de n8n, configura estas variables:
```env
API_BASE_URL=https://tu-dominio.vercel.app
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
TWILIO_ACCOUNT_SID=tu_twilio_account_sid
TWILIO_AUTH_TOKEN=tu_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

## 📋 **PASO 6: Flujo completo**

1. **Usuario envía imagen** → **Procesar factura** → **Guardar en BD** → **Mostrar menú de integraciones**
2. **Usuario responde "1"** → **Enviar a integración seleccionada** → **Confirmar envío**
3. **Usuario envía "menu"** → **Mostrar menú de integraciones**

## 🚀 **PASO 7: Producción**

### **WhatsApp Business API:**
1. **Registra tu número** en Meta Business
2. **Configura webhook** apuntando a tu n8n
3. **Actualiza credenciales** en n8n
4. **Prueba con usuarios reales**

### **Monitoreo:**
- **Logs en n8n** para debugging
- **Métricas de Supabase** para base de datos
- **Logs de Vercel** para APIs

---

**¿Necesitas ayuda con algún paso específico?** 🤔 