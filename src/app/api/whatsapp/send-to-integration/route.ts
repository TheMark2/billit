import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '@/utils/supabaseClient';

interface IntegrationRequest {
  phoneNumber: string;
  receiptId: string;
  integrationType: 'holded' | 'odoo' | 'xero';
  receiptData: any;
}

// Función para enviar a Holded
async function sendToHolded(empresaId: string, receiptData: any) {
  try {
    const supabase = supabaseService();
    
    // Obtener credenciales de Holded
    const { data: credentials } = await supabase
      .from('holded_credentials')
      .select('*')
      .eq('empresa_id', empresaId)
      .single();
    
    if (!credentials) {
      throw new Error('Credenciales de Holded no encontradas');
    }
    
    // Llamar a la API de Holded para crear la factura
    const holdedResponse = await fetch('https://api.holded.com/api/invoicing/v1/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'invoice',
        date: receiptData.date,
        dueDate: receiptData.dueDate,
        contactId: receiptData.contactId || null,
        items: receiptData.items || [],
        // Mapear otros campos según necesites
      })
    });
    
    if (!holdedResponse.ok) {
      throw new Error(`Error en Holded: ${holdedResponse.statusText}`);
    }
    
    return await holdedResponse.json();
  } catch (error) {
    throw error;
  }
}

// Función para enviar a Odoo
async function sendToOdoo(empresaId: string, receiptData: any) {
  try {
    const supabase = supabaseService();
    
    // Obtener credenciales de Odoo
    const { data: credentials } = await supabase
      .from('odoo_credentials')
      .select('*')
      .eq('empresa_id', empresaId)
      .single();
    
    if (!credentials) {
      throw new Error('Credenciales de Odoo no encontradas');
    }
    
    // Llamar a la API de Odoo para crear la factura
    const odooResponse = await fetch(`${credentials.url}/api/v1/invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        partner_id: receiptData.partnerId,
        invoice_date: receiptData.date,
        invoice_line_ids: receiptData.lines || [],
        // Mapear otros campos según necesites
      })
    });
    
    if (!odooResponse.ok) {
      throw new Error(`Error en Odoo: ${odooResponse.statusText}`);
    }
    
    return await odooResponse.json();
  } catch (error) {
    throw error;
  }
}

// Función para enviar a Xero
async function sendToXero(empresaId: string, receiptData: any) {
  try {
    const supabase = supabaseService();
    
    // Obtener credenciales de Xero
    const { data: credentials } = await supabase
      .from('xero_credentials')
      .select('*')
      .eq('empresa_id', empresaId)
      .single();
    
    if (!credentials) {
      throw new Error('Credenciales de Xero no encontradas');
    }
    
    // Llamar a la API de Xero para crear la factura
    const xeroResponse = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json',
        'Xero-tenant-id': credentials.tenant_id
      },
      body: JSON.stringify({
        Type: 'ACCREC',
        Date: receiptData.date,
        DueDate: receiptData.dueDate,
        LineItems: receiptData.lineItems || [],
        Contact: receiptData.contact || {},
        // Mapear otros campos según necesites
      })
    });
    
    if (!xeroResponse.ok) {
      throw new Error(`Error en Xero: ${xeroResponse.statusText}`);
    }
    
    return await xeroResponse.json();
  } catch (error) {
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, receiptId, integrationType, receiptData }: IntegrationRequest = await request.json();
    
    if (!phoneNumber || !receiptId || !integrationType) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }
    
    const supabase = supabaseService();
    
    // Obtener empresa del usuario
    const { data: profile } = await supabase
      .from('profiles')
      .select('empresa_id')
      .eq('phone_number', phoneNumber)
      .single();
    
    if (!profile) {
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 });
    }
    
    let result;
    
    // Enviar a la integración específica
    switch (integrationType) {
      case 'holded':
        result = await sendToHolded(profile.empresa_id, receiptData);
        break;
      case 'odoo':
        result = await sendToOdoo(profile.empresa_id, receiptData);
        break;
      case 'xero':
        result = await sendToXero(profile.empresa_id, receiptData);
        break;
      default:
        return NextResponse.json({ 
          error: 'Invalid integration type' 
        }, { status: 400 });
    }
    
    // Actualizar el recibo en la base de datos
    await supabase
      .from('receipts')
      .update({
        integration_sent: integrationType,
        integration_response: result,
        sent_at: new Date().toISOString()
      })
      .eq('id', receiptId);
    
    return NextResponse.json({ 
      success: true, 
      result,
      message: `Factura enviada a ${integrationType} correctamente` 
    });
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 