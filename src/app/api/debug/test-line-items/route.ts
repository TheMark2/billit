import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const receiptId = searchParams.get('receipt_id');
  
  if (!receiptId) {
    return NextResponse.json({ error: 'receipt_id is required' }, { status: 400 });
  }

  // Simular datos de Mindee para test
  const mockMindeeData = {
    supplier_name: 'Test Supplier',
    total_amount: 121.0,
    total_net: 100.0,
    total_tax: 21.0,
    currency: 'EUR',
    taxes: [{
      rate: 21.0,
      base: 100.0,
      value: 21.0
    }],
    line_items: [
      {
        description: 'Producto 1',
        quantity: 1,
        unit_price: 50.0,
        total_amount: 50.0,
        tax_amount: 10.5,
        tax_rate: 21.0
      },
      {
        description: 'Producto 2',
        quantity: 2,
        unit_price: 25.0,
        total_amount: 50.0,
        // Sin tax_amount ni tax_rate - debería usar los impuestos generales
      },
      {
        description: 'Producto 3',
        quantity: 1,
        unit_price: 10.0,
        total_amount: 10.0,
        tax_amount: 0,
        tax_rate: 0
      }
    ]
  };

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

  // Procesar line items igual que en EditReceiptDialog
  const processedItems = mockMindeeData.line_items.map((item: any, index: number) => {
    const taxRate = extractTaxRateFromItem(item, mockMindeeData);
    
    return {
      id: `item-${index}`,
      concepto: item.description || 'Producto/Servicio',
      descripcion: item.description || '',
      cantidad: parseFloat(item.quantity) || 1,
      precio: parseFloat(item.unit_price) || 0,
      impuestos: taxRate,
      total: parseFloat(item.total_amount) || 0
    };
  });

  // Calcular totales
  const subtotal = processedItems.reduce((sum, item) => sum + item.total, 0);
  const iva = processedItems.reduce((sum, item) => {
    const taxRate = item.impuestos || 0;
    return sum + (item.total * taxRate / 100);
  }, 0);
  const total = subtotal + iva;

  return NextResponse.json({
    success: true,
    test_data: {
      original_mindee_data: mockMindeeData,
      processed_items: processedItems,
      totals: {
        subtotal,
        iva,
        total
      }
    },
    message: 'Line items test completed successfully'
  });
} 