import { NextRequest, NextResponse } from 'next/server';
import { stripe, getPlanNameFromPriceId, getBillingPeriod } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature') as string;

  console.log('🎣 Webhook received - signature present:', !!signature);

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err);
    return NextResponse.json({ received: false }, { status: 400 });
  }

  console.log('✅ Webhook verified successfully');
  console.log('📨 Processing webhook event:', event.type, 'ID:', event.id);

  // Crear cliente de Supabase con privilegios de administrador
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription, supabase);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(event.data.object as Stripe.Subscription, supabase);
        break;
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription, supabase);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice, supabase);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice, supabase);
        break;
      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    return NextResponse.json({ received: false }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription, supabase: any) {
  const customerId = subscription.customer as string;
  const status = subscription.status;
  const priceId = subscription.items.data[0]?.price?.id;
  
  console.log('🔄 Subscription update received:');
  console.log('  - Customer ID:', customerId);
  console.log('  - Status:', status);
  console.log('  - Price ID:', priceId);
  console.log('  - Subscription ID:', subscription.id);
  console.log('  - Trial end:', subscription.trial_end);
  console.log('  - Current period end:', subscription.current_period_end);

  if (!priceId) {
    console.error('❌ No price ID found in subscription');
    return;
  }

  // Obtener información del plan
  const planName = getPlanNameFromPriceId(priceId);
  const billingPeriod = getBillingPeriod(priceId);
  
  if (!planName) {
    console.error('❌ Unknown price ID:', priceId);
    return;
  }

  console.log('📋 Plan details:', { planName, billingPeriod });

  // Buscar el plan en la base de datos
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id')
    .eq('nombre', planName)
    .single();

  if (planError || !plan) {
    console.error('❌ Plan not found in database:', planName, planError);
    return;
  }

  // Obtener perfil del usuario
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, stripe_subscription_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profileError || !profile) {
    console.error('❌ Profile not found for customer:', customerId, profileError);
    return;
  }

  // Cancelar suscripciones anteriores si existen Y la nueva suscripción está activa
  if (profile.stripe_subscription_id && profile.stripe_subscription_id !== subscription.id && ['active', 'trialing'].includes(status)) {
    try {
      console.log('🗑️ Canceling previous subscription:', profile.stripe_subscription_id);
      await stripe.subscriptions.cancel(profile.stripe_subscription_id);
    } catch (error) {
      console.log('⚠️ Could not cancel previous subscription (may already be canceled)');
    }
  }

  // Determinar si está en período de prueba
  const isTrialing = status === 'trialing';
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;

  // Actualizar perfil con nueva suscripción
  const updateData = {
    stripe_subscription_id: subscription.id,
    subscription_status: status,
    plan_id: plan.id,
    is_subscribed: ['active', 'trialing'].includes(status),
    trial_end: trialEnd ? trialEnd.toISOString() : null,
    billing_period: billingPeriod,
  };

  console.log('📝 Updating profile with:', updateData);

  const { error: updateError } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('stripe_customer_id', customerId);

  if (updateError) {
    console.error('❌ Error updating profile:', updateError);
  } else {
    console.log(`✅ Profile updated successfully - Status: ${status}, Plan: ${planName}, Trial: ${isTrialing}`);
  }
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription, supabase: any) {
  const customerId = subscription.customer as string;

  console.log('🗑️ Subscription canceled for customer:', customerId);

  // Obtener plan básico
  const { data: basicPlan, error: planError } = await supabase
    .from('plans')
    .select('id')
    .eq('nombre', 'Básico')
    .single();

  if (planError || !basicPlan) {
    console.error('❌ Basic plan not found:', planError);
    return;
  }

  // Actualizar perfil a plan básico
  const updateData = {
    stripe_subscription_id: null,
    subscription_status: 'canceled',
    plan_id: basicPlan.id,
    is_subscribed: false,
    trial_end: null,
    billing_period: null,
  };

  const { error: updateError } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('stripe_customer_id', customerId);

  if (updateError) {
    console.error('❌ Error updating profile on cancellation:', updateError);
  } else {
    console.log('✅ Profile updated to basic plan');
  }
}

async function handleTrialWillEnd(subscription: Stripe.Subscription, supabase: any) {
  const customerId = subscription.customer as string;
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;

  console.log('⏰ Trial will end for customer:', customerId, 'at:', trialEnd);

  // Obtener información del usuario para notificaciones futuras
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, nombre')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profile) {
    console.log('📧 Trial ending for user:', profile.email);
    // Aquí podrías enviar un email de notificación
    // TODO: Implementar notificación por email
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice, supabase: any) {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string;

  console.log('💰 Payment succeeded for customer:', customerId);
  console.log('📄 Invoice ID:', invoice.id);
  console.log('🔄 Subscription ID:', subscriptionId);

  // Verificar que es el primer pago después de un trial
  if (invoice.billing_reason === 'subscription_cycle') {
    console.log('🎉 First payment after trial completed');
  }

  // Asegurar que el perfil esté marcado como suscrito activo
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ 
      is_subscribed: true,
      subscription_status: 'active',
      trial_end: null, // Limpiar fecha de fin de trial
    })
    .eq('stripe_customer_id', customerId);

  if (updateError) {
    console.error('❌ Error updating payment status:', updateError);
  } else {
    console.log('✅ Payment status updated successfully');
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice, supabase: any) {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string;

  console.log('❌ Payment failed for customer:', customerId);
  console.log('📄 Invoice ID:', invoice.id);
  console.log('🔄 Subscription ID:', subscriptionId);

  // Obtener información del usuario para notificaciones
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, nombre')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profile) {
    console.log('📧 Payment failed for user:', profile.email);
    // Aquí podrías enviar un email de notificación
    // TODO: Implementar notificación por email de pago fallido
  }

  // Marcar el estado como payment_failed pero mantener acceso hasta que Stripe cancele
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ 
      subscription_status: 'payment_failed',
    })
    .eq('stripe_customer_id', customerId);

  if (updateError) {
    console.error('❌ Error updating payment failed status:', updateError);
  }
} 