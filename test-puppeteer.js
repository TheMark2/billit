// Script para probar Puppeteer-core directamente
const puppeteerCore = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Función para encontrar Chrome en macOS
function findChromeMac() {
  const commonPaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    `${os.homedir()}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
    `${os.homedir()}/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary`,
    `${os.homedir()}/Applications/Chromium.app/Contents/MacOS/Chromium`,
    `${os.homedir()}/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`,
    `${os.homedir()}/Applications/Brave Browser.app/Contents/MacOS/Brave Browser`
  ];

  for (const path of commonPaths) {
    if (fs.existsSync(path)) {
      console.log(`Chrome encontrado en: ${path}`);
      return path;
    }
  }

  console.log('No se encontró Chrome en las rutas comunes');
  return null;
}

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
    <p>Este es un documento de prueba para verificar la generación de PDF con Puppeteer.</p>
    <p>Fecha de generación: ${new Date().toLocaleString()}</p>
  </div>
  <div class="footer">
    <p>Generado por Puppeteer - Prueba directa</p>
  </div>
</body>
</html>
`;

// Función para generar PDF directamente con Puppeteer
async function generatePdf() {
  console.log('Iniciando prueba directa con Puppeteer-core...');
  let browser;

  try {
    // Encontrar Chrome
    const chromePath = findChromeMac();
    if (!chromePath) {
      throw new Error('No se pudo encontrar Chrome. Por favor, especifica la ruta manualmente.');
    }

    // Lanzar Puppeteer con la ruta a Chrome
    console.log('Lanzando Puppeteer-core con Chrome encontrado...');
    browser = await puppeteerCore.launch({
      headless: 'new',
      executablePath: chromePath,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    console.log('Puppeteer-core lanzado correctamente');

    // Crear una nueva página
    const page = await browser.newPage();
    console.log('Página creada');

    // Establecer el contenido HTML
    await page.setContent(html, { waitUntil: 'networkidle0' });
    console.log('Contenido HTML establecido');

    // Generar el PDF
    console.log('Generando PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
    });
    console.log('PDF generado correctamente');

    // Guardar el PDF en un archivo
    const outputPath = path.join(__dirname, 'test-puppeteer-output.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    console.log(`PDF guardado en: ${outputPath}`);

    return true;
  } catch (error) {
    console.error('Error al generar el PDF:', error);
    return false;
  } finally {
    // Cerrar el navegador
    if (browser) {
      await browser.close();
      console.log('Navegador cerrado');
    }
  }
}

// Ejecutar la prueba
generatePdf().then(success => {
  if (success) {
    console.log('✅ Prueba completada con éxito');
  } else {
    console.log('❌ La prueba falló');
  }
});