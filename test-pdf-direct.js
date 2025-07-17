// Script para probar directamente la generación de PDF sin usar la API
const fs = require('fs');
const path = require('path');

// HTML simple para probar
const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Prueba de PDF</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #333; }
    .content { margin: 20px 0; }
    .footer { margin-top: 50px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <h1>Documento de Prueba</h1>
  <div class="content">
    <p>Este es un documento de prueba para verificar la generación de PDF.</p>
    <p>Fecha de generación: ${new Date().toLocaleString()}</p>
  </div>
  <div class="footer">
    <p>Generado por ReciptAI - Prueba de sistema</p>
  </div>
</body>
</html>
`;

// Datos de plantilla para fallback
const templateData = {
  supplier: 'Empresa de Prueba',
  supplier_cif: 'B12345678',
  date: '2023-05-15',
  invoice_number: 'FACT-001',
  line_items: [
    {
      description: 'Producto 1',
      quantity: 2,
      unit_price: 10.50,
      total: 21.00
    }
  ],
  total_net: 21.00,
  total_tax: 4.41,
  total_amount: 25.41,
  currency: 'EUR',
  tax_rate: 21
};

// Función para guardar el HTML en un archivo para pruebas
function saveHtmlFile() {
  const htmlPath = path.join(__dirname, 'test-template.html');
  fs.writeFileSync(htmlPath, html);
  console.log(`HTML guardado en: ${htmlPath}`);
}

// Guardar el HTML para pruebas manuales
saveHtmlFile();

console.log('\nPara probar la generación de PDF:');
console.log('1. Ejecuta la aplicación con "npm run dev"');
console.log('2. Abre un navegador y visita: http://localhost:3000/api/pdf-factura?receipt_id=1');
console.log('3. Si el PDF se genera correctamente, verás una respuesta JSON con la URL del PDF');
console.log('\nAlternativamente, puedes probar el HTML generado abriendo el archivo test-template.html en un navegador.');