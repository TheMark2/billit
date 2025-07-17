import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
// Para desarrollo, usar puppeteer completo con Chromium incluido
let puppeteerDev;
try {
  puppeteerDev = process.env.NODE_ENV === 'development' ? require('puppeteer') : null;
} catch (error) {
  console.warn('Puppeteer no está disponible, se usará configuración alternativa');
  puppeteerDev = null;
}
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase para almacenar PDFs
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Función para leer y compilar el template HTML
async function compileHtmlTemplate(templateData: any): Promise<string> {
  try {
    // Registrar helpers de Handlebars
    Handlebars.registerHelper('formatCurrency', function(amount: number, currency: string) {
      const formattedAmount = (amount || 0).toFixed(2);
      return `${formattedAmount} ${currency || 'EUR'}`;
    });

    // Helper para verificar si un valor existe y no es 0
    Handlebars.registerHelper('and', function(...args: any[]) {
      // Quitar el objeto options del final
      const values = args.slice(0, -1);
      return values.every(val => val && val !== 0);
    });

    // Helper para verificar si un valor no es igual a otro
    Handlebars.registerHelper('ne', function(v1: any, v2: any) {
      return v1 !== v2;
    });

    // Helper para verificar si hay IVA
    Handlebars.registerHelper('hasTax', function(total_tax: number) {
      return total_tax && total_tax > 0;
    });

    // Helper para comparar valores
    Handlebars.registerHelper('eq', function(v1: any, v2: any) {
      return v1 === v2;
    });
    
    // Leer el template HTML
    const templatePath = path.join(process.cwd(), 'src/templates/ticket-template.html');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    
    // Compilar con Handlebars
    const template = Handlebars.compile(templateContent);
    
    // Generar HTML con los datos
    const html = template(templateData);
    
    return html;
  } catch (error) {
    console.error('Error compiling HTML template:', error);
    throw new Error('Error al compilar el template HTML');
  }
}

// Función para generar PDF usando Puppeteer con Chromium optimizado para Vercel
async function generatePdfFromHtml(html: string, templateData?: any): Promise<Buffer> {
  let browser;
  
  try {
    // Configurar Puppeteer con chromium optimizado para Vercel
    const isDev = process.env.NODE_ENV === 'development';
    
    // Configuración para desarrollo y producción
    const getChromePath = () => {
      // Buscar Chrome en ubicaciones comunes
      const possiblePaths = {
        darwin: [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
          '/Applications/Chromium.app/Contents/MacOS/Chromium'
        ],
        win32: [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        ],
        linux: [
          '/usr/bin/google-chrome',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium'
        ]
      };
      
      const paths = possiblePaths[process.platform as keyof typeof possiblePaths] || [];
      
      // En desarrollo, no especificar ruta para que Puppeteer use su Chromium incluido
      if (isDev && puppeteerDev) {
        return undefined;
      }
      
      return paths[0]; // Devolver la primera ruta por defecto
    };
    
    const launchOptions = isDev ? {
      // Configuración para desarrollo local
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      defaultViewport: { width: 1920, height: 1080 },
      headless: true,
      // En desarrollo, no especificar ruta para que Puppeteer use su Chromium incluido
      executablePath: undefined
    } : {
      // Configuración para producción (Vercel)
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: await chromium.executablePath(),
      headless: true
    };
    
    try {
      // En desarrollo, usar puppeteer completo con Chromium incluido
      if (isDev && puppeteerDev) {
        console.log('🔄 [PDF_GENERATOR] Usando puppeteer completo para desarrollo...');
        // Usar puppeteerDev que tiene Chromium incluido, sin especificar executablePath
        browser = await puppeteerDev.launch({
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
          ],
          defaultViewport: { width: 1920, height: 1080 },
          headless: true
        });
      } else {
        browser = await puppeteer.launch(launchOptions);
      }
    } catch (error) {
      console.log('🔄 [PDF_GENERATOR] Error al lanzar Puppeteer:', error);
      
      // Si estamos en desarrollo y tenemos puppeteerDev disponible
      if (isDev && puppeteerDev) {
        console.log('🔄 [PDF_GENERATOR] Intentando configuración alternativa para desarrollo...');
        try {
          // Configuración simplificada para desarrollo
          const simpleOptions = {
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage'
            ],
            defaultViewport: { width: 1920, height: 1080 },
            headless: true,
            // No especificar executablePath para usar el Chromium incluido
          };
          
          // Usar directamente puppeteerDev que incluye Chromium
          browser = await puppeteerDev.launch(simpleOptions);
          console.log('🔄 [PDF_GENERATOR] Configuración alternativa exitosa');
        } catch (secondError) {
          console.log('🔄 [PDF_GENERATOR] Configuración alternativa también falló:', secondError);
          
          // Usar el generador de PDF de fallback si tenemos datos de plantilla
          if (templateData) {
            console.log('🔄 [PDF_GENERATOR] Generando PDF de fallback con datos de plantilla...');
            return await generateFallbackPdf(templateData);
          } else {
            // Crear un PDF de fallback simple si no hay datos de plantilla
            console.log('🔄 [PDF_GENERATOR] Generando PDF de fallback simple...');
            return Buffer.from(
              `<html><body><h1>PDF de Fallback</h1><p>No se pudo generar el PDF completo debido a problemas con Puppeteer.</p><p>${new Date().toISOString()}</p></body></html>`,
              'utf-8'
            );
          }
        }
      } else {
        // En producción, intentar usar el fallback si hay datos de plantilla
        if (templateData) {
          console.log('🔄 [PDF_GENERATOR] Generando PDF de fallback en producción...');
          return await generateFallbackPdf(templateData);
        }
        // Si no hay datos de plantilla, propagar el error
        throw error;
      }
    }
    
    const page = await browser.newPage();
    
    // Configurar el contenido HTML
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // Generar PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });
    
    return Buffer.from(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    
    // Intentar usar el fallback si hay datos de plantilla
    if (templateData) {
      console.log('🔄 [PDF_GENERATOR] Intentando generar PDF de fallback después de error...');
      try {
        return await generateFallbackPdf(templateData);
      } catch (fallbackError) {
        console.error('Error en fallback:', fallbackError);
      }
    }
    
    throw new Error('Error generando el PDF');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Función para subir PDF a Supabase Storage
async function uploadPdfToStorage(pdfBuffer: Buffer, fileName: string): Promise<string> {
  try {
    const filePath = `pdfs/${fileName}`;
    
    // Subir archivo a Supabase Storage
    const { data, error } = await supabase.storage
      .from('ticket-pdfs')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });
    
    if (error) {
      console.error('Error uploading PDF to storage:', error);
      throw new Error('Error subiendo PDF al almacenamiento');
    }
    
    // Obtener URL pública del archivo
    const { data: publicUrlData } = supabase.storage
      .from('ticket-pdfs')
      .getPublicUrl(filePath);
    
    return publicUrlData.publicUrl;
    
  } catch (error) {
    console.error('Error in uploadPdfToStorage:', error);
    throw error;
  }
}

