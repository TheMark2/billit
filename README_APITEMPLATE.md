# Configuración de APITemplate.io

## Configuración de Variables de Entorno

Para que funcione la generación de PDFs con APITemplate.io, necesitas configurar las siguientes variables de entorno en tu archivo `.env.local`:

```env
# APITemplate.io Configuration
APITEMPLATE_API_KEY=bb6eMzI4MDY6Mjk5ODU6NWs4YmhqZ2NGUlZjUDlNRg=
APITEMPLATE_TEMPLATE_ID=20877b23684b10a8
```

## Pasos para Configurar

1. **Crea tu cuenta en APITemplate.io**: Ve a https://app.apitemplate.io/accounts/login/
2. **Obtén tu API Key**: Después de iniciar sesión, ve a la sección "API Integration" para obtener tu API Key
3. **Crea tu Template**: Usa el editor de templates para crear tu template de factura con el HTML que proporcionaste
4. **Obtén el Template ID**: Una vez creado el template, obtendrás un ID que necesitarás configurar

## Funcionalidad Implementada

✅ **Generación automática de PDFs**: Después de procesar una factura con Mindee, se genera automáticamente un PDF con APITemplate.io

✅ **Mapeo de datos mejorado**: Los datos extraídos de la factura se mapean automáticamente a las variables del template:

**Información del proveedor:**
- `supplier`: Nombre del proveedor
- `supplier_cif`: CIF/NIF del proveedor
- `supplier_phone`: Teléfono del proveedor
- `supplier_email`: Email del proveedor

**Información del cliente:**
- `customer_name`: Nombre del cliente
- `customer_cif`: CIF/NIF del cliente
- `customer_address`: Dirección del cliente

**Fechas:**
- `date`: Fecha de la factura
- `due_date`: Fecha de vencimiento (si está disponible)
- `current_date`: Fecha actual de generación

**Información financiera:**
- `currency`: Moneda
- `total_amount`: Importe total
- `total_net`: Importe neto
- `total_tax`: Impuestos total

**Información de impuestos detallada:**
- `tax_rate`: Porcentaje de impuesto
- `tax_base`: Base imponible
- `tax_amount`: Cantidad de impuesto

**Documento:**
- `invoice_number`: Número de factura
- `document_type`: Tipo de documento

**Dirección:**
- `city`: Ciudad extraída de la dirección
- `adress`: Dirección completa del proveedor

**Items y pago:**
- `line_items`: Array con los productos/servicios
- `payment_method`: Método de pago detectado

✅ **Endpoint para PDFs**: Se creó el endpoint `/api/pdf-factura` para obtener y regenerar PDFs

✅ **Componente de visualización**: Se creó un componente `PdfViewer` para mostrar los PDFs generados

## Cómo Usar

1. Sube una factura como siempre
2. Después del procesamiento, se generará automáticamente un PDF
3. En la página de recibos, podrás ver un botón "Ver PDF" para cada factura procesada
4. Puedes descargar el PDF o regenerarlo si es necesario

## Estructura del Template

El template que creaste incluye:
- Información del proveedor
- Fecha de facturación
- Tabla de productos/servicios
- Totales con impuestos
- Diseño minimalista y profesional

## Notas Técnicas

- Los PDFs se generan de forma asíncrona y no bloquean el procesamiento principal
- Se almacenan los metadatos del PDF en la base de datos
- El sistema maneja errores gracefully - si el PDF falla, el procesamiento continúa normalmente
- Los PDFs se almacenan en el CDN de APITemplate.io y tienen URLs de descarga directa 