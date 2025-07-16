import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Obtener el token de autorización
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Crear cliente de Supabase
    const supabase = createClient(
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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Obtener datos del cuerpo de la petición
    const body = await request.json();
    const { ticket_ids, target_folder_id } = body;

    if (!ticket_ids || !Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return NextResponse.json(
        { error: 'ticket_ids array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Verificar que todos los tickets pertenecen al usuario
    const { data: existingTickets, error: ticketsError } = await supabase
      .from('receipts')
      .select('id')
      .in('id', ticket_ids)
      .eq('user_id', user.id);

    if (ticketsError) {
      console.error('Error verifying tickets:', ticketsError);
      return NextResponse.json(
        { error: 'Error verifying tickets' },
        { status: 500 }
      );
    }

    if (!existingTickets || existingTickets.length !== ticket_ids.length) {
      return NextResponse.json(
        { error: 'Some tickets not found or do not belong to user' },
        { status: 404 }
      );
    }

    // Si target_folder_id no es null, verificar que la carpeta existe y pertenece al usuario
    if (target_folder_id !== null) {
      const { data: targetFolder, error: folderError } = await supabase
        .from('ticket_folders')
        .select('id, name')
        .eq('id', target_folder_id)
        .eq('user_id', user.id)
        .single();

      if (folderError || !targetFolder) {
        return NextResponse.json(
          { error: 'Target folder not found or does not belong to user' },
          { status: 404 }
        );
      }
    }

    // Crear cliente con service role para usar las funciones
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Mover tickets usando la función de base de datos
    const { data: movedCount, error: moveError } = await supabaseService
      .rpc('move_tickets_to_folder', {
        ticket_ids: ticket_ids,
        target_folder_id: target_folder_id,
        user_id_param: user.id
      });

    if (moveError) {
      console.error('Error moving tickets:', moveError);
      return NextResponse.json(
        { error: 'Error moving tickets' },
        { status: 500 }
      );
    }

    // Obtener información de la carpeta destino para la respuesta
    let folderName = 'Sin categorizar';
    if (target_folder_id) {
      const { data: folderInfo } = await supabase
        .from('ticket_folders')
        .select('name')
        .eq('id', target_folder_id)
        .single();
      
      if (folderInfo) {
        folderName = folderInfo.name;
      }
    }

    return NextResponse.json({
      success: true,
      tickets_moved: movedCount,
      target_folder: {
        id: target_folder_id,
        name: folderName
      },
      message: `${movedCount} ticket(s) moved to "${folderName}"`
    });

  } catch (error) {
    console.error('Error in move-tickets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 