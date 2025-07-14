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
  
  // Intentar diferentes formatos del número de teléfono
  const phoneFormats = [
    phoneNumber, // Formato original
    phoneNumber.replace('whatsapp:', ''), // Quitar prefijo whatsapp:
    phoneNumber.replace('whatsapp:', '').replace('+', ''), // Quitar whatsapp: y +
    phoneNumber.replace('+', ''), // Solo quitar +
    `+34${phoneNumber}`, // Añadir +34
    phoneNumber.replace('+34', ''), // Quitar +34
    `+${phoneNumber}`, // Añadir +
    phoneNumber.replace('+', ''), // Quitar +
    phoneNumber.replace(/\D/g, '') // Solo números
  ];

  console.log('🔍 Buscando usuario con número:', phoneNumber);
  console.log('📱 Formatos a probar:', phoneFormats);

  let profile = null;
  let foundWithFormat = '';

  // Buscar el usuario con diferentes formatos
  for (const phoneFormat of phoneFormats) {
    console.log(`🔎 Probando formato: "${phoneFormat}"`);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, is_subscribed, plan_id, recibos_mes_actual, telefono')
      .eq('telefono', phoneFormat)
      .single();

    if (!error && data) {
      profile = data;
      foundWithFormat = phoneFormat;
      console.log(`✅ Usuario encontrado con formato: "${phoneFormat}"`);
      break;
    } else {
      console.log(`❌ No encontrado con formato: "${phoneFormat}"`);
    }
  }

  if (!profile) {
    // Debug: mostrar algunos números de teléfono de la base de datos
    console.log('🔍 Mostrando usuarios existentes para debug:');
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('telefono, email')
      .limit(10);

    console.log('📋 Números existentes:', allProfiles?.map(p => p.telefono) || []);
    
    return { 
      isSubscribed: false, 
      userId: null, 
      planId: null, 
      quotaAvailable: false, 
      remainingQuota: 0,
      debug: {
        searchedPhone: phoneNumber,
        searchedFormats: phoneFormats,
        existingPhones: allProfiles?.map(p => p.telefono) || []
      }
    };
  }

  console.log('✅ Usuario encontrado:', profile);

  // Verificar cuota disponible (ejemplo: plan básico = 50 recibos)
  const planLimits = {
    'basic': 50,
    'pro': 200,
    'enterprise': 1000
  };

  const currentLimit = planLimits[profile.plan_id as keyof typeof planLimits] || 0;
  const remainingQuota = currentLimit - (profile.recibos_mes_actual || 0);

  return {
    isSubscribed: profile.is_subscribed,
    userId: profile.id,
    planId: profile.plan_id,
    quotaAvailable: remainingQuota > 0,
    remainingQuota,
    foundWithFormat
  };
} 