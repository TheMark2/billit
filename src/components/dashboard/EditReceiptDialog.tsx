'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Select from '@/components/ui/select';
import { IconEdit, IconCheck, IconX, IconPlus, IconTrash, IconReceipt, IconGripVertical, IconReload } from '@tabler/icons-react';
import { supabase } from '@/lib/supabaseClient';
import { formatCurrency } from '@/lib/utils';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface LineItem {
  id: string;
  concepto: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  impuestos: number;
  total: number;
}

interface EditReceiptDialogProps {
  receipt: {
    id: string;
    proveedor: string;
    numero_factura: string | null;
    total: number;
    fecha_emision: string;
    moneda: string;
    tipo_factura?: string;
    metadatos?: any;
    user_id?: string;
    texto_extraido?: string;
    notas?: string;
  };
  onReceiptUpdated: () => void;
  trigger?: React.ReactNode;
}

const DOC_TYPE_OPTIONS = [
  { value: 'invoice', label: 'Factura' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'receipt', label: 'Recibo' },
  { value: 'quote', label: 'Presupuesto' },
  { value: 'purchase_order', label: 'Pedido' },
  { value: 'credit_note', label: 'Nota de crédito' },
  { value: 'statement', label: 'Extracto' },
  { value: 'payslip', label: 'Nómina' },
  { value: 'other_financial', label: 'Otro' }
];

const CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'USD', label: 'USD - Dólar' },
  { value: 'GBP', label: 'GBP - Libra' },
  { value: 'JPY', label: 'JPY - Yen' }
];

const TAX_RATE_OPTIONS = [
  { value: '0', label: '0%' },
  { value: '4', label: '4%' },
  { value: '10', label: '10%' },
  { value: '21', label: '21%' }
];

// Función para cargar line items desde los datos de Mindee
function loadLineItemsFromMindeeData(receipt: any): LineItem[] {
  console.log('🔍 [loadLineItemsFromMindeeData] Starting with receipt:', receipt.id);
  
  // 1. Si hay line items editados previamente, usarlos
  if (receipt.metadatos?.edited_line_items) {
    console.log('✅ Found edited line items:', receipt.metadatos.edited_line_items);
    return receipt.metadatos.edited_line_items.map((item: any, index: number) => ({
      id: item.id || `item-${index}`,
      concepto: item.concepto || '',
      descripcion: item.descripcion || '',
      cantidad: parseFloat(item.cantidad) || 1,
      precio: parseFloat(item.precio) || 0,
      impuestos: parseInt(item.impuestos) || 0,
      total: parseFloat(item.total) || 0
    }));
  }

  // 2. Buscar line items originales de Mindee
  let mindeeLineItems: any[] = [];
  
  // Intentar diferentes paths donde pueden estar los line items
  const possiblePaths = [
    receipt.metadatos?.mindee_data?.line_items,
    receipt.metadatos?.mindee_data?.prediction?.line_items,
    receipt.metadatos?.mindee_data?.document?.inference?.prediction?.line_items,
  ];
  
  // También intentar desde texto_extraido
  if (receipt.texto_extraido) {
    try {
      const parsed = JSON.parse(receipt.texto_extraido);
      possiblePaths.push(parsed.line_items);
      possiblePaths.push(parsed.prediction?.line_items);
    } catch (e) {
      console.warn('Could not parse texto_extraido');
    }
  }
  
  // Encontrar line items
  for (const path of possiblePaths) {
    if (path && Array.isArray(path) && path.length > 0) {
      mindeeLineItems = path;
      console.log('✅ Found mindee line items:', mindeeLineItems.length, 'items');
      break;
    }
  }
  
  // 3. Procesar line items de Mindee si se encontraron
  if (mindeeLineItems.length > 0) {
    return mindeeLineItems.map((item: any, index: number) => {
      const quantity = parseFloat(item.quantity) || 1;
      const totalAmount = parseFloat(item.total_amount) || 0;
      let unitPrice = parseFloat(item.unit_price) || 0;
      
      // Si no hay precio unitario, calcularlo desde total/cantidad
      if (unitPrice === 0 && totalAmount > 0 && quantity > 0) {
        unitPrice = totalAmount / quantity;
      }
      
      return {
        id: `item-${index}`,
        concepto: item.description || 'Producto/Servicio',
        descripcion: item.description || '',
        cantidad: quantity,
        precio: unitPrice,
        impuestos: parseFloat(item.tax_rate) || 0,
        total: totalAmount
      };
    });
  }
  
  // 4. Si no hay line items, crear uno por defecto con el total
  console.log('⚠️ No line items found, creating default item');
  return [{
    id: 'item-1',
    concepto: 'Producto/Servicio',
    descripcion: '',
    cantidad: 1,
    precio: receipt.total || 0,
    impuestos: 0,
    total: receipt.total || 0
  }];
}

