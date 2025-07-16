"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Trash2, X } from "lucide-react";
import { IconEye, IconDownload, IconFileInvoice, IconReceipt2, IconQuote, IconShoppingCart, IconReport, IconNotes, IconReceiptRefund, IconFileDollar, IconRefresh, IconPhoto } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { Checkbox } from "@/components/ui/checkbox";
import { ReceiptsTableSkeleton } from "@/components/dashboard/Skeletons";
import PdfViewer from "@/components/dashboard/PdfViewer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import EditReceiptDialog from "@/components/dashboard/EditReceiptDialog";
import Select from "@/components/ui/select";

interface Receipt {
  id: string;
  date: string;
  provider: string;
  documentType: string;
  total: number;
  status?: string;
  numero_factura?: string;
  fecha_emision?: string;
  moneda?: string;
  tipo_factura?: string;
  notas?: string;
  metadatos?: {
    integrations_summary?: {
      odoo?: 'success' | 'failed' | 'not_configured';
      holded?: 'success' | 'failed' | 'not_configured';
      xero?: 'success' | 'failed' | 'not_configured';
      pdf?: 'success' | 'failed';
    };
    odoo_integration?: any;
    holded_integration?: any;
    xero_integration?: any;
    whatsapp_data?: {
      file_info?: {
        original_url?: string;
      };
    };
    mindee_data?: any;
  };
}

type SortField = "date" | "provider" | "total";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 6; // Mostramos 6 filas por página

// Mapa de integraciones con sus logos
const INTEGRATION_LOGOS = {
  odoo: '/logo_odoo.svg',
  holded: '/logo_holded.png',
  xero: '/logo_xero.webp'
};

// Componente para mostrar el badge del estado con logos de integraciones
const IntegrationStatusBadge = ({ receipt }: { receipt: Receipt }) => {
  const integrationsSummary = receipt.metadatos?.integrations_summary;
  
  // Obtener integraciones exitosas
  const successfulIntegrations = integrationsSummary 
    ? Object.entries(integrationsSummary)
        .filter(([key, status]) => key !== 'pdf' && status === 'success')
        .map(([key]) => key)
    : [];

  if (receipt.status === 'synced' && successfulIntegrations.length > 0) {
    return (
      <Badge variant="outline" className="flex items-center gap-1.5 pl-1 pr-2 py-1 text-xs font-medium w-fit">
        <div className="flex items-center -space-x-1">
          {successfulIntegrations.map((integration, index) => (
            <div 
              key={integration}
              className="w-5 h-5 rounded-full flex items-center justify-center border bg-neutral-100"
              style={{ zIndex: successfulIntegrations.length - index }}
            >
              <img 
                src={INTEGRATION_LOGOS[integration as keyof typeof INTEGRATION_LOGOS]}
                alt={integration}
                className="w-5 h-5 object-contain"
              />
            </div>
          ))}
        </div>
        <span>Enviado</span>
      </Badge>
    );
  }

  if (receipt.status === 'error') {
    return (
      <Badge variant="destructive" className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
          <path fillRule="evenodd" d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16ZM7 3a1 1 0 1 1 2 0v5a1 1 0 1 1-2 0V3ZM8 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/>
        </svg>
        <span>Error</span>
      </Badge>
    );
  }

  return (
    <Badge variant="neutral" className="px-2 py-1 text-xs font-medium">
      Pendiente
    </Badge>
  );
};

