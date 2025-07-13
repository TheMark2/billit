import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Buscar el usuario por número de teléfono
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, empresa_id')
      .eq('phone', phone)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
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
        type: 'odoo',
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
        type: 'holded',
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
        type: 'xero',
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
      integraciones: integraciones,
      total_integraciones: integraciones.length
    });

  } catch (error) {
    console.error('Error getting user integrations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 