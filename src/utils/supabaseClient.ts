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
    // eslint-disable-next-line no-console
    console.error('[Supabase] Variables NEXT_PUBLIC_SUPABASE_URL/ANON_KEY no configuradas');
    throw new Error('Variables de entorno de Supabase no configuradas.');
  }

  return createClient(url, anon);
};

export const supabaseService = (): SupabaseClient => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) {
    // eslint-disable-next-line no-console
    console.error('[Supabase] SUPABASE_SERVICE_ROLE_KEY no configurada');
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada.');
  }

  return createClient(url, service, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}; 