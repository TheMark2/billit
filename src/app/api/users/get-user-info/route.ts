import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Este endpoint está protegido por API key para uso desde n8n
export async function POST(request: NextRequest) {
  try {
    // Verificar API key de n8n
    const apiKey = request.headers.get('x-api-key');
    const expectedApiKey = process.env.N8N_SECRET_KEY;
    
    if (!apiKey || apiKey !== expectedApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    // Crear cliente de Supabase con service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener información del usuario desde la tabla profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        nombre,
        apellido,
        email,
        telefono,
        ciudad,
        empresa,
        recibos_mes_actual,
        plan_id,
        plans(nombre, limite_recibos)
      `)
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Obtener información del usuario desde auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user_id);

    if (authError) {
      console.error('Error fetching auth user:', authError);
      return NextResponse.json(
        { error: 'Auth user not found' },
        { status: 404 }
      );
    }

    // Combinar información
    const userInfo = {
      user_id: profile.id,
      email: profile.email || authUser.user?.email,
      nombre: profile.nombre,
      apellido: profile.apellido,
      nombre_completo: `${profile.nombre || ''} ${profile.apellido || ''}`.trim(),
      telefono: profile.telefono,
      ciudad: profile.ciudad,
      empresa: profile.empresa,
      recibos_mes_actual: profile.recibos_mes_actual || 0,
      plan: {
        id: profile.plan_id,
        nombre: (profile.plans as any)?.nombre || 'Básico',
        limite_recibos: (profile.plans as any)?.limite_recibos || 50
      },
      created_at: authUser.user?.created_at
    };

    return NextResponse.json({
      status: 'success',
      user: userInfo
    });

  } catch (error) {
    console.error('Error in get-user-info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 