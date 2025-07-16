import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const receiptId = searchParams.get('receipt_id');
    
    if (!receiptId) {
      return NextResponse.json(
        { error: 'receipt_id parameter is required' },
        { status: 400 }
      );
    }

    // Obtener el recibo completo
    const { data: receipt, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (error || !receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Función para explorar la estructura anidada
    function exploreStructure(obj: any, path: string = '', maxDepth: number = 5): any {
      if (maxDepth <= 0) return '[MAX_DEPTH_REACHED]';
      
      if (obj === null || obj === undefined) return obj;
      
      if (typeof obj !== 'object') return obj;
      
      if (Array.isArray(obj)) {
        if (obj.length === 0) return [];
        return [exploreStructure(obj[0], `${path}[0]`, maxDepth - 1)];
      }
      
      const result: any = {};
      const keys = Object.keys(obj);
      
      // Mostrar solo las primeras 10 claves para evitar overflow
      keys.slice(0, 10).forEach(key => {
        result[key] = exploreStructure(obj[key], `${path}.${key}`, maxDepth - 1);
      });
      
      if (keys.length > 10) {
        result['[...more_keys]'] = `${keys.length - 10} more keys`;
      }
      
      return result;
    }

    // Analizar la estructura de metadatos
    const metadataStructure = exploreStructure(receipt.metadatos);
    
    // Buscar line_items en diferentes paths posibles
    const lineItemsPaths = [
      'metadatos.mindee_data.line_items',
      'metadatos.mindee_data.prediction.line_items',
      'metadatos.mindee_data.document.inference.prediction.line_items',
      'metadatos.edited_line_items',
      'texto_extraido (parsed).line_items'
    ];

    const lineItemsAnalysis: any = {};
    
    // Verificar cada path
    lineItemsAnalysis['metadatos.mindee_data.line_items'] = receipt.metadatos?.mindee_data?.line_items || 'NOT_FOUND';
    lineItemsAnalysis['metadatos.mindee_data.prediction.line_items'] = receipt.metadatos?.mindee_data?.prediction?.line_items || 'NOT_FOUND';
    lineItemsAnalysis['metadatos.mindee_data.document.inference.prediction.line_items'] = receipt.metadatos?.mindee_data?.document?.inference?.prediction?.line_items || 'NOT_FOUND';
    lineItemsAnalysis['metadatos.edited_line_items'] = receipt.metadatos?.edited_line_items || 'NOT_FOUND';
    
    // Intentar parsear texto_extraido
    let parsedTextoExtraido = null;
    try {
      if (receipt.texto_extraido) {
        parsedTextoExtraido = JSON.parse(receipt.texto_extraido);
        lineItemsAnalysis['texto_extraido.line_items'] = parsedTextoExtraido.line_items || 'NOT_FOUND';
        lineItemsAnalysis['texto_extraido.prediction.line_items'] = parsedTextoExtraido.prediction?.line_items || 'NOT_FOUND';
      }
    } catch (e) {
      lineItemsAnalysis['texto_extraido'] = 'PARSE_ERROR';
    }

    // Encontrar el path correcto para line_items
    let foundLineItems = null;
    let foundPath = null;
    
    for (const [path, value] of Object.entries(lineItemsAnalysis)) {
      if (value !== 'NOT_FOUND' && value !== 'PARSE_ERROR' && Array.isArray(value)) {
        foundLineItems = value;
        foundPath = path;
        break;
      }
    }

    return NextResponse.json({
      success: true,
      receipt_id: receiptId,
      receipt_basic_info: {
        id: receipt.id,
        proveedor: receipt.proveedor,
        total: receipt.total,
        fecha_emision: receipt.fecha_emision,
        numero_factura: receipt.numero_factura,
        created_at: receipt.created_at
      },
      metadata_structure: metadataStructure,
      line_items_analysis: lineItemsAnalysis,
      found_line_items: {
        path: foundPath,
        count: foundLineItems?.length || 0,
        items: foundLineItems ? foundLineItems.slice(0, 3) : null // Mostrar solo los primeros 3
      },
      texto_extraido_structure: parsedTextoExtraido ? exploreStructure(parsedTextoExtraido, 'texto_extraido', 3) : null
    });

  } catch (error) {
    console.error('❌ [DEBUG_RECEIPT_STRUCTURE] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 