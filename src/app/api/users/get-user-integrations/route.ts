import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Intentar diferentes formatos del número
    const phoneFormats = [
      phone, // Formato original
      `+34${phone}`, // Añadir +34
      phone.replace('+34', ''), // Quitar +34
      `+${phone}`, // Añadir +
      phone.replace('+', '') // Quitar +
    ];

    let profile = null;
    let foundWithFormat = '';

    // Buscar el usuario con diferentes formatos - USAR 'telefono' en lugar de 'phone'
    for (const phoneFormat of phoneFormats) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, empresa_id, telefono')
        .eq('telefono', phoneFormat)
        .single();

      if (!error && data) {
        profile = data;
        foundWithFormat = phoneFormat;
        break;
      }
    }

    if (!profile) {
      // Debug: mostrar todos los números de teléfono en la base de datos
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('telefono')
        .limit(5);

      return NextResponse.json({ 
        error: 'User not found',
        debug: {
          searchedPhone: phone,
          searchedFormats: phoneFormats,
          samplePhones: allProfiles?.map(p => p.telefono) || []
        }
      }, { status: 404 });
    }

    // Obtener las integraciones activas del usuario
    const integraciones = [];

    // Verificar Odoo
    const { data: odooData, error: odooError } = await supabase
      .from('odoo_credentials')
      .select('*')
      .eq('user_id', profile.id)
      .single();

    if (!odooError && odooData) {
      integraciones.push({
        integration_type: 'odoo',
        name: 'Odoo',
        icon: '🟢',
        configured: true
      });
    }

    // Verificar Holded
    const { data: holdedData, error: holdedError } = await supabase
      .from('holded_credentials')
      .select('*')
      .eq('user_id', profile.id)
      .single();

    if (!holdedError && holdedData) {
      integraciones.push({
        integration_type: 'holded',
        name: 'Holded',
        icon: '🔵',
        configured: true
      });
    }

    // Verificar Xero
    const { data: xeroData, error: xeroError } = await supabase
      .from('xero_credentials')
      .select('*')
      .eq('user_id', profile.id)
      .single();

    if (!xeroError && xeroData) {
      integraciones.push({
        integration_type: 'xero',
        name: 'Xero',
        icon: '🟡',
        configured: true
      });
    }

    return NextResponse.json({
      success: true,
      user_id: profile.id,
      empresa_id: profile.empresa_id,
      phone: phone,
      found_with_format: foundWithFormat,
      integrations: integraciones,
      total_integraciones: integraciones.length
    });

  } catch (error) {
    console.error('Error getting user integrations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 