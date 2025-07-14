import { SupabaseClient, createClient } from '@supabase/supabase-js';

/*
  NOTA
  ----
  Ya no lanzamos error en el scope de módulo para evitar fallos de compilación si las variables
  no están disponibles en el build. Comprobamos cuando realmente se intenta crear el cliente.
*/

export const supabaseBrowser = (): SupabaseClient => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error('Variables de entorno de Supabase no configuradas.');
  }

  return createClient(url, anon);
};

export const supabaseService = (): SupabaseClient => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada.');
  }

  return createClient(url, service, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export async function checkUserSubscription(phoneNumber: string) {
  const supabase = supabaseService();
  
  const { data, error } = await supabase
    .from('profiles')
    .select('id, is_subscribed, plan_id, recibos_mes_actual')
    .eq('phone_number', phoneNumber)
    .single();

  if (error || !data) {
    return { 
      isSubscribed: false, 
      userId: null, 
      planId: null, 
      quotaAvailable: false, 
      remainingQuota: 0 
    };
  }

  // Verificar cuota disponible (ejemplo: plan básico = 50 recibos)
  const planLimits = {
    'basic': 50,
    'pro': 200,
    'enterprise': 1000
  };

  const currentLimit = planLimits[data.plan_id as keyof typeof planLimits] || 0;
  const remainingQuota = currentLimit - (data.recibos_mes_actual || 0);

  return {
    isSubscribed: data.is_subscribed,
    userId: data.id,
    planId: data.plan_id,
    quotaAvailable: remainingQuota > 0,
    remainingQuota
  };
} 