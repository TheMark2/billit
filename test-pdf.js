// Script para probar la generación de PDF a través de la API
const http = require('http');

// Datos para la solicitud
const data = JSON.stringify({
  receipt_id: '1',  // ID de un recibo existente
  regenerate: true  // Forzar regeneración del PDF
});

// Opciones de la solicitud
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/pdf-factura',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Authorization': 'Bearer test-token' // Token de prueba
  }
};

// Realizar la solicitud
console.log('Enviando solicitud para generar PDF...');
const req = http.request(options, (res) => {
  console.log(`Código de estado: ${res.statusCode}`);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsedData = JSON.parse(responseData);
      console.log('Respuesta:', parsedData);
      
      if (res.statusCode === 200) {
        console.log('✅ PDF generado correctamente');
        console.log('URL de descarga:', parsedData.pdf_url);
      } else {
        console.log('❌ Error al generar PDF');
      }
    } catch (e) {
      console.error('Error al parsear la respuesta:', e);
      console.log('Respuesta cruda:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('Error en la solicitud:', error);
});

// Enviar los datos
req.write(data);
req.end();