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
    
    // Construir prompt para la IA con cuentas contables específicas
    const prompt = `
Analiza este ticket de compra y asigna la cuenta contable correcta según el Plan General Contable español.

MANUAL DE CUENTAS CONTABLES:

**GASTOS OPERATIVOS (Grupo 6):**
- 600 "Compras" - Mercancías para reventa, materias primas
- 601 "Compras de materias primas" - Materiales de producción
- 602 "Compras de otros aprovisionamientos" - Combustibles, repuestos, material de oficina
- 621 "Arrendamientos y cánones" - Alquileres de locales, equipos
- 622 "Reparaciones y conservación" - Mantenimiento de equipos, vehículos
- 623 "Servicios de profesionales independientes" - Asesorías, consultores
- 624 "Transportes" - Envíos, mensajería, transporte público
- 625 "Primas de seguros" - Seguros de cualquier tipo
- 626 "Servicios bancarios" - Comisiones bancarias
- 627 "Publicidad, propaganda y relaciones públicas" - Marketing, publicidad
- 628 "Suministros" - Electricidad, agua, gas, teléfono, internet
- 629 "Otros servicios" - Limpieza, seguridad, otros servicios

**GASTOS DE PERSONAL (Grupo 64):**
- 640 "Sueldos y salarios" - Nóminas
- 641 "Indemnizaciones" - Finiquitos, despidos
- 642 "Seguridad Social a cargo de la empresa" - Cotizaciones SS
- 649 "Otros gastos sociales" - Formación, seguros empleados

**OTROS GASTOS (Grupo 62):**
- 623 "Servicios de profesionales independientes" - Asesorías, abogados
- 624 "Transportes" - Gasolina, peajes, transporte
- 625 "Primas de seguros" - Seguros vehículos, locales
- 626 "Servicios bancarios" - Comisiones, gastos bancarios
- 627 "Publicidad" - Marketing, publicidad online/offline
- 628 "Suministros" - Luz, agua, gas, teléfono
- 629 "Otros servicios" - Limpieza, mantenimiento

**GASTOS EXCEPCIONALES:**
- 678 "Gastos excepcionales" - Multas, sanciones

**EJEMPLOS DE ASIGNACIÓN:**
- Gasolinera/Combustible → "624 - Transportes"
- Restaurante/Comida → "629 - Otros servicios" (si es gasto de empresa)
- Supermercado/Oficina → "602 - Compras de otros aprovisionamientos"
- Electricidad/Gas → "628 - Suministros"
- Asesoría/Gestoría → "623 - Servicios de profesionales independientes"
- Seguro → "625 - Primas de seguros"
- Publicidad/Marketing → "627 - Publicidad, propaganda y relaciones públicas"
- Reparación vehículo → "622 - Reparaciones y conservación"
- Material oficina → "602 - Compras de otros aprovisionamientos"
- Alquiler local → "621 - Arrendamientos y cánones"

Información del ticket:
- Proveedor: ${provider}
- Total: ${total}€
- Productos: ${lineItems.map((item: any) => item.description || item.name).join(', ')}
- Texto extraído: ${textContent.substring(0, 500)}

Analiza el contenido y asigna la cuenta contable más apropiada. Responde SOLO en formato JSON:
{
  "descripcion": "descripción corta de la compra",
  "cuenta_contable": "XXX - Nombre de la cuenta contable"
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
      throw new Error(`DeepSeek API error: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
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
             cuenta_contable: '629 - Otros servicios'
           };
           console.log('Usando análisis predeterminado');
         }
       }
       
       return {
         descripcion: analysis.descripcion || 'Compra procesada automáticamente',
         cuenta_contable: analysis.cuenta_contable || '629 - Otros servicios'
       };

  } catch (error) {
    console.error('Error analyzing receipt with AI:', error);
    
    // Fallback: análisis básico sin IA con cuentas contables
    const provider = receiptData.proveedor || '';
    let cuenta_contable = '629 - Otros servicios';
    let descripcion = 'Compra procesada';

    // Asignación de cuentas contables básica por palabras clave
    const providerLower = provider.toLowerCase();
    if (providerLower.includes('restaurante') || providerLower.includes('bar') || providerLower.includes('café')) {
      cuenta_contable = '629 - Otros servicios';
      descripcion = `Consumo en ${provider}`;
    } else if (providerLower.includes('mercado') || providerLower.includes('super') || providerLower.includes('carrefour') || providerLower.includes('mercadona')) {
      cuenta_contable = '602 - Compras de otros aprovisionamientos';
      descripcion = `Compra en ${provider}`;
    } else if (providerLower.includes('farmacia')) {
      cuenta_contable = '602 - Compras de otros aprovisionamientos';
      descripcion = `Compra en farmacia ${provider}`;
    } else if (providerLower.includes('gasolinera') || providerLower.includes('repsol') || providerLower.includes('cepsa') || providerLower.includes('bp') || providerLower.includes('shell')) {
      cuenta_contable = '624 - Transportes';
      descripcion = `Repostaje en ${provider}`;
    } else if (providerLower.includes('electricidad') || providerLower.includes('gas') || providerLower.includes('agua') || providerLower.includes('telefon') || providerLower.includes('internet')) {
      cuenta_contable = '628 - Suministros';
      descripcion = `Suministro de ${provider}`;
    } else if (providerLower.includes('seguro') || providerLower.includes('insurance')) {
      cuenta_contable = '625 - Primas de seguros';
      descripcion = `Seguro de ${provider}`;
    } else if (providerLower.includes('asesor') || providerLower.includes('gestor') || providerLower.includes('abogado') || providerLower.includes('consultor')) {
      cuenta_contable = '623 - Servicios de profesionales independientes';
      descripcion = `Servicios profesionales de ${provider}`;
    } else if (providerLower.includes('alquiler') || providerLower.includes('rent')) {
      cuenta_contable = '621 - Arrendamientos y cánones';
      descripcion = `Alquiler de ${provider}`;
    } else if (providerLower.includes('reparacion') || providerLower.includes('taller') || providerLower.includes('mantenimiento')) {
      cuenta_contable = '622 - Reparaciones y conservación';
      descripcion = `Reparación/mantenimiento en ${provider}`;
    } else if (providerLower.includes('publicidad') || providerLower.includes('marketing') || providerLower.includes('google') || providerLower.includes('facebook')) {
      cuenta_contable = '627 - Publicidad, propaganda y relaciones públicas';
      descripcion = `Publicidad/marketing en ${provider}`;
    }

    return { descripcion, cuenta_contable };
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
        accounting_account: analysis.cuenta_contable,
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
        categoria_negocio: analysis.cuenta_contable,
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
        cuenta_contable: analysis.cuenta_contable
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
            accounting_account: analysis.cuenta_contable,
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
            categoria_negocio: analysis.cuenta_contable,
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
              cuenta_contable: analysis.cuenta_contable
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