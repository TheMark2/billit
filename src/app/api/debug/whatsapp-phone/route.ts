import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();
    
    if (!phoneNumber) {
      return NextResponse.json({ error: 'phoneNumber is required' }, { status: 400 });
    }

    console.log('🔍 DEBUG - Número recibido:', phoneNumber);
    
    const supabase = getSupabaseService();
    
    // Obtener todos los números de teléfono existentes
    const { data: allUsers, error: allUsersError } = await supabase
      .from('profiles')
      .select('id, telefono, email, nombre, apellido')
      .order('created_at', { ascending: false });

    if (allUsersError) {
      console.error('Error obteniendo usuarios:', allUsersError);
    }

    // Generar todos los formatos posibles
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

    console.log('📱 DEBUG - Formatos generados:', phoneFormats);

    // Buscar coincidencias
    const matchResults = [];
    for (const format of phoneFormats) {
      const { data: user, error } = await supabase
        .from('profiles')
        .select('id, telefono, email, nombre, apellido, is_subscribed, plan_id')
        .eq('telefono', format)
        .single();

      matchResults.push({
        format,
        found: !error && user ? true : false,
        user: user || null,
        error: error ? error.message : null
      });
    }

    console.log('🔍 DEBUG - Resultados de búsqueda:', matchResults);

    return NextResponse.json({
      status: 'success',
      debug: {
        originalPhone: phoneNumber,
        allFormats: phoneFormats,
        matchResults,
        existingUsers: allUsers?.map(u => ({
          id: u.id,
          telefono: u.telefono,
          email: u.email,
          nombre: u.nombre,
          apellido: u.apellido
        })) || []
      }
    });

  } catch (error) {
    console.error('Error en debug endpoint:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phone');
    
    if (!phoneNumber) {
      return NextResponse.json({ error: 'phone parameter is required' }, { status: 400 });
    }

    // Reutilizar la lógica del POST
    return POST(new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
      headers: {
        'Content-Type': 'application/json'
      }
    }));

  } catch (error) {
    console.error('Error en debug GET:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 