const DOC_TYPE_MAP: Record<string, { label: string; color: string; activeColor: string; activeBg: string }> = {
  invoice: { 
    label: "Factura", 
    color: "bg-emerald-500", 
    activeColor: "border-emerald-500",
    activeBg: "bg-emerald-50"
  },
  ticket: { 
    label: "Ticket", 
    color: "bg-blue-500", 
    activeColor: "border-blue-500",
    activeBg: "bg-blue-50"
  },
  receipt: { 
    label: "Recibo", 
    color: "bg-sky-500",
    activeColor: "border-sky-500",
    activeBg: "bg-sky-50"
  },
  quote: { 
    label: "Presupuesto", 
    color: "bg-amber-500",
    activeColor: "border-amber-500",
    activeBg: "bg-amber-50"
  },
  purchase_order: { 
    label: "Pedido", 
    color: "bg-orange-500",
    activeColor: "border-orange-500",
    activeBg: "bg-orange-50"
  },
  credit_note: { 
    label: "Abono", 
    color: "bg-rose-500",
    activeColor: "border-rose-500",
    activeBg: "bg-rose-50"
  },
  statement: { 
    label: "Extracto", 
    color: "bg-slate-500",
    activeColor: "border-slate-500",
    activeBg: "bg-slate-50"
  },
  payslip: { 
    label: "Nómina", 
    color: "bg-violet-500",
    activeColor: "border-violet-500",
    activeBg: "bg-violet-50"
  },
  other_financial: { 
    label: "Otro", 
    color: "bg-neutral-500",
    activeColor: "border-neutral-500",
    activeBg: "bg-neutral-50"
  },
};

