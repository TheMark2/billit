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
    const { action, receiptId, duplicateOfId } = body;

    if (!action || !receiptId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, receiptId' },
        { status: 400 }
      );
    }

    if (!['mark_duplicate', 'unmark_duplicate'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "mark_duplicate" or "unmark_duplicate"' },
        { status: 400 }
      );
    }

    if (action === 'mark_duplicate' && !duplicateOfId) {
      return NextResponse.json(
        { error: 'duplicateOfId is required when marking as duplicate' },
        { status: 400 }
      );
    }

    // Crear cliente con service role para usar las funciones de base de datos
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verificar que ambos recibos pertenecen al usuario
    if (action === 'mark_duplicate') {
      const { data: receipts, error: receiptsError } = await supabaseService
        .from('receipts')
        .select('id, user_id')
        .in('id', [receiptId, duplicateOfId]);

      if (receiptsError) {
        console.error('Error verifying receipts:', receiptsError);
        return NextResponse.json(
          { error: 'Error verifying receipts' },
          { status: 500 }
        );
      }

      if (!receipts || receipts.length !== 2) {
        return NextResponse.json(
          { error: 'One or both receipts not found' },
          { status: 404 }
        );
      }

      const userOwnsAllReceipts = receipts.every(receipt => receipt.user_id === user.id);
      if (!userOwnsAllReceipts) {
        return NextResponse.json(
          { error: 'Unauthorized - You do not own these receipts' },
          { status: 403 }
        );
      }
    } else {
      // Para unmark, solo verificar el recibo que se está desmarcando
      const { data: receipt, error: receiptError } = await supabaseService
        .from('receipts')
        .select('id, user_id')
        .eq('id', receiptId)
        .single();

      if (receiptError || !receipt) {
        return NextResponse.json(
          { error: 'Receipt not found' },
          { status: 404 }
        );
      }

      if (receipt.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized - You do not own this receipt' },
          { status: 403 }
        );
      }
    }

    // Ejecutar la acción
    let result;
    if (action === 'mark_duplicate') {
      const { data, error } = await supabaseService
        .rpc('mark_as_duplicate', {
          receipt_id_param: receiptId,
          duplicate_of_param: duplicateOfId
        });
      
      result = { success: data, error };
    } else {
      const { data, error } = await supabaseService
        .rpc('unmark_as_duplicate', {
          receipt_id_param: receiptId
        });
      
      result = { success: data, error };
    }

    if (result.error) {
      console.error(`Error ${action}:`, result.error);
      return NextResponse.json(
        { error: `Error ${action.replace('_', ' ')}` },
        { status: 500 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: 'Operation failed - receipt may not exist or already in requested state' },
        { status: 400 }
      );
    }

    // Actualizar el histórico de detecciones
    await supabaseService
      .from('duplicate_detections')
      .update({ 
        action_taken: action === 'mark_duplicate' ? 'marked_duplicate' : 'ignored'
      })
      .eq('receipt_id', receiptId)
      .eq('user_id', user.id);

    // Crear notificación de la acción
    try {
      const { createAutoNotification } = await import('@/app/api/notifications/route');
      
      if (action === 'mark_duplicate') {
        await createAutoNotification(
          user.id,
          'info',
          'Duplicado marcado',
          'Se ha marcado un recibo como duplicado correctamente.'
        );
      } else {
        await createAutoNotification(
          user.id,
          'info',
          'Duplicado desmarcado',
          'Se ha desmarcado un recibo como duplicado correctamente.'
        );
      }
    } catch (error) {
      console.warn('Could not create notification:', error);
    }

    return NextResponse.json({
      success: true,
      action: action,
      receiptId: receiptId,
      duplicateOfId: action === 'mark_duplicate' ? duplicateOfId : null,
      message: action === 'mark_duplicate' 
        ? 'Receipt marked as duplicate successfully'
        : 'Receipt unmarked as duplicate successfully'
    });

  } catch (error) {
    console.error('Error in manage-duplicates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 