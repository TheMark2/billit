import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
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
    
    // Leer el template HTML
    const templatePath = path.join(process.cwd(), 'src/templates/invoice-template.html');
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
async function generatePdfFromHtml(html: string): Promise<Buffer> {
  let browser;
  
  try {
    // Configurar Puppeteer con chromium optimizado para Vercel
    const isDev = process.env.NODE_ENV === 'development';
    
    browser = await puppeteer.launch({
      args: isDev ? [] : [
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
      executablePath: isDev ? undefined : await chromium.executablePath(),
      headless: true
    });
    
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
      .from('invoice-pdfs')
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
      .from('invoice-pdfs')
      .getPublicUrl(filePath);
    
    return publicUrlData.publicUrl;
    
  } catch (error) {
    console.error('Error in uploadPdfToStorage:', error);
    throw error;
  }
}

// Función principal para generar PDF (reemplaza a generatePdfWithApiTemplate)
export async function generatePdfWithPuppeteer(mindeeData: any, userId?: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  const LOG_PREFIX = '🔄 [PDF_GENERATOR]';
  
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
        // Obtener información de la empresa del usuario
        const { data: profile } = await supabase
          .from('profiles')
          .select('empresa_id')
          .eq('id', userId)
          .single();

        if (profile?.empresa_id) {
          const { data: empresa } = await supabase
            .from('empresas')
            .select('nombre_fiscal, cif, direccion, email_facturacion, telefono')
            .eq('id', profile.empresa_id)
            .single();

          if (empresa) {
            companyInfo = empresa;
          }
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
    
    // Procesar line items
    const processedLineItems = mapLineItems(mindeeData.line_items || []);
    
    // Mapear los datos para el template
    const templateData = {
      // Información del proveedor
      supplier: mindeeData.supplier_name || 'Proveedor no identificado',
      supplier_cif: supplierRegistration,
      supplier_phone: supplierPhone,
      supplier_email: supplierEmail,
      adress: mindeeData.supplier_address || 'Dirección no disponible',
      city: extractCityFromAddress(mindeeData.supplier_address),
      
      // Información del cliente (empresa del usuario)
      customer_name: companyInfo.nombre_fiscal,
      customer_cif: companyInfo.cif,
      customer_address: companyInfo.direccion || '',
      customer_phone: companyInfo.telefono || '',
      customer_email: companyInfo.email_facturacion || '',
      
      // Fechas
      date: mindeeData.date || new Date().toISOString().split('T')[0],
      due_date: mindeeData.due_date?.value || null,
      current_date: new Date().toLocaleDateString('es-ES'),
      
      // Información financiera
      currency: mindeeData.currency || 'EUR',
      total_amount: mindeeData.total_amount || 0,
      total_net: mindeeData.total_net || 0,
      total_tax: mindeeData.total_tax || 0,
      
      // Información de impuestos
      tax_rate: taxInfo.rate || 21,
      tax_base: taxInfo.base || 0,
      tax_amount: taxInfo.value || 0,
      
      // Documento
      invoice_number: mindeeData.invoice_number || `AUTO-${Date.now()}`,
      document_type: mindeeData.document_type || 'Factura',
      
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
    const pdfBuffer = await generatePdfFromHtml(html);
    console.log(`${LOG_PREFIX} PDF generado exitosamente`);
    
    // Crear nombre de archivo único
    const fileName = `invoice-${templateData.invoice_number}-${Date.now()}.pdf`;
    
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
    return [{
      description: 'Producto/Servicio no especificado',
      quantity: 1,
      unit_price: 0,
      total: 0
    }];
  }

  return lineItems.map(item => ({
    description: item.description || 'Producto/Servicio',
    quantity: parseFloat(item.quantity) || 1,
    unit_price: parseFloat(item.unit_price) || 0,
    total: parseFloat(item.total_amount) || 0
  }));
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

// Función auxiliar para extraer la ciudad de la dirección
function extractCityFromAddress(address: string | null): string {
  if (!address) return 'Ciudad no disponible';
  
  // Buscar patrones comunes de ciudades en España
  const cityPatterns = [
    /([A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+)(?:,|\s+\d{5}|\s+[A-Z]{2})/,
    /([A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+)$/
  ];
  
  for (const pattern of cityPatterns) {
    const match = address.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return address.split(',')[0].trim() || 'Ciudad no disponible';
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