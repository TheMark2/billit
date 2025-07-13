import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Consultando usuario por teléfono:', phone);

    // Crear cliente de Supabase con service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Buscar usuario por teléfono
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('telefono', phone)
      .single();

    if (userError || !user) {
      console.log('❌ Usuario no encontrado:', userError?.message);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('✅ Usuario encontrado:', user.id);

    // Obtener información del plan si existe
    let planInfo = null;
    if (user.plan_id) {
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('id', user.plan_id)
        .single();

      if (!planError && plan) {
        planInfo = plan;
      }
    }

    // Contar recibos del mes actual
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const { count: recibosCount, error: countError } = await supabase
      .from('receipts')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .gte('created_at', `${currentMonth}-01`)
      .lt('created_at', `${currentMonth}-31`);

    const recibosMessActual = recibosCount || 0;

    // Calcular límite de recibos y quota restante
    const limiteRecibos = planInfo?.limite_recibos || 100; // Default 100
    const recibosQuotaRemaining = limiteRecibos - recibosMessActual;
    const canProcessReceipt = recibosQuotaRemaining > 0;

    const response = {
      status: 'success',
      userid: user.id,
      id: user.id, // Alias para compatibilidad
      planid: user.plan_id,
      empresa_id: user.empresa_id,
      recibosMessActual,
      limiteRecibos,
      recibosQuotaRemaining,
      canProcessReceipt,
      user: {
        id: user.id,
        email: user.email,
        telefono: user.telefono,
        empresa_id: user.empresa_id,
        plan_id: user.plan_id,
        stripe_customer_id: user.stripe_customer_id,
        stripe_subscription_id: user.stripe_subscription_id,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      plan: planInfo
    };

    console.log('📊 Respuesta:', response);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error en get-user-by-phone:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Consultando usuario por teléfono (POST):', phone);

    // Crear cliente de Supabase con service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Buscar usuario por teléfono
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('telefono', phone)
      .single();

    if (userError || !user) {
      console.log('❌ Usuario no encontrado:', userError?.message);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('✅ Usuario encontrado:', user.id);

    // Obtener información del plan si existe
    let planInfo = null;
    if (user.plan_id) {
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('id', user.plan_id)
        .single();

      if (!planError && plan) {
        planInfo = plan;
      }
    }

    // Contar recibos del mes actual
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const { count: recibosCount, error: countError } = await supabase
      .from('receipts')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .gte('created_at', `${currentMonth}-01`)
      .lt('created_at', `${currentMonth}-31`);

    const recibosMessActual = recibosCount || 0;

    // Calcular límite de recibos y quota restante
    const limiteRecibos = planInfo?.limite_recibos || 100; // Default 100
    const recibosQuotaRemaining = limiteRecibos - recibosMessActual;
    const canProcessReceipt = recibosQuotaRemaining > 0;

    const response = {
      status: 'success',
      userid: user.id,
      id: user.id, // Alias para compatibilidad
      planid: user.plan_id,
      empresa_id: user.empresa_id,
      recibosMessActual,
      limiteRecibos,
      recibosQuotaRemaining,
      canProcessReceipt,
      user: {
        id: user.id,
        email: user.email,
        telefono: user.telefono,
        empresa_id: user.empresa_id,
        plan_id: user.plan_id,
        stripe_customer_id: user.stripe_customer_id,
        stripe_subscription_id: user.stripe_subscription_id,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      plan: planInfo
    };

    console.log('📊 Respuesta:', response);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error en get-user-by-phone:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 