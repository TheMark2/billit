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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Filter, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Trash2, Brain, Sparkles } from "lucide-react";
import { IconEye, IconDownload, IconFileInvoice, IconReceipt2, IconQuote, IconShoppingCart, IconReport, IconNotes, IconReceiptRefund, IconFileDollar, IconRefresh, IconPhoto, IconEdit, IconTrash, IconCheck, IconCopy, IconLoader } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { Checkbox } from "@/components/ui/checkbox";
import { ReceiptsTableSkeleton } from "@/components/dashboard/Skeletons";
import PdfViewer from "@/components/dashboard/PdfViewer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import EditReceiptDialog from "@/components/dashboard/EditReceiptDialog";

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
  url_imagen?: string;
  url_archivo?: string;
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
    categoria_negocio?: string;
    ai_analysis?: {
      accounting_account?: string;
      confidence?: number;
      analyzed_at?: string;
    };
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

  // Verificar si hay integraciones exitosas independientemente del estado general
  if (successfulIntegrations.length > 0) {
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

  // Verificar si hay errores en las integraciones
  const hasIntegrationErrors = integrationsSummary 
    ? Object.entries(integrationsSummary)
        .some(([key, status]) => key !== 'pdf' && status === 'failed')
    : false;

  if (receipt.status === 'error' || hasIntegrationErrors) {
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
    // 1. WhatsApp data con URL original
    if (receipt.metadatos?.whatsapp_data?.file_info?.original_url) {
      return receipt.metadatos.whatsapp_data.file_info.original_url;
    }
    
    // 2. URL de imagen directa
    if (receipt.url_imagen) {
      return receipt.url_imagen;
    }
    
    // 3. URL de archivo
    if (receipt.url_archivo) {
      return receipt.url_archivo;
    }
    
    // 4. Para archivos procesados, usar endpoint de imagen
    if (receipt.id) {
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
  
  // Ensure documentType has a default value if empty
  const safeDocumentType = receipt.documentType || 'other_financial';

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
        <Select value={safeDocumentType} onValueChange={handleTypeChange} disabled={isChanging}>
          <SelectTrigger className="text-xs absolute inset-0 w-full h-full opacity-0 border-none bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Badge>
  );
};

// Component for image with fallback
const ImageWithFallback = ({ src, alt }: { src: string; alt: string }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (hasError) {
    return (
      <div className="text-center text-red-500">
        <IconPhoto className="h-16 w-16 mx-auto mb-4 text-red-300" />
        <p>Error al cargar la imagen</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
      <img 
        src={src}
        alt={alt}
        className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
    </div>
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
  const [isAnalyzing, setIsAnalyzing] = useState<string[]>([]);
  const [isBulkAnalyzing, setIsBulkAnalyzing] = useState(false);
  
  // Estados para filtros avanzados
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({start: '', end: ''});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isFiltersDialogOpen, setIsFiltersDialogOpen] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [imageViewerReceipt, setImageViewerReceipt] = useState<Receipt | null>(null);
  const [isSendToAccountantDialogOpen, setIsSendToAccountantDialogOpen] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

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

  const loadReceipts = useCallback(async (loadMore = false) => {
    if (!loadMore) {
      setLoadingData(true);
      setError(null); // Limpiar errores previos
      setHasMoreData(true);
    } else {
      setLoadingMore(true);
    }
    
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

      // Calcular el offset para paginación
      const offset = loadMore ? receipts.length : 0;
      const limit = 50; // Cargar 50 tickets por vez

      // Construir la consulta optimizada con paginación
      let query = supabase
        .from("receipts")
        .select("id, proveedor, total, created_at, estado, metadatos, numero_factura, fecha_emision, moneda, tipo_factura, notas, url_imagen, url_archivo")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;

      console.log('🔍 [RECEIPTS] Query executed:', {
        offset,
        limit,
        uid,
        dataLength: data?.length,
        error: error?.message
      });

      if (error) {
        console.error('❌ [RECEIPTS] Database error:', error);
        // Solo mostrar error si es crítico
        if (error.message.includes('RLS') || error.message.includes('permission')) {
          setError('Error de permisos. Intenta recargar la página.');
        } else {
          setError(`Error al cargar tickets: ${error.message}`);
        }
        setReceipts([]); // Limpiar tickets en caso de error
        setLoadingData(false);
        return;
      }

      if (data && data.length > 0) {
        console.log('📊 [RECEIPTS] Raw data sample:', data[0]);
        const mapped: Receipt[] = data.map((r: any) => {
          try {
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
            url_imagen: r.url_imagen,
            url_archivo: r.url_archivo,
            metadatos: r.metadatos,
          };
          } catch (error) {
            console.error('❌ [RECEIPTS] Error mapping receipt:', r.id, error);
            // Return a basic receipt object if mapping fails
            return {
              id: r.id,
              date: r.created_at,
              provider: r.proveedor || "-",
              documentType: "Ticket",
              total: parseFloat(r.total) || 0,
              status: r.estado || "PENDIENTE",
              numero_factura: r.numero_factura,
              fecha_emision: r.fecha_emision,
              moneda: r.moneda,
              tipo_factura: r.tipo_factura,
              notas: r.notas,
              url_imagen: r.url_imagen,
              url_archivo: r.url_archivo,
              metadatos: {},
            };
          }
        });
        
        // Si es carga inicial, reemplazar. Si es carga adicional, agregar
        if (loadMore) {
          setReceipts(prev => [...prev, ...mapped]);
        } else {
          setReceipts(mapped);
        }
        
        // Verificar si hay más datos (si se obtuvieron menos de 50, no hay más)
        if (mapped.length < 50) {
          setHasMoreData(false);
        }
      } else {
        console.log('🔄 [RECEIPTS] No data returned or empty array');
        if (!loadMore) {
          setReceipts([]); // Solo limpiar en carga inicial
        }
        setHasMoreData(false);
      }

      setLoadingData(false);
      setLoadingMore(false);
    } catch (error) {
      setError(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      if (!loadMore) {
        setReceipts([]);
      }
      setLoadingData(false);
      setLoadingMore(false);
    }
  }, [receipts.length]);

  // Función separada para el botón de refresh
  const handleRefresh = () => {
    loadReceipts();
  };

  const handleSendToAccountant = async () => {
    setIsSendToAccountantDialogOpen(true);
  };

  const handleGenerateReport = async () => {
    try {
      setIsGeneratingReport(true);
      console.log('🚀 Starting report generation...');
      
      // Generar un enlace único para el contable
      const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('📋 Generated report ID:', reportId);
      console.log('📊 Filtered receipts count:', filteredReceipts.length);
      
      // Crear el reporte con todos los tickets filtrados
      const reportData = {
        id: reportId,
        created_at: new Date().toISOString(),
        receipts: filteredReceipts.map(receipt => ({
          id: receipt.id,
          provider: receipt.provider,
          total: receipt.total,
          date: receipt.date,
          numero_factura: receipt.numero_factura,
          tipo_factura: receipt.tipo_factura,
          moneda: receipt.moneda,
          cuenta_contable: receipt.metadatos?.categoria_negocio || '629 - Otros servicios',
          notas: receipt.notas
        })),
        total_amount: filteredReceipts.reduce((sum, receipt) => sum + receipt.total, 0),
        total_count: filteredReceipts.length,
        filters_applied: {
          month: selectedMonth,
          quarter: selectedQuarter,
          provider: selectedProvider,
          dateRange: { start: dateRange?.start, end: dateRange?.end }
        }
      };

      console.log('📄 Report data prepared:', {
        id: reportData.id,
        total_count: reportData.total_count,
        total_amount: reportData.total_amount,
        filters_applied: reportData.filters_applied,
        receipts_sample: reportData.receipts.slice(0, 3)
      });

      // Obtener usuario actual
      console.log('👤 Getting current user...');
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('❌ Error getting user:', userError);
        throw new Error('Error al obtener usuario');
      }
      
      console.log('✅ User obtained:', userData.user?.id);

      // Guardar el reporte en Supabase
      console.log('💾 Saving report to Supabase...');
      const insertData = {
        id: reportId,
        report_data: reportData,
        created_by: userData.user?.id,
        status: 'pending'
      };
      
      console.log('📤 Insert data:', insertData);
      
      const { data, error } = await supabase
        .from('accounting_reports')
        .insert(insertData);

      console.log('📥 Supabase insert response:', { data, error });

      if (error) {
        console.error('❌ Error creating report:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new Error(`Error al crear el reporte: ${error.message}`);
      }

      console.log('✅ Report saved successfully');

      // Generar el enlace para el contable
      const accountantLink = `${window.location.origin}/contable/${reportId}`;
      console.log('🔗 Generated accountant link:', accountantLink);
      
      setGeneratedReport({
        ...reportData,
        link: accountantLink
      });
      
      console.log('🎉 Report generation completed successfully!');
      
    } catch (error) {
      console.error('💥 Error in handleGenerateReport:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`Error al enviar al contable: ${errorMessage}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleCopyLink = async () => {
    console.log('📋 Attempting to copy link to clipboard...');
    if (generatedReport?.link) {
      console.log('🔗 Link to copy:', generatedReport.link);
      try {
        await navigator.clipboard.writeText(generatedReport.link);
        console.log('✅ Link copied successfully');
        alert('Enlace copiado al portapapeles');
      } catch (error) {
        console.error('❌ Error copying to clipboard:', error);
        // Fallback: mostrar el enlace para copiarlo manualmente
        prompt('No se pudo copiar automáticamente. Copia este enlace:', generatedReport.link);
      }
    } else {
      console.error('❌ No link available to copy');
    }
  };

  // Función para cargar más datos
  const loadMoreReceipts = () => {
    loadReceipts(true);
  };

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

  const uniqueProviders = useMemo(() => {
    const providers = receipts.map(receipt => receipt.provider).filter(Boolean);
    return [...new Set(providers)].sort();
  }, [receipts]);

  // Función para filtrar por mes
  const filterByMonth = (receipt: Receipt, month: string) => {
    const receiptDate = new Date(receipt.date);
    const [year, monthNum] = month.split('-');
    return receiptDate.getFullYear() === parseInt(year) && 
           receiptDate.getMonth() === parseInt(monthNum) - 1;
  };

  // Función para filtrar por trimestre
  const filterByQuarter = (receipt: Receipt, quarter: string) => {
    const receiptDate = new Date(receipt.date);
    const [year, quarterNum] = quarter.split('-Q');
    const receiptYear = receiptDate.getFullYear();
    const receiptQuarter = Math.floor(receiptDate.getMonth() / 3) + 1;
    
    return receiptYear === parseInt(year) && receiptQuarter === parseInt(quarterNum);
  };

  // Función para filtrar por rango de fechas
  const filterByDateRange = (receipt: Receipt, start: string, end: string) => {
    if (!start && !end) return true;
    const receiptDate = new Date(receipt.date);
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;
    
    if (startDate && receiptDate < startDate) return false;
    if (endDate && receiptDate > endDate) return false;
    return true;
  };

  // Función para limpiar todos los filtros
  const clearAllFilters = () => {
    setSelectedType(null);
    setSelectedMonth(null);
    setSelectedQuarter(null);
    setSelectedProvider(null);
    setDateRange({start: '', end: ''});
    setInputValue('');
  };

  // Contar filtros activos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedType) count++;
    if (selectedMonth) count++;
    if (selectedQuarter) count++;
    if (selectedProvider) count++;
    if (dateRange.start || dateRange.end) count++;
    if (inputValue.trim()) count++;
    return count;
  }, [selectedType, selectedMonth, selectedQuarter, selectedProvider, dateRange, inputValue]);

  const visibleReceipts = useMemo(() => {
    const filtered = receipts.filter(receipt => {
      // Filtro por búsqueda de texto
      if (inputValue.trim()) {
        const searchTerm = inputValue.toLowerCase();
        const matchesSearch = 
          receipt.provider.toLowerCase().includes(searchTerm) ||
          receipt.date.includes(searchTerm) ||
          receipt.tipo_factura?.toLowerCase().includes(searchTerm) ||
          receipt.notas?.toLowerCase().includes(searchTerm);
        if (!matchesSearch) return false;
      }

      // Filtro por tipo
      if (selectedType && receipt.tipo_factura !== selectedType) {
        return false;
      }

      // Filtro por mes
      if (selectedMonth && !filterByMonth(receipt, selectedMonth)) {
        return false;
      }

      // Filtro por trimestre
      if (selectedQuarter && !filterByQuarter(receipt, selectedQuarter)) {
        return false;
      }

      // Filtro por proveedor
      if (selectedProvider && receipt.provider !== selectedProvider) {
        return false;
      }

      // Filtro por rango de fechas
      if (!filterByDateRange(receipt, dateRange.start, dateRange.end)) {
        return false;
      }

      return true;
    });

    // Aplicar paginación
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [receipts, inputValue, selectedType, selectedMonth, selectedQuarter, selectedProvider, dateRange, page]);

  // Calcular total de páginas basado en los receipts filtrados
  const totalFilteredReceipts = useMemo(() => {
    return receipts.filter(receipt => {
      // Misma lógica de filtrado pero sin paginación
      if (inputValue.trim()) {
        const searchTerm = inputValue.toLowerCase();
        const matchesSearch = 
          receipt.provider.toLowerCase().includes(searchTerm) ||
          receipt.date.includes(searchTerm) ||
          receipt.tipo_factura?.toLowerCase().includes(searchTerm) ||
          receipt.notas?.toLowerCase().includes(searchTerm);
        if (!matchesSearch) return false;
      }

      if (selectedType && receipt.tipo_factura !== selectedType) return false;
      if (selectedMonth && !filterByMonth(receipt, selectedMonth)) return false;
      if (selectedQuarter && !filterByQuarter(receipt, selectedQuarter)) return false;
      if (selectedProvider && receipt.provider !== selectedProvider) return false;
      if (!filterByDateRange(receipt, dateRange.start, dateRange.end)) return false;

      return true;
    }).length;
  }, [receipts, inputValue, selectedType, selectedMonth, selectedQuarter, selectedProvider, dateRange]);

  const totalPages = Math.max(1, Math.ceil(totalFilteredReceipts / PAGE_SIZE));

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

  const handleAIAnalysis = useCallback(async (receiptId: string) => {
    setIsAnalyzing(prev => [...prev, receiptId]);
    try {
      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ receiptId }),
      });

      if (!response.ok) {
        throw new Error('Error en el análisis de IA');
      }

      const result = await response.json();
      
      // Actualizar el receipt con el análisis
      await loadReceipts();
    } catch (error) {
      console.error('Error in AI analysis:', error);
      setError('Error al analizar con IA. Por favor, intenta de nuevo.');
    } finally {
      setIsAnalyzing(prev => prev.filter(id => id !== receiptId));
    }
  }, [loadReceipts]);

  const handleBulkAIAnalysis = useCallback(async () => {
    if (selectedReceipts.length === 0) return;
    
    setIsBulkAnalyzing(true);
    try {
      const response = await fetch('/api/ai-analysis/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ receiptIds: selectedReceipts }),
      });

      if (!response.ok) {
        throw new Error('Error en el análisis masivo de IA');
      }

      const result = await response.json();
      
      // Actualizar los receipts con los análisis
      await loadReceipts();
      setSelectedReceipts([]);
    } catch (error) {
      console.error('Error in bulk AI analysis:', error);
      setError('Error al analizar con IA. Por favor, intenta de nuevo.');
    } finally {
      setIsBulkAnalyzing(false);
    }
  }, [selectedReceipts, loadReceipts]);

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
                    onClick={handleRefresh}
                    variant="outline"
                    className="flex items-center gap-2"
                    size="sm"
                >
                    <IconRefresh className={`w-4 h-4 transition-transform duration-500 ${loadingData ? 'animate-spin' : ''}`} /> Refrescar
                </Button>
                <Button
                  onClick={() => setIsFiltersDialogOpen(true)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Filtros
                  {activeFiltersCount > 0 && (
                    <Badge variant="outline" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
                
                <Button
                  onClick={() => setIsSendToAccountantDialogOpen(true)}
                  variant="default"
                  size="sm"
                  className="flex items-center gap-2"
                  disabled={filteredReceipts.length === 0}
                >
                  <IconReport className="h-4 w-4" />
                  Enviar al Contable
                </Button>
                
                <Dialog open={isFiltersDialogOpen} onOpenChange={setIsFiltersDialogOpen}>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>Filtros Avanzados</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 py-4">
                      {/* Filtro por Mes */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Mes</label>
                        <Select value={selectedMonth || 'all'} onValueChange={(value) => setSelectedMonth(value === 'all' ? null : value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar mes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los meses</SelectItem>
                            {Array.from({length: 12}, (_, i) => {
                              const month = new Date(2024, i, 1).toLocaleDateString('es-ES', { month: 'long' });
                              return (
                                <SelectItem key={i + 1} value={String(i + 1)}>
                                  {month.charAt(0).toUpperCase() + month.slice(1)}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Filtro por Trimestre */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Trimestre</label>
                        <Select value={selectedQuarter || 'all'} onValueChange={(value) => setSelectedQuarter(value === 'all' ? null : value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar trimestre" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los trimestres</SelectItem>
                            <SelectItem value="Q1">Q1 (Ene-Mar)</SelectItem>
                            <SelectItem value="Q2">Q2 (Abr-Jun)</SelectItem>
                            <SelectItem value="Q3">Q3 (Jul-Sep)</SelectItem>
                            <SelectItem value="Q4">Q4 (Oct-Dic)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Filtro por Proveedor */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Proveedor</label>
                        <Select value={selectedProvider || 'all'} onValueChange={(value) => setSelectedProvider(value === 'all' ? null : value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar proveedor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los proveedores</SelectItem>
                            {Array.from(new Set(receipts.map(r => r.provider))).sort().map(provider => (
                              <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Rango de fechas */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Rango de fechas</label>
                        <div className="flex gap-2">
                          <Input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="text-sm"
                          />
                          <Input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={clearAllFilters}>
                        Limpiar filtros
                      </Button>
                      <Button onClick={() => setIsFiltersDialogOpen(false)}>
                        Aplicar filtros
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
                    <TableHead className="w-32 h-12">Estado</TableHead>
                    <TableHead className="w-36 h-12">
                      <button onClick={() => handleSort("total")} className="flex items-center gap-1 hover:text-neutral-900 transition-colors">
                        Total {getSortIcon("total")}
                      </button>
                    </TableHead>
                    <TableHead className="w-48 h-12">Categoría</TableHead>

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
                            <IntegrationStatusBadge receipt={receipt} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{formatCurrency(receipt.total)}</TableCell>
                          <TableCell className="max-w-48">
                            <div className="flex items-center gap-2">
                              {(receipt.metadatos?.categoria_negocio || receipt.metadatos?.ai_analysis?.accounting_account) && (
                                <Badge variant="outline" className="text-xs max-w-[200px] px-2 py-1">
                                  <span className="truncate">
                                    {receipt.metadatos?.categoria_negocio || receipt.metadatos?.ai_analysis?.accounting_account}
                                  </span>
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              {/* Primary action - PDF Viewer */}
                              <PdfViewer
                                receiptId={receipt.id}
                                receiptInfo={{
                                  proveedor: receipt.provider,
                                  total: receipt.total,
                                  fecha_emision: receipt.fecha_emision || receipt.date,
                                  numero_factura: receipt.numero_factura || `#${receipt.id}`
                                }}
                              />
                              
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0" 
                                  onClick={() => handleDownload(receipt.id, receipt.numero_factura || `#${receipt.id}`)}
                                  title="Descargar PDF"
                                >
                                  <IconDownload className="h-4 w-4 text-gray-500" />
                                </Button>
                                
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0" 
                                  onClick={() => {
                                    console.log('Receipt data:', receipt);
                                    console.log('Image URL:', receipt.metadatos?.whatsapp_data?.file_info?.original_url);
                                    setImageViewerReceipt(receipt);
                                  }}
                                  disabled={!receipt.metadatos?.whatsapp_data?.file_info?.original_url}
                                  title="Ver imagen original"
                                >
                                  <IconPhoto className="h-4 w-4 text-gray-500" />
                                </Button>
                                
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
                                  onReceiptUpdated={handleRefresh}
                                  trigger={
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-8 w-8 p-0" 
                                      title="Editar recibo"
                                    >
                                      <IconEdit className="h-4 w-4 text-gray-500" />
                                    </Button>
                                  }
                                />
                              </div>
                            </div>
                          </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
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

        {/* Image Viewer Dialog */}
        {imageViewerReceipt && (
          <Dialog open={!!imageViewerReceipt} onOpenChange={() => setImageViewerReceipt(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>Imagen Original - {imageViewerReceipt.provider}</DialogTitle>
              </DialogHeader>
              <div className="flex justify-center items-center min-h-[400px]">
                {imageViewerReceipt.metadatos?.whatsapp_data?.file_info?.original_url ? (
                  <ImageWithFallback 
                    src={imageViewerReceipt.metadatos.whatsapp_data.file_info.original_url}
                    alt="Imagen original del recibo"
                  />
                ) : (
                  <div className="text-center text-gray-500">
                    <IconPhoto className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p>No hay imagen disponible</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Send to Accountant Dialog */}
        <Dialog open={isSendToAccountantDialogOpen} onOpenChange={setIsSendToAccountantDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Enviar Reporte al Contable</DialogTitle>
            </DialogHeader>
            
            {!generatedReport ? (
              <div className="space-y-6">
                {/* Summary */}
                <div className="bg-neutral-50 p-4 rounded-lg border">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total de Tickets</p>
                      <p className="text-xl font-bold text-gray-900">{filteredReceipts.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Monto Total</p>
                      <p className="text-xl font-bold text-gray-900">
                        {formatCurrency(filteredReceipts.reduce((sum, receipt) => sum + receipt.total, 0))}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Filters Applied */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Filtros Aplicados</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedMonth && (
                      <Badge variant="outline">Mes: {selectedMonth}</Badge>
                    )}
                    {selectedQuarter && (
                      <Badge variant="outline">Trimestre: {selectedQuarter}</Badge>
                    )}
                    {selectedProvider && (
                      <Badge variant="outline">Proveedor: {selectedProvider}</Badge>
                    )}
                    {dateRange?.start && (
                      <Badge variant="outline">
                        Rango: {new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()}
                      </Badge>
                    )}
                    {!selectedMonth && !selectedQuarter && !selectedProvider && !dateRange?.start && (
                      <Badge variant="outline">Todos los tickets</Badge>
                    )}
                  </div>
                </div>

                {/* Preview of tickets */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Vista Previa de Tickets</h3>
                  <div className="max-h-60 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Proveedor</th>
                          <th className="px-3 py-2 text-left">Fecha</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReceipts.slice(0, 5).map((receipt) => (
                          <tr key={receipt.id} className="border-t">
                            <td className="px-3 py-2">{receipt.provider}</td>
                            <td className="px-3 py-2">{new Date(receipt.date).toLocaleDateString()}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(receipt.total)}</td>
                          </tr>
                        ))}
                        {filteredReceipts.length > 5 && (
                          <tr className="border-t bg-gray-50">
                            <td colSpan={3} className="px-3 py-2 text-center text-gray-500">
                              ... y {filteredReceipts.length - 5} tickets más
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsSendToAccountantDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleGenerateReport}
                    isLoading={isGeneratingReport}
                    disabled={isGeneratingReport || filteredReceipts.length === 0}
                  >
                    {isGeneratingReport ? (
                      <>
                        Generando...
                      </>
                    ) : (
                      'Generar Reporte'
                    )}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Success message */}
                <div className="text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                    <IconCheck className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">¡Reporte Generado Exitosamente!</h3>
                  <p className="text-gray-600">El reporte ha sido creado y está listo para enviar al contable.</p>
                </div>

                {/* Report details */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Total de Tickets</p>
                      <p className="text-lg font-bold text-gray-900">{generatedReport.total_count}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Monto Total</p>
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(generatedReport.total_amount)}</p>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600 mb-2">Enlace para el Contable:</p>
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={generatedReport.link} 
                        readOnly 
                        className="flex-1 px-3 py-2 border rounded-md bg-white text-sm"
                      />
                      <Button onClick={handleCopyLink} variant="outline" size="sm">
                        <IconCopy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsSendToAccountantDialogOpen(false);
                      setGeneratedReport(null);
                    }}
                  >
                    Cerrar
                  </Button>
                  <Button 
                    onClick={handleCopyLink}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <IconCopy className="h-4 w-4 mr-2" />
                    Copiar Enlace
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

    </div>
  );
}