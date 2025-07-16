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

    // Obtener el recibo
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

    // Función auxiliar para extraer tasa de impuestos (igual que en EditReceiptDialog)
    function extractTaxRateFromItem(item: any, mindeeData?: any): number {
      console.log('🔍 [extractTaxRateFromItem] Processing item:', item);
      
      // 1. Verificar si hay un campo tax_rate directo
      if (item.tax_rate !== undefined && item.tax_rate !== null) {
        const rate = parseFloat(item.tax_rate);
        console.log('✅ [extractTaxRateFromItem] Found direct tax_rate:', rate);
        return isNaN(rate) ? 0 : rate;
      }
      
      // 2. Calcular desde tax_amount y total_amount
      if (item.tax_amount !== undefined && item.total_amount) {
        const taxAmount = parseFloat(item.tax_amount);
        const totalAmount = parseFloat(item.total_amount);
        
        if (!isNaN(taxAmount) && !isNaN(totalAmount) && totalAmount > 0) {
          const rate = (taxAmount / totalAmount) * 100;
          const roundedRate = Math.round(rate * 100) / 100;
          console.log('✅ [extractTaxRateFromItem] Calculated tax rate:', roundedRate);
          return roundedRate;
        }
      }
      
      // 3. Intentar usar los impuestos generales de la factura
      if (mindeeData && mindeeData.taxes && mindeeData.taxes.length > 0) {
        const generalTax = mindeeData.taxes[0];
        if (generalTax.rate !== undefined && generalTax.rate !== null) {
          const rate = parseFloat(generalTax.rate);
          console.log('✅ [extractTaxRateFromItem] Using general tax rate:', rate);
          return isNaN(rate) ? 0 : rate;
        }
      }
      
      // 4. Calcular desde totales generales de la factura
      if (mindeeData && mindeeData.total_tax && mindeeData.total_net) {
        const totalTax = parseFloat(mindeeData.total_tax);
        const totalNet = parseFloat(mindeeData.total_net);
        
        if (!isNaN(totalTax) && !isNaN(totalNet) && totalNet > 0) {
          const rate = (totalTax / totalNet) * 100;
          const roundedRate = Math.round(rate * 100) / 100;
          console.log('✅ [extractTaxRateFromItem] Calculated from general totals:', roundedRate);
          return roundedRate;
        }
      }
      
      // 5. Por defecto, usar 0%
      console.log('⚠️ [extractTaxRateFromItem] No tax info found, using 0%');
      return 0;
    }

    // Simular el mismo proceso que en EditReceiptDialog
    console.log('🔍 [TEST] Loading line items for receipt:', receipt.id);
    console.log('🔍 [TEST] Receipt metadatos:', receipt.metadatos);
    
    let processedItems: any[] = [];
    
    // Primero: Verificar si hay line items editados previamente
    if (receipt.metadatos?.edited_line_items) {
      console.log('✅ [TEST] Found edited line items:', receipt.metadatos.edited_line_items);
      processedItems = receipt.metadatos.edited_line_items.map((item: any, index: number) => ({
        id: item.id || `item-${index}`,
        concepto: item.concepto || 'Producto/Servicio',
        descripcion: item.descripcion || '',
        cantidad: parseFloat(item.cantidad) || 1,
        precio: parseFloat(item.precio) || 0,
        impuestos: parseInt(item.impuestos) || 0,
        total: parseFloat(item.total) || 0
      }));
    }
    // Segundo: Buscar line items de Mindee en múltiples paths posibles
    else {
      let mindeeLineItems: any[] = [];
      let mindeeData: any = null;
      
      // Buscar en múltiples paths posibles
      const possiblePaths = [
        () => receipt.metadatos?.mindee_data?.line_items,
        () => receipt.metadatos?.mindee_data?.prediction?.line_items,
        () => receipt.metadatos?.mindee_data?.document?.inference?.prediction?.line_items,
        () => {
          // También buscar en texto_extraido parseado
          try {
            if (receipt.texto_extraido) {
              const parsed = JSON.parse(receipt.texto_extraido);
              return parsed.line_items || parsed.prediction?.line_items;
            }
          } catch (e) {
            return null;
          }
        }
      ];
      
      // Buscar mindee_data en múltiples paths
      const possibleMindeeData = [
        () => receipt.metadatos?.mindee_data,
        () => receipt.metadatos?.mindee_data?.prediction,
        () => receipt.metadatos?.mindee_data?.document?.inference?.prediction,
        () => {
          try {
            if (receipt.texto_extraido) {
              const parsed = JSON.parse(receipt.texto_extraido);
              return parsed || parsed.prediction;
            }
          } catch (e) {
            return null;
          }
        }
      ];
      
      // Buscar line items
      for (const pathFn of possiblePaths) {
        const items = pathFn();
        if (items && Array.isArray(items) && items.length > 0) {
          mindeeLineItems = items;
          console.log('✅ [TEST] Found mindee line items at path:', mindeeLineItems);
          break;
        }
      }
      
      // Buscar mindee data para extraer impuestos
      for (const pathFn of possibleMindeeData) {
        const data = pathFn();
        if (data && typeof data === 'object') {
          mindeeData = data;
          console.log('✅ [TEST] Found mindee data at path:', Object.keys(mindeeData));
          break;
        }
      }
      
      // Procesar line items si se encontraron
      if (mindeeLineItems.length > 0) {
        console.log('📊 [TEST] Processing mindee line items:', mindeeLineItems);
        processedItems = mindeeLineItems.map((item: any, index: number) => {
          // Extraer tasa de impuestos del item (si existe) o usar impuestos generales
          const taxRate = extractTaxRateFromItem(item, mindeeData);
          
          // Manejar diferentes estructuras de datos
          const description = item.description || item.name || item.concept || 'Producto/Servicio';
          const quantity = parseFloat(item.quantity) || parseFloat(item.units) || parseFloat(item.cantidad) || 1;
          const unitPrice = parseFloat(item.unit_price) || parseFloat(item.price) || parseFloat(item.precio) || 0;
          const totalAmount = parseFloat(item.total_amount) || parseFloat(item.total) || parseFloat(item.amount) || 0;
          
          return {
            id: `item-${index}`,
            concepto: description,
            descripcion: description,
            cantidad: quantity,
            precio: unitPrice,
            impuestos: taxRate, // 0% por defecto si no se encuentra
            total: totalAmount
          };
        });
      }
    }
    
    // Si tenemos items procesados, usar esos
    if (processedItems.length === 0) {
      console.log('⚠️ [TEST] No line items found, creating default item');
      // Si no hay items, crear uno por defecto con el total de la factura
      processedItems = [{
        id: 'item-1',
        concepto: 'Producto/Servicio',
        descripcion: '',
        cantidad: 1,
        precio: receipt.total,
        impuestos: 0, // 0% por defecto como pidió el usuario
        total: receipt.total
      }];
    }

    console.log('✅ [TEST] Final processed items:', processedItems);

    return NextResponse.json({
      success: true,
      receipt_id: receiptId,
      line_items_found: processedItems.length > 0,
      line_items_count: processedItems.length,
      processed_items: processedItems,
      debug_info: {
        has_edited_line_items: !!receipt.metadatos?.edited_line_items,
        has_mindee_data: !!receipt.metadatos?.mindee_data,
        has_texto_extraido: !!receipt.texto_extraido
      }
    });

  } catch (error) {
    console.error('❌ [TEST] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 