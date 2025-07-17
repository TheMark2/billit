import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// Función para analizar el contenido del ticket con IA
async function analyzeReceiptWithAI(receiptData: any) {
  try {
    // Extraer información relevante del ticket
    const provider = receiptData.proveedor || '';
    const textContent = receiptData.texto_extraido || '';
    const lineItems = receiptData.metadatos?.mindee_data?.line_items || [];
    const total = receiptData.total || 0;
    
    // Construir prompt para la IA
    const prompt = `
Analiza este ticket de compra y proporciona:
1. Una descripción corta (máximo 50 palabras) de la compra
2. La categoría del negocio (una palabra: Restaurante, Supermercado, Farmacia, Gasolinera, Ropa, Tecnología, Salud, Transporte, Entretenimiento, Servicios, u Otros)

Información del ticket:
- Proveedor: ${provider}
- Total: ${total}€
- Productos: ${lineItems.map((item: any) => item.description || item.name).join(', ')}
- Texto extraído: ${textContent.substring(0, 500)}

Responde SOLO en formato JSON:
{
  "descripcion": "descripción corta de la compra",
  "categoria": "categoría del negocio"
}
`;

    console.log('Calling DeepSeek API for receipt analysis...');
    // Llamar a DeepSeek API
    let data;
    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer sk-b8592af681da40df8d36772bc3f6d716`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: 'Eres un asistente especializado en analizar tickets de compra. Responde siempre en formato JSON válido.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 150,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status} - ${response.statusText}`);
      }

      data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content received from DeepSeek');
      }
    } catch (apiError) {
      console.error('Error calling DeepSeek API:', apiError);
      throw new Error(`DeepSeek API error: ${apiError.message}`);
    }

      // Limpiar la respuesta de DeepSeek (puede venir con formato markdown)
      let cleanContent = data.choices[0]?.message?.content.trim();
      
      console.log('Respuesta original de DeepSeek:', cleanContent);
      
      // Remover bloques de código markdown si existen
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      console.log('Contenido limpio para parsear:', cleanContent);
      
      // Intentar parsear la respuesta JSON con manejo de errores mejorado
      let analysis;
      try {
        analysis = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('Error al parsear JSON:', parseError);
        // Intentar extraer JSON válido usando regex como fallback
        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            analysis = JSON.parse(jsonMatch[0]);
            console.log('JSON extraído con regex:', jsonMatch[0]);
          } catch (secondError) {
            console.error('Segundo intento de parseo fallido:', secondError);
            throw new Error('No se pudo parsear la respuesta de DeepSeek');
          }
        } else {
          // Si todo falla, usar un objeto predeterminado
          analysis = {
             descripcion: 'Compra procesada automáticamente',
             categoria: 'Otros'
           };
           console.log('Usando análisis predeterminado');
         }
       }
       
       return {
         descripcion: analysis.descripcion || 'Compra procesada automáticamente',
         categoria: analysis.categoria || 'Otros'
       };

  } catch (error) {
    console.error('Error analyzing receipt with AI:', error);
    
    // Fallback: análisis básico sin IA
    const provider = receiptData.proveedor || '';
    let categoria = 'Otros';
    let descripcion = 'Compra procesada';

    // Categorización básica por palabras clave
    const providerLower = provider.toLowerCase();
    if (providerLower.includes('restaurante') || providerLower.includes('bar') || providerLower.includes('café')) {
      categoria = 'Restaurante';
      descripcion = `Consumo en ${provider}`;
    } else if (providerLower.includes('mercado') || providerLower.includes('super') || providerLower.includes('carrefour') || providerLower.includes('mercadona')) {
      categoria = 'Supermercado';
      descripcion = `Compra en ${provider}`;
    } else if (providerLower.includes('farmacia')) {
      categoria = 'Farmacia';
      descripcion = `Compra en farmacia ${provider}`;
    } else if (providerLower.includes('gasolinera') || providerLower.includes('repsol') || providerLower.includes('cepsa')) {
      categoria = 'Gasolinera';
      descripcion = `Repostaje en ${provider}`;
    }

    return { descripcion, categoria };
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [AI_ANALYSIS] Recibida solicitud de análisis');
    const body = await request.json();
    const { receiptId } = body;
    console.log('🔍 [AI_ANALYSIS] ID del recibo a analizar:', receiptId);
    console.log('🔍 [AI_ANALYSIS] Cuerpo de la solicitud:', JSON.stringify(body));

    if (!receiptId) {
      return NextResponse.json(
        { error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    // Obtener el ticket de la base de datos
    const { data: receipt, error: fetchError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (fetchError || !receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Analizar con IA
    const analysis = await analyzeReceiptWithAI(receipt);

    // Obtener los metadatos actuales del recibo
    const { data: currentReceipt } = await supabase
      .from('receipts')
      .select('metadatos')
      .eq('id', receiptId)
      .single();
      
    // Preparar los metadatos actualizados con la información del análisis de IA
    const updatedMetadatos = {
      ...currentReceipt?.metadatos,
      ai_analysis: {
        business_category: analysis.categoria,
        description: analysis.descripcion,
        confidence: 0.9,
        analyzed_at: new Date().toISOString()
      }
    };
    
    // Actualizar el ticket con la información analizada
    const { error: updateError } = await supabase
      .from('receipts')
      .update({
        notas: analysis.descripcion,
        categoria_negocio: analysis.categoria,
        metadatos: updatedMetadatos
      })
      .eq('id', receiptId);

    if (updateError) {
      console.error('Error updating receipt:', updateError);
      return NextResponse.json(
        { error: 'Failed to update receipt' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analysis: {
        descripcion: analysis.descripcion,
        categoria: analysis.categoria
      }
    });

  } catch (error) {
    console.error('Error in AI analysis:', error);
    // Proporcionar más información sobre el error para depuración
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('Error details:', { message: errorMessage, stack: errorStack });
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: errorMessage,
        success: false 
      },
      { status: 500 }
    );
  }
}

// Endpoint para analizar múltiples tickets
export async function PUT(request: NextRequest) {
  try {
    const { receiptIds } = await request.json();

    if (!receiptIds || !Array.isArray(receiptIds)) {
      return NextResponse.json(
        { error: 'Receipt IDs array is required' },
        { status: 400 }
      );
    }

    const results = [];

    // Procesar cada ticket
    for (const receiptId of receiptIds) {
      try {
        // Obtener el ticket
        const { data: receipt, error: fetchError } = await supabase
          .from('receipts')
          .select('*')
          .eq('id', receiptId)
          .single();

        if (fetchError || !receipt) {
          results.push({ receiptId, success: false, error: 'Receipt not found' });
          continue;
        }

        // Analizar con IA
        const analysis = await analyzeReceiptWithAI(receipt);

        // Obtener los metadatos actuales del recibo
        const { data: currentReceipt } = await supabase
          .from('receipts')
          .select('metadatos')
          .eq('id', receiptId)
          .single();
          
        // Preparar los metadatos actualizados con la información del análisis de IA
        const updatedMetadatos = {
          ...currentReceipt?.metadatos,
          ai_analysis: {
            business_category: analysis.categoria,
            description: analysis.descripcion,
            confidence: 0.9,
            analyzed_at: new Date().toISOString()
          }
        };
        
        // Actualizar el ticket con la información analizada
        const { error: updateError } = await supabase
          .from('receipts')
          .update({
            notas: analysis.descripcion,
            categoria_negocio: analysis.categoria,
            metadatos: updatedMetadatos
          })
          .eq('id', receiptId);

        if (updateError) {
          results.push({ receiptId, success: false, error: 'Failed to update' });
        } else {
          results.push({ 
            receiptId, 
            success: true, 
            analysis: {
              descripcion: analysis.descripcion,
              categoria: analysis.categoria
            }
          });
        }

        // Pequeña pausa para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error processing receipt ${receiptId}:`, error);
        results.push({ receiptId, success: false, error: 'Processing error' });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      processed: results.length,
      successful: results.filter(r => r.success).length
    });

  } catch (error) {
    console.error('Error in batch AI analysis:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}