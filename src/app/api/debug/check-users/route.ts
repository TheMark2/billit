import { NextResponse } from 'next/server';
import { supabaseService } from '@/utils/supabaseClient';

export async function GET() {
  try {
    // Crear cliente con service role para tener permisos completos
    const supabase = supabaseService();

    // Obtener todos los usuarios con sus números de teléfono
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, telefono, nombre, apellido, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching profiles:', error);
      return NextResponse.json({ error: 'Database error', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      total_users: profiles?.length || 0,
      users: profiles || [],
      message: 'Debug info for user phones'
    }, { status: 200 });

  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json({ error: 'Server error', details: error }, { status: 500 });
  }
} 