// Función para generar un PDF de fallback simple cuando Puppeteer falla
async function generateFallbackPdf(templateData: any): Promise<Buffer> {
  // Crear un HTML simple con los datos básicos
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Factura Simplificada</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .info-block { margin-bottom: 20px; }
        .info-row { display: flex; margin-bottom: 5px; }
        .info-label { font-weight: bold; width: 150px; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .table th { background-color: #f2f2f2; }
        .total-block { margin-top: 30px; text-align: right; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Factura Simplificada</h1>
        <p><em>Documento generado en modo fallback</em></p>
      </div>
      
      <div class="info-block">
        <h3>Proveedor</h3>
        <div class="info-row">
          <div class="info-label">Nombre:</div>
          <div>${templateData.supplier || 'No disponible'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">CIF/NIF:</div>
          <div>${templateData.supplier_cif || 'No disponible'}</div>
        </div>
      </div>
      
      <div class="info-block">
        <h3>Detalles de Factura</h3>
        <div class="info-row">
          <div class="info-label">Fecha:</div>
          <div>${templateData.date || new Date().toLocaleDateString()}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Número:</div>
          <div>${templateData.invoice_number || 'No disponible'}</div>
        </div>
      </div>
      
      <table class="table">
        <thead>
          <tr>
            <th>Descripción</th>
            <th>Cantidad</th>
            <th>Precio</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${templateData.line_items?.map((item: any) => `
            <tr>
              <td>${item.description || 'Producto/Servicio'}</td>
              <td>${item.quantity || 1}</td>
              <td>${item.unit_price || 0} ${templateData.currency || 'EUR'}</td>
              <td>${item.total || 0} ${templateData.currency || 'EUR'}</td>
            </tr>
          `).join('') || '<tr><td colspan="4">No hay items disponibles</td></tr>'}
        </tbody>
      </table>
      
      <div class="total-block">
        <div class="info-row">
          <div class="info-label">Subtotal:</div>
          <div>${templateData.total_net || 0} ${templateData.currency || 'EUR'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">IVA (${templateData.tax_rate || 21}%):</div>
          <div>${templateData.total_tax || 0} ${templateData.currency || 'EUR'}</div>
        </div>
        <div class="info-row" style="font-weight: bold;">
          <div class="info-label">TOTAL:</div>
          <div>${templateData.total_amount || 0} ${templateData.currency || 'EUR'}</div>
        </div>
      </div>
      
      <div style="margin-top: 50px; font-size: 12px; color: #666;">
        <p>Este documento es una versión simplificada generada en modo fallback.</p>
        <p>Generado el: ${new Date().toLocaleString()}</p>
      </div>
    </body>
    </html>
  `;
  
  return Buffer.from(html, 'utf-8');
}

// Función principal para generar PDF (reemplaza a generatePdfWithApiTemplate)
export async function generatePdfWithPuppeteer(mindeeData: any, userId?: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  const LOG_PREFIX = '🔄 [PDF_GENERATOR]';
  const isDev = process.env.NODE_ENV === 'development';
  
  try {
    console.log(`${LOG_PREFIX} Iniciando generación de PDF con Puppeteer...`);
    
    // Obtener información de la empresa del usuario si se proporciona userId
    let companyInfo = {
      nombre_fiscal: 'Tu Empresa',
      cif: '',
      direccion: '',
      email_facturacion: '',
      telefono: ''
    };

    if (userId) {
      try {
        // Obtener información del perfil del usuario
        const { data: profile } = await supabase
          .from('profiles')
          .select('nombre, apellido, email, telefono, nombre_fiscal, cif, direccion, email_facturacion')
          .eq('id', userId)
          .single();

        if (profile) {
            companyInfo = {
              nombre_fiscal: profile.nombre_fiscal || `${profile.nombre} ${profile.apellido}`.trim(),
              cif: profile.cif || '',
              direccion: profile.direccion || '',
              email_facturacion: profile.email_facturacion || profile.email || '',
              telefono: profile.telefono || ''
            };
          }
      } catch (error) {
        console.error('Error fetching company info:', error);
        // Continuar con valores por defecto si hay error
      }
    }
    
    // Extraer información del proveedor
    const supplierRegistration = mindeeData.supplier_company_registrations?.[0]?.value || '';
    const supplierPhone = mindeeData.supplier_phone_number?.value || '';
    const supplierEmail = mindeeData.supplier_email?.value || '';
    const taxInfo = mindeeData.taxes?.[0] || {};
    
    // Procesar line items - usar edited_line_items si están disponibles, sino usar line_items originales
    const lineItemsToProcess = mindeeData.edited_line_items || mindeeData.line_items || [];
    const processedLineItems = mapLineItems(lineItemsToProcess);
    
    // Calcular totales basándose en los line items procesados
    const calculatedTotals = calculateTotalsFromLineItems(processedLineItems);
    
    // Mapear los datos para el template
    const templateData = {
      // Información del proveedor - usar datos editados si están disponibles
      supplier: mindeeData.proveedor || mindeeData.supplier_name || 'Establecimiento',
      supplier_cif: supplierRegistration,
      supplier_phone: supplierPhone,
      supplier_email: supplierEmail,
      adress: mindeeData.supplier_address || null,

      
      // Información del cliente (empresa del usuario)
      customer_name: companyInfo.nombre_fiscal,
      customer_cif: companyInfo.cif,
      customer_address: companyInfo.direccion || '',
      customer_phone: companyInfo.telefono || '',
      customer_email: companyInfo.email_facturacion || '',
      
      // Fechas - usar datos editados si están disponibles
      date: mindeeData.fecha_emision || mindeeData.date || new Date().toISOString().split('T')[0],
      due_date: mindeeData.due_date?.value || null,
      current_date: new Date().toLocaleDateString('es-ES'),
      
      // Información financiera - usar datos editados si están disponibles
      currency: mindeeData.moneda || mindeeData.currency || 'EUR',
      total_amount: mindeeData.total || mindeeData.total_amount || calculatedTotals.total,
      total_net: mindeeData.total_net || calculatedTotals.subtotal,
      total_tax: mindeeData.total_tax || calculatedTotals.totalTax,
      
      // Información de impuestos
      tax_rate: taxInfo.rate || 21,
      tax_base: taxInfo.base || 0,
      tax_amount: taxInfo.value || 0,
      
      // Documento - usar datos editados si están disponibles (solo si existe realmente)
      invoice_number: mindeeData.numero_factura || mindeeData.invoice_number || null,
      document_type: mindeeData.document_type || null,
      
      // Categoría del negocio (análisis IA)
      categoria: mindeeData.categoria_negocio || null,
      
      // Items procesados
      line_items: processedLineItems,
      
      // Información de pago
      payment_method: extractPaymentMethod(mindeeData.payment_details || [])
    };

    console.log(`${LOG_PREFIX} Datos del template preparados`);
    
    // Compilar HTML con los datos
    const html = await compileHtmlTemplate(templateData);
    console.log(`${LOG_PREFIX} Template HTML compilado`);
    
    // Generar PDF
    const pdfBuffer = await generatePdfFromHtml(html, templateData);
    console.log(`${LOG_PREFIX} PDF generado exitosamente`);
    
    // Crear nombre de archivo con proveedor y fecha
    const supplierName = (templateData.supplier || 'ticket').replace(/[^a-zA-Z0-9]/g, '_');
    const date = templateData.date ? templateData.date.replace(/[^0-9-]/g, '') : new Date().toISOString().split('T')[0];
    const fileName = `${supplierName}_${date}_${Date.now()}.pdf`;
    
    // Subir PDF a almacenamiento
    const pdfUrl = await uploadPdfToStorage(pdfBuffer, fileName);
    console.log(`${LOG_PREFIX} PDF subido a almacenamiento: ${pdfUrl}`);
    
    return {
      success: true,
      data: {
        download_url: pdfUrl,
        pdf_url: pdfUrl,
        pdf_buffer: pdfBuffer,
        file_name: fileName,
        generated_at: new Date().toISOString(),
        template_data: templateData,
        size: pdfBuffer.length
      }
    };
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Error generando PDF:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido generando PDF'
    };
  }
}

// Función auxiliar para mapear los items de línea
function mapLineItems(lineItems: any[]): any[] {
  if (!lineItems || lineItems.length === 0) {
    return [];
  }

  return lineItems.map(item => {
    // Verificar si es un edited_line_item (del componente EditReceiptDialog)
    if (item.concepto !== undefined && item.descripcion !== undefined) {
      const quantity = parseFloat(item.cantidad) || 1;
      const total = parseFloat(item.total) || 0;
      let unitPrice = parseFloat(item.precio) || 0;
      
      // Si no hay precio unitario pero sí total y cantidad, calcularlo
      if (unitPrice === 0 && total > 0 && quantity > 0) {
        unitPrice = total / quantity;
      }
      
      return {
        description: item.concepto || item.descripcion || 'Producto/Servicio',
        quantity: quantity,
        unit_price: unitPrice,
        total: total
      };
    }
    
    // Si no, es un line_item original de Mindee
    const quantity = parseFloat(item.quantity) || 1;
    const total = parseFloat(item.total_amount) || 0;
    let unitPrice = parseFloat(item.unit_price) || 0;
    
    // Si no hay precio unitario pero sí total y cantidad, calcularlo
    if (unitPrice === 0 && total > 0 && quantity > 0) {
      unitPrice = total / quantity;
    }
    
    return {
      description: item.description || 'Producto/Servicio',
      quantity: quantity,
      unit_price: unitPrice,
      total: total
    };
  });
}

// Función auxiliar para extraer información de pago
function extractPaymentMethod(paymentDetails: any[]): string {
  if (!paymentDetails || paymentDetails.length === 0) {
    return 'No especificado';
  }
  
  // Buscar métodos de pago comunes
  for (const detail of paymentDetails) {
    const paymentInfo = detail.payment_method?.toLowerCase() || '';
    const accountInfo = detail.account_number || '';
    
    if (paymentInfo.includes('card') || paymentInfo.includes('tarjeta')) {
      return 'Tarjeta de crédito/débito';
    } else if (paymentInfo.includes('transfer') || paymentInfo.includes('transferencia') || accountInfo) {
      return 'Transferencia bancaria';
    } else if (paymentInfo.includes('cash') || paymentInfo.includes('efectivo')) {
      return 'Efectivo';
    }
  }
  
  return 'No especificado';
}

// Función auxiliar para calcular totales basándose en los line items
function calculateTotalsFromLineItems(lineItems: any[]): {
  subtotal: number;
  totalTax: number;
  total: number;
} {
  let subtotal = 0;
  let totalTax = 0;
  
  lineItems.forEach(item => {
    const itemTotal = item.total || 0;
    subtotal += itemTotal;
    
    // Solo calcular impuestos si están especificados explícitamente
    if (item.impuestos !== undefined && item.impuestos > 0) {
      totalTax += (itemTotal * item.impuestos) / 100;
    }
    // NO asumir IVA automáticamente si no está especificado
  });
  
  const total = subtotal + totalTax;
  
  return {
    subtotal,
    totalTax,
    total
  };
}



// Función para crear el bucket de almacenamiento si no existe
export async function ensurePdfStorageBucket(): Promise<void> {
  try {
    // Intentar crear el bucket si no existe
    const { error } = await supabase.storage.createBucket('invoice-pdfs', {
      public: true,
      allowedMimeTypes: ['application/pdf'],
      fileSizeLimit: 10 * 1024 * 1024 // 10MB
    });
    
    if (error && !error.message.includes('already exists')) {
      console.error('Error creating storage bucket:', error);
    }
  } catch (error) {
    console.error('Error ensuring storage bucket:', error);
  }
}