import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Datos de prueba que simulan lo que extraería Mindee del BAR RESTAURANT LA BIMBA
    const testMindeeData = {
      supplier_name: "BAR RESTAURANT LA BIMBA",
      supplier_address: "Calle Test, 123",
      invoice_number: "T1-1-09359",
      date: "2019-08-02",
      currency: "EUR",
      total_net: 32.75,
      total_amount: 39.63, // Total con IVA
      total_tax: 6.88, // IVA 21%
      taxes: [
        {
          value: 6.88,
          rate: 21.0,
          base: 32.75,
          code: "IVA",
          details: "IVA 21%"
        }
      ],
      line_items: [
        {
          description: "FRITOS LA BIMBA",
          quantity: 1,
          unit_price: 11.50,
          total_amount: 11.50
        },
        {
          description: "CALLOS",
          quantity: 1,
          unit_price: 5.00,
          total_amount: 5.00
        },
        {
          description: "PATATAS BRAVAS",
          quantity: 1,
          unit_price: 4.50,
          total_amount: 4.50
        },
        {
          description: "MEDIANA",
          quantity: 5,
          unit_price: 1.75,
          total_amount: 8.75
        },
        {
          description: "COPA",
          quantity: 1,
          unit_price: 1.75,
          total_amount: 1.75
        },
        {
          description: "CARAJILLO",
          quantity: 1,
          unit_price: 1.50,
          total_amount: 1.50
        }
      ]
    };

    // Función de categorización (copiada de upload-receipt)
    function categorizeExpense(supplierName: string, lineItems: any[]): {
      category: string;
      accountCode: string;
      accountName: string;
    } {
      const supplier = (supplierName || '').toLowerCase();
      const items = lineItems.map(item => (item.description || '').toLowerCase()).join(' ');
      const allText = `${supplier} ${items}`;

      // Restaurantes, bares, comidas
      if (allText.match(/(restaurante?|bar|cafe|cafeteria|comida|cena|almuerzo|desayuno|fritos|patatas|callos|copa|cerveza|vino|bebida|tapas|menu)/i)) {
        return {
          category: 'restaurant',
          accountCode: '627000',
          accountName: 'Gastos de representación - Comidas y bebidas'
        };
      }

      // Gasolina, combustible
      if (allText.match(/(gasolina|combustible|repsol|cepsa|bp|shell|estacion|servicio|diesel|petroleo)/i)) {
        return {
          category: 'fuel',
          accountCode: '628100',
          accountName: 'Gastos de combustible'
        };
      }

      // Material de oficina
      if (allText.match(/(papel|boligrafo|lapiz|carpeta|archivador|tinta|impresora|oficina|material|suministro)/i)) {
        return {
          category: 'office',
          accountCode: '629000',
          accountName: 'Material de oficina'
        };
      }

      // Servicios profesionales
      if (allText.match(/(consultoria|asesoria|abogado|gestor|notario|servicio|profesional|honorarios)/i)) {
        return {
          category: 'professional',
          accountCode: '623000',
          accountName: 'Servicios de profesionales independientes'
        };
      }

      // Telecomunicaciones
      if (allText.match(/(telefono|internet|movil|telefonica|vodafone|orange|telecomunicacion)/i)) {
        return {
          category: 'telecom',
          accountCode: '629200',
          accountName: 'Gastos de telecomunicaciones'
        };
      }

      // Default: Otros gastos de explotación
      return {
        category: 'other',
        accountCode: '629900',
        accountName: 'Otros gastos de explotación'
      };
    }

    // Probar la categorización
    const expenseCategory = categorizeExpense(testMindeeData.supplier_name, testMindeeData.line_items);
    
    console.log('=== DEBUG TEST ODOO ===');
    console.log('Supplier:', testMindeeData.supplier_name);
    console.log('Line items:', testMindeeData.line_items.map(item => item.description).join(', '));
    console.log('Categorized as:', expenseCategory);
    console.log('Tax info:', {
      total_net: testMindeeData.total_net,
      total_tax: testMindeeData.total_tax,
      total_amount: testMindeeData.total_amount,
      tax_rate: (testMindeeData.total_tax / testMindeeData.total_net) * 100,
      taxes: testMindeeData.taxes
    });

    return NextResponse.json({
      success: true,
      message: 'Test de categorización completado',
      data: {
        original_data: testMindeeData,
        categorization: expenseCategory,
        tax_analysis: {
          total_net: testMindeeData.total_net,
          total_tax: testMindeeData.total_tax,
          total_amount: testMindeeData.total_amount,
          tax_rate: (testMindeeData.total_tax / testMindeeData.total_net) * 100,
          taxes: testMindeeData.taxes
        },
        analysis: {
          supplier_text: testMindeeData.supplier_name.toLowerCase(),
          items_text: testMindeeData.line_items.map(item => item.description.toLowerCase()).join(' '),
          combined_text: `${testMindeeData.supplier_name.toLowerCase()} ${testMindeeData.line_items.map(item => item.description.toLowerCase()).join(' ')}`,
          matches_restaurant: /restaurante?|bar|cafe|cafeteria|comida|cena|almuerzo|desayuno|fritos|patatas|callos|copa|cerveza|vino|bebida|tapas|menu/i.test(`${testMindeeData.supplier_name.toLowerCase()} ${testMindeeData.line_items.map(item => item.description.toLowerCase()).join(' ')}`)
        }
      }
    });

  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json(
      { error: 'Error en test' },
      { status: 500 }
    );
  }
} 