// Componente para ver imagen original
const OriginalImageViewer = ({ receipt }: { receipt: Receipt }) => {
  const [showImageModal, setShowImageModal] = useState(false);
  
  // Extraer URL de imagen original de los metadatos
  const getOriginalImageUrl = () => {
    if (receipt.metadatos?.whatsapp_data?.file_info?.original_url) {
      return receipt.metadatos.whatsapp_data.file_info.original_url;
    }
    // Para archivos subidos por web, usar un endpoint para obtener la imagen
    if (receipt.metadatos?.mindee_data && receipt.id) {
      return `/api/receipt-image/${receipt.id}`;
    }
    return null;
  };

  const imageUrl = getOriginalImageUrl();

  if (!imageUrl) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-gray-400 cursor-not-allowed"
        disabled
      >
        <IconPhoto className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
        onClick={() => setShowImageModal(true)}
      >
        <IconPhoto className="h-4 w-4" />
      </Button>
      
      {showImageModal && (
        <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Imagen Original - {receipt.provider}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <img 
                src={imageUrl} 
                alt="Imagen original del ticket"
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                onError={(e) => {
                  console.error('Error loading image:', e);
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

// Eliminar los datos de ejemplo
// const SAMPLE_RECEIPTS: Receipt[] = [
//   { id: "1", date: "2024-01-15", provider: "Amazon España", documentType: "invoice", total: 234.56 },
//   { id: "2", date: "2024-01-14", provider: "El Corte Inglés", documentType: "receipt", total: 89.99 },
//   { id: "3", date: "2024-01-13", provider: "Vodafone España", documentType: "invoice", total: 45.00 },
//   { id: "4", date: "2024-01-12", provider: "Gasolinera Repsol", documentType: "receipt", total: 67.80 },
//   { id: "5", date: "2024-01-11", provider: "Mercadona", documentType: "receipt", total: 127.35 },
//   { id: "6", date: "2024-01-10", provider: "Empresa Consulting SL", documentType: "quote", total: 1500.00 },
//   { id: "7", date: "2024-01-09", provider: "Iberdrola", documentType: "invoice", total: 78.90 },
//   { id: "8", date: "2024-01-08", provider: "Orange España", documentType: "invoice", total: 39.99 },
//   { id: "9", date: "2024-01-07", provider: "IKEA", documentType: "receipt", total: 345.67 },
//   { id: "10", date: "2024-01-06", provider: "Zara", documentType: "receipt", total: 89.95 },
//   { id: "11", date: "2024-01-05", provider: "Carrefour", documentType: "receipt", total: 156.78 },
//   { id: "12", date: "2024-01-04", provider: "Banco Santander", documentType: "statement", total: 12.50 },
//   { id: "13", date: "2024-01-03", provider: "Netflix", documentType: "invoice", total: 15.99 },
//   { id: "14", date: "2024-01-02", provider: "Spotify", documentType: "invoice", total: 9.99 },
//   { id: "15", date: "2024-01-01", provider: "Freelance Developer", documentType: "credit_note", total: 850.00 },
// ];

// Componente para cambiar tipo de documento rápidamente
const QuickTypeChanger = ({ receipt, onTypeChanged }: { 
  receipt: Receipt, 
  onTypeChanged: () => void 
}) => {
  const [isChanging, setIsChanging] = useState(false);

  const handleTypeChange = async (newType: string) => {
    if (newType === receipt.documentType) return;

    setIsChanging(true);
    try {
      const { error } = await supabase
        .from('receipts')
        .update({ tipo_factura: newType })
        .eq('id', receipt.id);

      if (error) throw error;
      onTypeChanged();
    } catch (error) {
      console.error('Error updating document type:', error);
    } finally {
      setIsChanging(false);
    }
  };

  const typeOptions = Object.entries(DOC_TYPE_MAP).map(([key, { label }]) => ({
    value: key,
    label
  }));

  return (
    <Badge 
      className={cn(
        "flex items-center gap-2 pl-2 w-fit relative group cursor-pointer transition-all hover:scale-105",
        isChanging && "opacity-50"
      )} 
      variant="neutral"
    >
      <div className={`w-2 h-2 rounded-full ${DOC_TYPE_MAP[receipt.documentType]?.color || DOC_TYPE_MAP.other_financial.color}`} />
      {DOC_TYPE_MAP[receipt.documentType]?.label || DOC_TYPE_MAP.other_financial.label}
      {isChanging && <div className="w-3 h-3 border border-neutral-400 border-t-transparent rounded-full animate-spin ml-1" />}
      
      {/* Select oculto que se activa con hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Select
          options={typeOptions}
          value={receipt.documentType}
          onChange={handleTypeChange}
          disabled={isChanging}
          className="text-xs absolute inset-0 w-full h-full opacity-0"
        />
      </div>
    </Badge>
  );
};

export default function RecibosPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]); // Inicializar con array vacío
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null); // Agregar estado para errores
  const [page, setPage] = useState(1);
  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Función para manejar el ordenamiento (con useCallback para optimización)
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setPage(1); // Reset a la primera página al cambiar ordenamiento
  }, [sortField, sortDirection]);

  // Función para obtener el icono de ordenamiento (memoizada)
  const getSortIcon = useCallback((field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  }, [sortField, sortDirection]);

  // Función para ordenar los datos (memoizada)
  const sortData = useCallback((data: Receipt[]) => {
    return [...data].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case "date":
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case "provider":
          aValue = a.provider.toLowerCase();
          bValue = b.provider.toLowerCase();
          break;
        case "total":
          aValue = a.total;
          bValue = b.total;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [sortField, sortDirection]);

  const loadReceipts = useCallback(async () => {
    setLoadingData(true);
    setError(null); // Limpiar errores previos
    
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      const uid = session?.user?.id;
      
      if (!uid) {
        setError("No se ha podido obtener la sesión del usuario");
        setLoadingData(false);
        return;
      }

      // Construir la consulta simplificada para tickets
      let query = supabase
        .from("receipts")
        .select("id, proveedor, total, created_at, estado, metadatos, numero_factura, fecha_emision, moneda, tipo_factura, notas")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) {
        // Solo mostrar error si es crítico
        if (error.message.includes('RLS') || error.message.includes('permission')) {
          setError('Error de permisos. Intenta recargar la página.');
        }
        setReceipts([]); // Limpiar tickets en caso de error
        setLoadingData(false);
        return;
      }

      if (data && data.length > 0) {
        const mapped: Receipt[] = data.map((r: any) => {
          // Usar tipo_factura si está disponible, sino usar datos de Mindee
          let documentType = r.tipo_factura;
          
          if (!documentType) {
            // Obtener el tipo de documento desde los datos de Mindee
            const mindeeDocType = r.metadatos?.mindee_data?.document_type;
            let rawType = "";
            
            if (mindeeDocType) {
              // Mapear tipos de Mindee a nuestros tipos
              const typeMapping: Record<string, string> = {
                'INVOICE': 'invoice',
                'RECEIPT': 'receipt',
                'QUOTE': 'quote',
                'PURCHASE_ORDER': 'purchase_order',
                'CREDIT_NOTE': 'credit_note',
                'STATEMENT': 'statement',
                'PAYSLIP': 'payslip'
              };
              rawType = typeMapping[mindeeDocType.toUpperCase()] || mindeeDocType.toLowerCase();
            }
            
            documentType = rawType && rawType in DOC_TYPE_MAP ? rawType : "other_financial";
          }
          
          return {
            id: r.id,
            date: r.created_at,
            provider: r.proveedor || "-",
            documentType: documentType,
            total: parseFloat(r.total),
            status: r.estado,
            numero_factura: r.numero_factura,
            fecha_emision: r.fecha_emision,
            moneda: r.moneda,
            tipo_factura: r.tipo_factura,
            notas: r.notas,
            metadatos: r.metadatos,
          };
        });
        setReceipts(mapped);
      } else {
        setReceipts([]); // Asegurar que se limpien los tickets si no hay datos
      }

      setLoadingData(false);
    } catch (error) {
      setError(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      setReceipts([]);
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  // Sincronizar con la query ?q=
  useEffect(() => {
    const q = searchParams.get("q") || "";
    setInputValue(q);
    setSearch(q);
  }, []); // solo al montar

  // Debounce de 500 ms para aplicar la búsqueda y actualizar la URL
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(inputValue);
      const params = new URLSearchParams();
      if (inputValue.trim()) params.set("q", inputValue.trim());
      router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
      setPage(1); // reiniciamos a la primera página cuando cambia la búsqueda
    }, 500);
    return () => clearTimeout(handler);
  }, [inputValue, router]);

  // Memoizamos los tickets filtrados para evitar recálculos innecesarios
  const filteredReceipts = useMemo(() => {
    return sortData(receipts.filter((r) =>
      (selectedType ? r.documentType === selectedType : true) &&
      (search ? (
        r.provider.toLowerCase().includes(search.toLowerCase()) ||
        r.date.includes(search) ||
        DOC_TYPE_MAP[r.documentType]?.label.toLowerCase().includes(search.toLowerCase())
      ) : true)
    ));
  }, [receipts, selectedType, search, sortData]);

  const totalPages = Math.max(1, Math.ceil(filteredReceipts.length / PAGE_SIZE));

  // Memoizamos los tickets visibles
  const visibleReceipts = useMemo(() => {
    return filteredReceipts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredReceipts, page]);

  // Manejar atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'a' && !e.shiftKey) {
        e.preventDefault();
        if (visibleReceipts.length > 0) {
          setSelectedReceipts(visibleReceipts.map(r => r.id));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visibleReceipts]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedReceipts(visibleReceipts.map(r => r.id));
    } else {
      setSelectedReceipts([]);
    }
  }, [visibleReceipts]);

  const handleSelectReceipt = useCallback((receiptId: string, checked: boolean) => {
    if (checked) {
      setSelectedReceipts(prev => [...prev, receiptId]);
    } else {
      setSelectedReceipts(prev => prev.filter(id => id !== receiptId));
    }
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedReceipts.length) return;
    
    setLoadingData(true);
    try {
      const { error } = await supabase
        .from('receipts')
        .delete()
        .in('id', selectedReceipts);

      if (error) throw error;
      
      // Recargar datos y limpiar selección
      await loadReceipts();
      setSelectedReceipts([]);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      setError('Error al eliminar los tickets');
    }
    setLoadingData(false);
  }, [selectedReceipts, loadReceipts]);

  const confirmDelete = useCallback(() => {
    if (selectedReceipts.length > 0) {
      setIsDeleteDialogOpen(true);
    }
  }, [selectedReceipts.length]);

  const handleDownload = useCallback(async (receiptId: string, numeroFactura: string) => {
    try {
      // Abrir el PDF directamente usando nuestro endpoint de descarga
      const downloadUrl = `/api/pdf-download?receipt_id=${receiptId}`;
      
      // Crear un enlace de descarga directo
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `factura_${numeroFactura.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      setError('Error al descargar el PDF. Por favor, intenta de nuevo.');
      // Solo mostrar error si es necesario, no interrumpir la experiencia del usuario
      console.warn('Error al descargar el PDF:', error instanceof Error ? error.message : 'Error desconocido');
    }
  }, []);

  return (
    <div className="bg-white p-6 rounded-3xl flex flex-col animate-fade-in border">
        <div className="flex flex-col gap-6 p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-800">Tickets</h1>
            <div className="flex items-center gap-3">
                {selectedReceipts.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={confirmDelete}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar ({selectedReceipts.length})
                  </Button>
                )}
                <Button
                    onClick={loadReceipts}
                    variant="outline"
                    className="flex items-center gap-2"
                >
                    <IconRefresh className={`w-4 h-4 transition-transform duration-500 ${loadingData ? 'animate-spin' : ''}`} /> Refrescar
                </Button>
                <div className="w-64">
                    <Input
                        placeholder="Buscar proveedor, fecha o tipo..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                    />
                </div>
            </div>
        </div>

        {/* Mensaje de error sutil */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500"></div>
                <span className="text-sm text-red-700">{error}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
            <Badge
            variant="outline"
            className={cn(
                "py-1 px-2 cursor-pointer border",
                selectedType === null 
                ? "border-primary bg-primary/5" 
                : "hover:bg-neutral-50"
            )}
            onClick={() => setSelectedType(null)}
            >
            Todos
            </Badge>
            {Object.entries(DOC_TYPE_MAP).map(([key, { label, activeColor, activeBg }]) => (
            <Badge
                key={key}
                variant="outline"
                className={cn(
                "flex items-center gap-2 py-1 px-2 cursor-pointer border",
                selectedType === key
                    ? `${activeColor} ${activeBg}`
                    : "hover:bg-neutral-50"
                )}
                onClick={() => setSelectedType(key === selectedType ? null : key)}
            >
                <div className={`w-2 h-2 rounded-full ${DOC_TYPE_MAP[key].color}`} />
                {label}
            </Badge>
            ))}
        </div>

        <Card>
            {loadingData ? (
              <ReceiptsTableSkeleton />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50 no-hover border-0">
                    <TableHead className="w-8 h-12">
                      <Checkbox 
                        checked={visibleReceipts.length > 0 && selectedReceipts.length === visibleReceipts.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-36 h-12">
                      <button onClick={() => handleSort("date")} className="flex items-center gap-1 hover:text-neutral-900 transition-colors">
                        Fecha {getSortIcon("date")}
                      </button>
                    </TableHead>
                    <TableHead className="w-64 h-12">
                      <button onClick={() => handleSort("provider")} className="flex items-center gap-1 hover:text-neutral-900 transition-colors">
                        Proveedor {getSortIcon("provider")}
                      </button>
                    </TableHead>
                    <TableHead className="w-48 h-12">Tipo</TableHead>
                    <TableHead className="w-32 h-12">Estado</TableHead>
                    <TableHead className="w-36 h-12">
                      <button onClick={() => handleSort("total")} className="flex items-center gap-1 hover:text-neutral-900 transition-colors">
                        Total {getSortIcon("total")}
                      </button>
                    </TableHead>
                    <TableHead className="w-48 h-12">Notas</TableHead>
                    <TableHead className="w-10 h-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleReceipts.length > 0 ? (
                    visibleReceipts.map(receipt => (
                      <TableRow key={receipt.id} className="border-b last:border-b-0 hover:bg-neutral-50">
                          <TableCell className="w-8">
                            <Checkbox 
                              checked={selectedReceipts.includes(receipt.id)}
                              onCheckedChange={(checked) => handleSelectReceipt(receipt.id, checked === true)}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{new Date(receipt.date).toLocaleDateString()}</TableCell>
                          <TableCell className="max-w-[200px]">
                            <div className="truncate">
                              {receipt.provider}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <QuickTypeChanger 
                              receipt={receipt} 
                              onTypeChanged={loadReceipts}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <IntegrationStatusBadge receipt={receipt} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{formatCurrency(receipt.total)}</TableCell>
                          <TableCell className="max-w-48">
                            <div className="truncate text-sm text-gray-600">
                              {receipt.notas || '-'}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1">
                              <div className="inline-flex">
                                <PdfViewer
                                  receiptId={receipt.id}
                                  receiptInfo={{
                                    proveedor: receipt.provider,
                                    total: receipt.total,
                                    fecha_emision: receipt.fecha_emision || receipt.date,
                                    numero_factura: receipt.numero_factura || `#${receipt.id}`
                                  }}
                                />
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                                onClick={() => handleDownload(receipt.id, receipt.numero_factura || `#${receipt.id}`)}
                              >
                                <IconDownload className="h-4 w-4" />
                              </Button>
                              <OriginalImageViewer receipt={receipt} />
                              <EditReceiptDialog
                                receipt={{
                                  id: receipt.id,
                                  proveedor: receipt.provider,
                                  numero_factura: receipt.numero_factura || null,
                                  total: receipt.total,
                                  fecha_emision: receipt.fecha_emision || receipt.date,
                                  moneda: receipt.moneda || 'EUR',
                                  tipo_factura: receipt.tipo_factura || 'ticket',
                                  notas: receipt.notas,
                                  metadatos: receipt.metadatos
                                }}
                                onReceiptUpdated={loadReceipts}
                              />
                          </div>
                          </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                        <TableCell colSpan={8} className="text-center py-12">
                          <div className="flex flex-col items-center justify-center space-y-4">
                            {/* Imagen SVG */}
                            <div className={`mx-auto mb-4 ${search || selectedType ? "w-64 h-64 -mt-10 -mb-10" : "w-48 h-48"}`}>
                              <img 
                                src={search || selectedType ? "/Group 18.png" : "/Group 7.svg"}
                                alt={search || selectedType ? "No se encontraron tickets" : "No hay tickets"} 
                                className="w-full h-full object-contain"
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <h3 className="text-lg font-medium text-neutral-900">
                                {search || selectedType 
                                                  ? "No hay tickets que coincidan con tu búsqueda"
                : "No tienes tickets aún"
                                }
                              </h3>
                              <p className="text-sm text-neutral-500 max-w-md">
                                {search || selectedType 
                                  ? "Intenta ajustar los filtros o buscar con otros términos para encontrar lo que necesitas."
                                  : "Comienza subiendo tu primer recibo para empezar a organizar todas tus facturas y documentos."
                                }
                              </p>
                            </div>
                          </div>
                        </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
        </Card>

        {/* Paginación */}
        <div className="flex items-center justify-between px-2 h-12 mt-6">
            <div className="w-[100px]">
              {page > 1 && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="w-full"
                >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
              )}
            </div>
            
            <span className="text-sm text-neutral-700">
              Página {page} de {totalPages}
            </span>
            
            <div className="w-[100px]">
              {page < totalPages && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="w-full"
                >
                    Siguiente <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
        </div>
        </div>

        {/* Diálogo de confirmación para eliminar */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar eliminación</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-neutral-600">
                ¿Estás seguro de que quieres eliminar {selectedReceipts.length === 1 ? 'este ticket' : `estos ${selectedReceipts.length} tickets`}? 
                Esta acción no se puede deshacer.
              </p>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteSelected}
                disabled={loadingData}
              >
                {loadingData ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
} 