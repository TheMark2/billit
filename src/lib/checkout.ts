"use client";

import { getStripe } from './stripe';
import { createClient } from '@supabase/supabase-js';

// Función para iniciar proceso de checkout
export async function initiateCheckout(priceId: string) {
  try {
    console.log('🚀 Initiating checkout for price:', priceId);

    // Verificar sesión del usuario
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      throw new Error('Debes iniciar sesión para continuar');
    }

    // Crear sesión de checkout
    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId,
        userId: session.user.id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Checkout session creation failed:', data);
      throw new Error(data.error || 'Error en checkout');
    }

    console.log('✅ Checkout session created:', data.sessionId);

    // Obtener cliente de Stripe
    const stripe = await getStripe();
    if (!stripe) {
      throw new Error('Stripe no está disponible');
    }

    // Redirigir a Stripe Checkout
    const { error } = await stripe.redirectToCheckout({ 
      sessionId: data.sessionId 
    });

    if (error) {
      console.error('❌ Redirect to checkout failed:', error);
      throw error;
    }

  } catch (error) {
    console.error('❌ Error en checkout:', error);
    throw error;
  }
}

// Función para abrir el portal de cliente
export async function openCustomerPortal() {
  try {
    console.log('🚀 Opening customer portal');

    // Verificar sesión del usuario
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      throw new Error('Debes iniciar sesión para continuar');
    }

    // Crear sesión del portal
    const response = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session.user.id }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Portal session creation failed:', data);
      throw new Error(data.error || 'Error abriendo portal');
    }

    console.log('✅ Portal session created, redirecting...');

    // Redirigir al portal
    window.location.href = data.url;

  } catch (error) {
    console.error('❌ Error abriendo portal:', error);
    throw error;
  }
}

// Función para obtener información del plan actual del usuario
export async function getCurrentPlan() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return null;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select(`
        *,
        plans:plan_id (
          id,
          nombre,
          descripcion,
          limite_recibos,
          precio
        )
      `)
      .eq('id', session.user.id)
      .single();

    return profile;

  } catch (error) {
    console.error('❌ Error getting current plan:', error);
    return null;
  }
}

// Función para verificar si el usuario tiene una suscripción activa
export async function hasActiveSubscription(): Promise<boolean> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return false;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_subscribed, subscription_status')
      .eq('id', session.user.id)
      .single();

    return profile?.is_subscribed && 
           ['active', 'trialing'].includes(profile.subscription_status);

  } catch (error) {
    console.error('❌ Error checking subscription status:', error);
    return false;
  }
}

// Función para verificar si el usuario está en período de prueba
export async function isTrialActive(): Promise<boolean> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return false;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status, trial_end')
      .eq('id', session.user.id)
      .single();

    if (profile?.subscription_status === 'trialing' && profile.trial_end) {
      const trialEnd = new Date(profile.trial_end);
      const now = new Date();
      return trialEnd > now;
    }

    return false;

  } catch (error) {
    console.error('❌ Error checking trial status:', error);
    return false;
  }
}

// Función para obtener días restantes del período de prueba
export async function getTrialDaysRemaining(): Promise<number> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return 0;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status, trial_end')
      .eq('id', session.user.id)
      .single();

    if (profile?.subscription_status === 'trialing' && profile.trial_end) {
      const trialEnd = new Date(profile.trial_end);
      const now = new Date();
      const diffTime = trialEnd.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    }

    return 0;

  } catch (error) {
    console.error('❌ Error getting trial days remaining:', error);
    return 0;
  }
} 