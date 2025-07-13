import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    console.log('🚀 Creating portal session for user:', userId);

    if (!userId) {
      return NextResponse.json(
        { error: 'userId es requerido' },
        { status: 400 }
      );
    }

    // Crear cliente de Supabase con privilegios de administrador
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener información del usuario
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email, is_subscribed')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('❌ Profile not found:', profileError);
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    if (!profile.stripe_customer_id) {
      console.error('❌ No Stripe customer ID found for user:', userId);
      return NextResponse.json(
        { 
          error: 'No tienes una suscripción activa. Primero debes suscribirte a un plan.' 
        },
        { status: 400 }
      );
    }

    // Verificar que el customer existe en Stripe
    try {
      const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
      if (customer.deleted) {
        throw new Error('Customer deleted');
      }
    } catch (error) {
      console.error('❌ Stripe customer not found:', error);
      return NextResponse.json(
        { 
          error: 'Error accediendo a tu cuenta de Stripe. Contacta soporte.' 
        },
        { status: 400 }
      );
    }

    console.log('✅ Customer found, creating portal session');

    // Crear sesión del portal
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${request.nextUrl.origin}/dashboard/pricing`,
    });

    console.log('✅ Portal session created:', session.id);

    return NextResponse.json({ 
      url: session.url,
      customer_id: profile.stripe_customer_id
    });

  } catch (error: any) {
    console.error('❌ Error creating portal session:', error);
    
    // Manejo de errores específicos
    if (error.code === 'resource_missing') {
      return NextResponse.json(
        { 
          error: 'No se encontró la suscripción. Verifica que tengas una suscripción activa.' 
        },
        { status: 400 }
      );
    }

    // Error específico de configuración del portal
    if (error.code === 'invalid_request_error' && error.message?.includes('configuration')) {
      return NextResponse.json(
        { 
          error: 'Portal de cliente no configurado. Contacta soporte técnico.' 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error creando sesión del portal' },
      { status: 500 }
    );
  }
} 