import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
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

    // Crear cliente con service role para usar las funciones
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener jerarquía completa de carpetas
    const { data: folders, error: foldersError } = await supabaseService
      .rpc('get_folder_hierarchy', {
        user_id_param: user.id
      });

    if (foldersError) {
      console.error('Error getting folder hierarchy:', foldersError);
      return NextResponse.json(
        { error: 'Error getting folders' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      folders: folders || []
    });

  } catch (error) {
    console.error('Error in ticket-folders GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    const { name, description, parent_id, icon_name = 'folder', color = 'blue' } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      );
    }

    // Obtener la posición más alta para el nuevo folder
    const { data: maxPosition } = await supabase
      .from('ticket_folders')
      .select('"position"')
      .eq('user_id', user.id)
      .is('parent_id', parent_id || null)
      .order('"position"', { ascending: false })
      .limit(1)
      .single();

    const newPosition = (maxPosition?.position || 0) + 1;

    // Crear nueva carpeta
    const { data: newFolder, error: insertError } = await supabase
      .from('ticket_folders')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        parent_id: parent_id || null,
        icon_name,
        color,
        "position": newPosition
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating folder:', insertError);
      return NextResponse.json(
        { error: 'Error creating folder' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      folder: newFolder
    });

  } catch (error) {
    console.error('Error in ticket-folders POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
    const { action, ...data } = body;

    if (action === 'reorder') {
      // Reorganizar carpetas
      const { folder_positions } = data;

      if (!folder_positions || !Array.isArray(folder_positions)) {
        return NextResponse.json(
          { error: 'folder_positions array is required for reorder action' },
          { status: 400 }
        );
      }

      // Crear cliente con service role para usar las funciones
      const supabaseService = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: result, error: reorderError } = await supabaseService
        .rpc('reorder_folders', {
          folder_positions: JSON.stringify(folder_positions),
          user_id_param: user.id
        });

      if (reorderError) {
        console.error('Error reordering folders:', reorderError);
        return NextResponse.json(
          { error: 'Error reordering folders' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Folders reordered successfully'
      });

    } else if (action === 'update') {
      // Actualizar carpeta específica
      const { folder_id, name, description, icon_name, color, is_expanded } = data;

      if (!folder_id) {
        return NextResponse.json(
          { error: 'folder_id is required for update action' },
          { status: 400 }
        );
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description?.trim() || null;
      if (icon_name !== undefined) updateData.icon_name = icon_name;
      if (color !== undefined) updateData.color = color;
      if (is_expanded !== undefined) updateData.is_expanded = is_expanded;

      const { data: updatedFolder, error: updateError } = await supabase
        .from('ticket_folders')
        .update(updateData)
        .eq('id', folder_id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating folder:', updateError);
        return NextResponse.json(
          { error: 'Error updating folder' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        folder: updatedFolder
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "reorder" or "update"' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error in ticket-folders PUT:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    // Obtener folder_id de los parámetros de consulta
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folder_id');

    if (!folderId) {
      return NextResponse.json(
        { error: 'folder_id is required' },
        { status: 400 }
      );
    }

    // Verificar que la carpeta existe y pertenece al usuario
    const { data: existingFolder, error: folderError } = await supabase
      .from('ticket_folders')
      .select('id, name')
      .eq('id', folderId)
      .eq('user_id', user.id)
      .single();

    if (folderError || !existingFolder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    // Verificar si hay tickets en esta carpeta
    const { data: ticketsInFolder, error: ticketsError } = await supabase
      .from('receipts')
      .select('id')
      .eq('folder_id', folderId)
      .eq('user_id', user.id);

    if (ticketsError) {
      console.error('Error checking tickets in folder:', ticketsError);
      return NextResponse.json(
        { error: 'Error checking folder contents' },
        { status: 500 }
      );
    }

    // Si hay tickets, moverlos a "Sin categorizar" (carpeta sin parent_id)
    if (ticketsInFolder && ticketsInFolder.length > 0) {
      const { data: uncategorizedFolder } = await supabase
        .from('ticket_folders')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', 'Sin categorizar')
        .single();

      if (uncategorizedFolder) {
        await supabase
          .from('receipts')
          .update({ folder_id: uncategorizedFolder.id })
          .eq('folder_id', folderId)
          .eq('user_id', user.id);
      } else {
        // Si no existe "Sin categorizar", dejar como null
        await supabase
          .from('receipts')
          .update({ folder_id: null })
          .eq('folder_id', folderId)
          .eq('user_id', user.id);
      }
    }

    // Eliminar la carpeta
    const { error: deleteError } = await supabase
      .from('ticket_folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting folder:', deleteError);
      return NextResponse.json(
        { error: 'Error deleting folder' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Folder "${existingFolder.name}" deleted successfully`,
      tickets_moved: ticketsInFolder?.length || 0
    });

  } catch (error) {
    console.error('Error in ticket-folders DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 