// Skeleton para el dialog de edición
const EditDialogSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    {/* Información básica skeleton */}
    <div className="space-y-4">
      <div className="h-6 bg-neutral-200 rounded w-48" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-neutral-200 rounded w-20" />
            <div className="h-10 bg-neutral-100 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-neutral-200 rounded w-16" />
            <div className="h-10 bg-neutral-100 rounded" />
          </div>
        ))}
      </div>
    </div>
    
    {/* Line items skeleton */}
    <div className="space-y-4">
      <div className="h-6 bg-neutral-200 rounded w-56" />
      <div className="h-64 bg-neutral-100 rounded" />
    </div>
  </div>
);

// Componente para hacer los line items sortables
function SortableLineItem({ 
  item, 
  onLineItemChange, 
  onRemove, 
  canRemove 
}: {
  item: LineItem;
  onLineItemChange: (itemId: string, field: keyof LineItem, value: string | number) => void;
  onRemove: (itemId: string) => void;
  canRemove: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-12 gap-0 border-b border-gray-200 bg-white hover:bg-gray-50"
    >
      <div className="col-span-1 px-3 py-2 border-r border-gray-200 flex items-center justify-center">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
        >
          <IconGripVertical className="h-4 w-4 text-gray-400" />
        </button>
      </div>
      <div className="col-span-2 px-3 py-2 border-r border-gray-200">
        <Input
          value={item.concepto}
          onChange={(e) => onLineItemChange(item.id, 'concepto', e.target.value)}
          placeholder="Concepto"
          className="h-8 border-0 shadow-none focus:ring-0 px-2"
        />
      </div>
      <div className="col-span-2 px-3 py-2 border-r border-gray-200">
        <Input
          value={item.descripcion}
          onChange={(e) => onLineItemChange(item.id, 'descripcion', e.target.value)}
          placeholder="Descripción"
          className="h-8 border-0 shadow-none focus:ring-0 px-2"
        />
      </div>
      <div className="col-span-1 px-3 py-2 border-r border-gray-200">
        <Input
          type="number"
          value={item.cantidad}
          onChange={(e) => onLineItemChange(item.id, 'cantidad', parseFloat(e.target.value) || 0)}
          className="h-8 border-0 shadow-none focus:ring-0 px-2"
          min="0"
          step="0.01"
        />
      </div>
      <div className="col-span-2 px-3 py-2 border-r border-gray-200">
        <Input
          type="number"
          value={item.precio}
          onChange={(e) => onLineItemChange(item.id, 'precio', parseFloat(e.target.value) || 0)}
          className="h-8 border-0 shadow-none focus:ring-0 px-2"
          min="0"
          step="0.01"
        />
      </div>
      <div className="col-span-1 px-3 py-2 border-r border-gray-200">
        <Select
          options={TAX_RATE_OPTIONS}
          value={item.impuestos.toString()}
          onChange={(value) => onLineItemChange(item.id, 'impuestos', parseInt(value))}
          className="h-8"
        />
      </div>
      <div className="col-span-2 px-3 py-2 border-r border-gray-200">
        <div className="flex items-center h-8 px-2 text-sm font-medium">
          {formatCurrency(item.total)}
        </div>
      </div>
      <div className="col-span-1 px-3 py-2 flex items-center justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(item.id)}
          disabled={!canRemove}
          className="h-8 w-8 p-0"
        >
          <IconTrash className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function EditReceiptDialog({ receipt, onReceiptUpdated, trigger }: EditReceiptDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegeneratingPdf, setIsRegeneratingPdf] = useState(false);
  const [formData, setFormData] = useState({
    proveedor: receipt.proveedor,
    numero_factura: receipt.numero_factura || '',
    total: receipt.total.toString(),
    fecha_emision: receipt.fecha_emision,
    moneda: receipt.moneda,
    tipo_factura: receipt.tipo_factura || 'ticket',
    notas: receipt.notas || ''
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [originalLineItems, setOriginalLineItems] = useState<LineItem[]>([]);
  const [dialogLoading, setDialogLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Cargar line-items cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setDialogLoading(true);
      console.log('🔄 Loading line items for receipt:', receipt.id);
      
      // Simular un pequeño delay para mostrar el skeleton
      setTimeout(() => {
        const loadedItems = loadLineItemsFromMindeeData(receipt);
        console.log('✅ Loaded items:', loadedItems);
        setLineItems(loadedItems);
        setOriginalLineItems(JSON.parse(JSON.stringify(loadedItems))); // Deep copy para comparación
        setDialogLoading(false);
      }, 500);
    }
  }, [isOpen, receipt]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLineItemChange = (itemId: string, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value };
        
        // Recalcular total automáticamente
        if (field === 'cantidad' || field === 'precio') {
          const cantidad = field === 'cantidad' ? Number(value) : item.cantidad;
          const precio = field === 'precio' ? Number(value) : item.precio;
          updatedItem.total = cantidad * precio;
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  const addLineItem = () => {
    const newItem: LineItem = {
      id: `item-${Date.now()}`,
      concepto: '',
      descripcion: '',
      cantidad: 1,
      precio: 0,
      impuestos: 0,
      total: 0
    };
    setLineItems(prev => [...prev, newItem]);
  };

  const removeLineItem = (itemId: string) => {
    setLineItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setLineItems((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over?.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const iva = lineItems.reduce((sum, item) => {
      // Solo calcular IVA si está especificado y es mayor que 0
      const taxRate = item.impuestos || 0;
      if (taxRate > 0) {
      return sum + (item.total * taxRate / 100);
      }
      return sum;
    }, 0);
    const total = subtotal + iva;
    
    return { subtotal, iva, total };
  };

  const totals = calculateTotals();

  const regeneratePdf = async () => {
    try {
      setIsRegeneratingPdf(true);
      console.log('🔄 Regenerating PDF...');
      
      // Preparar los datos para regenerar el PDF con line items editados
      const pdfData = {
        ...receipt.metadatos?.mindee_data,
        // Campos editados tienen prioridad
        edited_line_items: lineItems,
        proveedor: formData.proveedor,
        numero_factura: formData.numero_factura,
        fecha_emision: formData.fecha_emision,
        moneda: formData.moneda,
        tipo_factura: formData.tipo_factura,
        total: totals.total,
        // Información adicional para el PDF
        calculated_totals: totals
      };

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mindeeData: pdfData,
          userId: receipt.user_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al regenerar el PDF');
      }

      const result = await response.json();
      console.log('✅ PDF regenerated successfully:', result);
      
      // Actualizar el receipt con la nueva URL del PDF y metadatos
      const updatedMetadatos = {
        ...receipt.metadatos,
        pdf_generation: {
          download_url: result.pdf_url,
          pdf_url: result.pdf_url,
          template_id: result.template_id,
          transaction_ref: result.transaction_ref,
          generated_at: result.generated_at,
          regenerated_from_edit: true,
          regenerated_at: new Date().toISOString()
        },
        // Mantener los line items editados
        edited_line_items: lineItems,
        calculated_totals: totals
      };

      const { error: updateError } = await supabase
        .from('receipts')
        .update({
          url_archivo: result.pdf_url,
          metadatos: updatedMetadatos
        })
        .eq('id', receipt.id);

      if (updateError) {
        throw new Error('Error actualizando la información del recibo');
      }

      console.log('✅ Metadatos updated successfully');
      
    } catch (error) {
      console.error('❌ Error regenerating PDF:', error);
      alert('Error regenerando el PDF: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsRegeneratingPdf(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      console.log('💾 Saving changes...');
      
      // Calcular total final desde los line-items
      const finalTotal = totals.total;
      
      // Actualizar metadatos con los line-items editados
      const updatedMetadatos = {
        ...receipt.metadatos,
        edited_line_items: lineItems,
        edit_timestamp: new Date().toISOString(),
        calculated_totals: totals,
        original_data: {
          proveedor: receipt.proveedor,
          numero_factura: receipt.numero_factura,
          total: receipt.total,
          fecha_emision: receipt.fecha_emision,
          moneda: receipt.moneda,
          tipo_factura: receipt.tipo_factura,
          notas: receipt.notas
        }
      };
      
      console.log('📊 Updating database...');
      const { error } = await supabase
        .from('receipts')
        .update({
          proveedor: formData.proveedor,
          numero_factura: formData.numero_factura || null,
          total: finalTotal,
          fecha_emision: formData.fecha_emision,
          moneda: formData.moneda,
          tipo_factura: formData.tipo_factura,
          notas: formData.notas,
          metadatos: updatedMetadatos
        })
        .eq('id', receipt.id);

      if (error) {
        throw error;
      }

      console.log('✅ Database updated');
      
      // Solo regenerar PDF si han cambiado campos que afectan al PDF (no solo notas)
      const needsPdfRegeneration = (
        formData.proveedor !== receipt.proveedor ||
        formData.numero_factura !== receipt.numero_factura ||
        finalTotal !== receipt.total ||
        formData.fecha_emision !== receipt.fecha_emision ||
        formData.moneda !== receipt.moneda ||
        formData.tipo_factura !== receipt.tipo_factura ||
        JSON.stringify(lineItems) !== JSON.stringify(originalLineItems)
      );

      if (needsPdfRegeneration) {
        console.log('🔄 Changes detected that require PDF regeneration...');
      await regeneratePdf();
        console.log('✅ PDF regenerated');
      } else {
        console.log('📝 Only notes changed, skipping PDF regeneration');
      }

      console.log('✅ Process completed successfully');
      setIsOpen(false);
      onReceiptUpdated();
    } catch (error) {
      console.error('❌ Error in handleSave:', error);
      alert('Error guardando los cambios: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Restaurar valores originales
    setFormData({
      proveedor: receipt.proveedor,
      numero_factura: receipt.numero_factura || '',
      total: receipt.total.toString(),
      fecha_emision: receipt.fecha_emision,
      moneda: receipt.moneda,
      tipo_factura: receipt.tipo_factura || 'ticket',
      notas: receipt.notas || ''
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? (
        <div onClick={() => setIsOpen(true)}>
          {trigger}
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
          onClick={() => setIsOpen(true)}
        >
          <IconEdit className="h-4 w-4" />
        </Button>
      )}
      
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconReceipt className="h-5 w-5" />
            Editar Recibo
          </DialogTitle>
        </DialogHeader>
        
        {dialogLoading ? (
          <EditDialogSkeleton />
        ) : (
          <div className="space-y-6">
            {/* Información básica */}
            <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información Básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Proveedor</label>
                  <Input
                    value={formData.proveedor}
                    onChange={(e) => handleInputChange('proveedor', e.target.value)}
                    placeholder="Nombre del proveedor"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Número de documento</label>
                  <Input
                    value={formData.numero_factura}
                    onChange={(e) => handleInputChange('numero_factura', e.target.value)}
                    placeholder="Número de factura"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Fecha emisión</label>
                  <Input
                    type="date"
                    value={formData.fecha_emision}
                    onChange={(e) => handleInputChange('fecha_emision', e.target.value)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Moneda</label>
                  <Select
                    options={CURRENCY_OPTIONS}
                    value={formData.moneda}
                    onChange={(value) => handleInputChange('moneda', value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Tipo de documento</label>
                  <Select
                    options={DOC_TYPE_OPTIONS}
                    value={formData.tipo_factura}
                    onChange={(value) => handleInputChange('tipo_factura', value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Notas</label>
                <Input
                  value={formData.notas}
                  onChange={(e) => handleInputChange('notas', e.target.value)}
                  placeholder="Añade una nota para recordar de qué es este ticket..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Líneas de productos/servicios */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Líneas de productos/servicios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border border-gray-200 rounded-md overflow-hidden">
                {/* Header de la tabla */}
                <div className="grid grid-cols-12 gap-0 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
                  <div className="col-span-1 px-3 py-2 border-r border-gray-200">Mover</div>
                  <div className="col-span-2 px-3 py-2 border-r border-gray-200">Concepto</div>
                  <div className="col-span-2 px-3 py-2 border-r border-gray-200">Descripción</div>
                  <div className="col-span-1 px-3 py-2 border-r border-gray-200">Cantidad</div>
                  <div className="col-span-2 px-3 py-2 border-r border-gray-200">Precio</div>
                  <div className="col-span-1 px-3 py-2 border-r border-gray-200">Impuestos</div>
                  <div className="col-span-2 px-3 py-2 border-r border-gray-200">Total</div>
                  <div className="col-span-1 px-3 py-2">Acciones</div>
                </div>
                
                {/* Líneas de productos con drag and drop */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={lineItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
                    {lineItems.map((item) => (
                      <SortableLineItem
                        key={item.id}
                        item={item}
                        onLineItemChange={handleLineItemChange}
                        onRemove={removeLineItem}
                        canRemove={lineItems.length > 1}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
              
              <Button
                variant="outline"
                onClick={addLineItem}
                className="mt-4"
              >
                <IconPlus className="h-4 w-4 mr-2" />
                Añadir línea
              </Button>
            </CardContent>
          </Card>

          {/* Totales */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Totales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                {totals.iva > 0 && (
                <div className="flex justify-between">
                  <span>IVA</span>
                  <span>{formatCurrency(totals.iva)}</span>
                </div>
                )}
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        )}
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            <IconX className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || isRegeneratingPdf}
          >
            {isLoading || isRegeneratingPdf ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {isRegeneratingPdf ? 'Regenerando PDF...' : 'Guardando...'}
              </>
            ) : (
              <>
                <IconCheck className="h-4 w-4 mr-2" />
                Guardar y Regenerar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 