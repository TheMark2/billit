import { supabaseService, supabaseBrowser } from '@/utils/supabaseClient';

// Crear función que devuelve la instancia solo cuando se necesita
export const getSupabaseService = () => supabaseService();

// Exportar supabase que detecta automáticamente si está en servidor o cliente
export const supabase = (() => {
  // Verificar si estamos en el servidor (Node.js)
  const isServer = typeof window === 'undefined';
  
  if (isServer) {
    // En el servidor, usar supabaseService
    return supabaseService();
  } else {
    // En el cliente, usar supabaseBrowser
    return supabaseBrowser();
  }
})(); 