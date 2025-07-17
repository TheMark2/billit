import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Obtener notificaciones del usuario
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Verificar autenticación
    const { data: { user }, error: authError } = await userSupabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unread_only') === 'true';

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json(
        { error: 'Error fetching notifications' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      unread_count: notifications?.filter(n => !n.is_read).length || 0
    });

  } catch (error) {
    console.error('Error in notifications GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Crear nueva notificación
export async function POST(request: NextRequest) {
  try {
    const { 
      user_id, 
      title, 
      message, 
      type, 
      action_url, 
      metadata, 
      receipt_id 
    } = await request.json();

    if (!user_id || !title || !message || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, title, message, type' },
        { status: 400 }
      );
    }

    // Validar tipo de notificación
    const validTypes = ['success', 'error', 'warning', 'info', 'payment', 'subscription', 'integration', 'limit', 'welcome'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid notification type' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('create_notification', {
      p_user_id: user_id,
      p_title: title,
      p_message: message,
      p_type: type,
      p_action_url: action_url || null,
      p_metadata: metadata || {},
      p_receipt_id: receipt_id || null
    });

    if (error) {
      console.error('Error creating notification:', error);
      return NextResponse.json(
        { error: 'Error creating notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      notification_id: data
    });

  } catch (error) {
    console.error('Error in notifications POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH: Marcar notificaciones como leídas
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Verificar autenticación
    const { data: { user }, error: authError } = await userSupabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    const { notification_ids } = await request.json();

    const { data, error } = await supabase.rpc('mark_notifications_as_read', {
      p_user_id: user.id,
      p_notification_ids: notification_ids || null
    });

    if (error) {
      console.error('Error marking notifications as read:', error);
      return NextResponse.json(
        { error: 'Error updating notifications' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      affected_count: data
    });

  } catch (error) {
    console.error('Error in notifications PATCH:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}