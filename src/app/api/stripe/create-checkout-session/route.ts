import { NextRequest, NextResponse } from 'next/server';
import { stripe, hasTrial } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    const { priceId, userId } = await request.json();

    console.log('🚀 Creating checkout session:', { priceId, userId });

    if (!priceId || !userId) {
      return NextResponse.json(
        { error: 'priceId y userId son requeridos' },
        { status: 400 }
      );
    }

    // Crear cliente de Supabase con privilegios de administrador
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener o crear customer de Stripe
    const customerId = await getOrCreateCustomer(userId, supabase);

    // No cancelar suscripciones existentes aquí - se hará en el webhook después de confirmación

    // Configurar sesión de checkout
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${request.nextUrl.origin}/dashboard/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/dashboard/pricing?canceled=true`,
      metadata: {
        userId: userId,
        priceId: priceId,
      },
      // Habilitar códigos de descuento
      allow_promotion_codes: true,
      // Configurar período de prueba para planes Pro
      subscription_data: hasTrial(priceId) ? {
        trial_period_days: 30,
        metadata: {
          userId: userId,
          trial_plan: 'pro',
        },
      } : {
        metadata: {
          userId: userId,
        },
      },
    };

    console.log('📝 Session config:', JSON.stringify(sessionConfig, null, 2));

    const session = await stripe.checkout.sessions.create(sessionConfig);
    
    console.log('✅ Checkout session created:', session.id);
    
    return NextResponse.json({ 
      sessionId: session.id,
      hasTrial: hasTrial(priceId)
    });

  } catch (error) {
    console.error('❌ Error creating checkout session:', error);
    
    // Mostrar detalles específicos del error para debug
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    
    console.error('Error details:', {
      message: errorMessage,
      stack: errorDetails,
      type: typeof error,
      error: error
    });
    
    return NextResponse.json(
      { 
        error: 'Error creando sesión de checkout',
        details: errorMessage,
        debug: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    );
  }
}

async function getOrCreateCustomer(userId: string, supabase: any): Promise<string> {
  console.log('🔍 Getting or creating customer for user:', userId);
  
  // Buscar customer existente
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error('❌ Profile not found:', profileError);
    throw new Error('Usuario no encontrado');
  }

  // Si ya tiene customer ID, verificar que existe en Stripe
  if (profile.stripe_customer_id) {
    try {
      const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
      if (!customer.deleted) {
        console.log('✅ Existing customer found:', profile.stripe_customer_id);
        return profile.stripe_customer_id;
      }
    } catch {
      console.log('⚠️ Customer not valid, creating new one');
      // Customer no válido, crear nuevo
    }
  }

  // Crear nuevo customer
  console.log('🆕 Creating new customer for:', profile.email);
  const customer = await stripe.customers.create({
    email: profile.email,
    metadata: {
      userId: userId,
    },
  });

  // Actualizar profile con customer ID
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId);

  if (updateError) {
    console.error('❌ Error updating profile with customer ID:', updateError);
  }

  console.log('✅ New customer created:', customer.id);
  return customer.id;
}

 