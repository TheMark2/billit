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
    const { receiptId, proveedor, total, fechaEmision, thresholdDays = 7, thresholdAmount = 5.0 } = body;

    if (!proveedor || total === undefined || !fechaEmision) {
      return NextResponse.json(
        { error: 'Missing required fields: proveedor, total, fechaEmision' },
        { status: 400 }
      );
    }

    // Crear cliente con service role para usar las funciones de base de datos
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Llamar a la función de detección de duplicados
    const { data: duplicates, error: duplicatesError } = await supabaseService
      .rpc('find_potential_duplicates', {
        user_id_param: user.id,
        proveedor_param: proveedor,
        total_param: total,
        fecha_emision_param: fechaEmision,
        threshold_days: thresholdDays,
        threshold_amount: thresholdAmount
      });

    if (duplicatesError) {
      console.error('Error finding duplicates:', duplicatesError);
      return NextResponse.json(
        { error: 'Error detecting duplicates' },
        { status: 500 }
      );
    }

    // Filtrar el recibo actual si se proporcionó su ID
    const filteredDuplicates = receiptId 
      ? duplicates?.filter((dup: any) => dup.receipt_id !== receiptId) || []
      : duplicates || [];

    // Guardar el histórico de detección si hay duplicados
    if (filteredDuplicates.length > 0) {
      const potentialDuplicateIds = filteredDuplicates.map((dup: any) => dup.receipt_id);
      const similarityScores = filteredDuplicates.map((dup: any) => dup.similarity_score);

      await supabaseService
        .from('duplicate_detections')
        .insert({
          user_id: user.id,
          receipt_id: receiptId || null,
          potential_duplicates: potentialDuplicateIds,
          similarity_scores: similarityScores,
          action_taken: 'pending'
        });
    }

    return NextResponse.json({
      success: true,
      duplicates: filteredDuplicates,
      count: filteredDuplicates.length,
      detection_params: {
        threshold_days: thresholdDays,
        threshold_amount: thresholdAmount
      }
    });

  } catch (error) {
    console.error('Error in detect-duplicates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    // Obtener histórico de detecciones de duplicados
    const { data: detections, error: detectionsError } = await supabase
      .from('duplicate_detections')
      .select('*')
      .eq('user_id', user.id)
      .order('detection_date', { ascending: false })
      .limit(50);

    if (detectionsError) {
      console.error('Error getting duplicate detections:', detectionsError);
      return NextResponse.json(
        { error: 'Error getting duplicate detections' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      detections: detections || []
    });

  } catch (error) {
    console.error('Error in get duplicate detections:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 