import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Crear cliente de Supabase con service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener credenciales de Odoo
    const { data: credentials, error } = await supabase
      .from('odoo_credentials')
      .select('url, database, username, password')
      .eq('user_id', userId)
      .single();

    if (error || !credentials) {
      console.error('Error fetching Odoo credentials:', error);
      return NextResponse.json(
        { error: 'Odoo credentials not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: 'success',
      credentials: {
        url: credentials.url,
        database: credentials.database,
        username: credentials.username,
        password: credentials.password
      }
    });

  } catch (error) {
    console.error('Error in get-odoo-credentials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 