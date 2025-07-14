"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { ReceiptDetails } from "@/components/ui/receipt-details";
import { IconRefresh, IconEye, IconDownload, IconReceipt } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

const DOC_TYPE_MAP: Record<string, { label: string; color: string }> = {
  invoice: { label: "Factura", color: "bg-emerald-500" },
  payslip: { label: "Nómina", color: "bg-violet-500" },
  quote: { label: "Presupuesto", color: "bg-amber-500" },
  purchase_order: { label: "Pedido", color: "bg-orange-500" },
  statement: { label: "Extracto", color: "bg-slate-500" },
  receipt: { label: "Recibo", color: "bg-sky-500" },
  credit_note: { label: "Abono", color: "bg-rose-500" },
  other_financial: { label: "Otro", color: "bg-neutral-500" },
};

interface Receipt {
  id: string;
  date: string;
  provider: string;
  documentType: string;
  total: number;
}

function RecentReceiptsSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, idx) => (
        <TableRow key={idx} className="animate-pulse h-12">
          <TableCell>
            <div className="h-4 w-32 bg-neutral-200 rounded" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-24 bg-neutral-200 rounded" />
          </TableCell>
          <TableCell>
            <div className="h-6 w-20 bg-neutral-200 rounded" />
          </TableCell>
          <TableCell className="text-right">
            <div className="h-4 w-16 bg-neutral-200 rounded ml-auto" />
          </TableCell>
          <TableCell className="w-20">
            <div className="h-8 w-8 bg-neutral-200 rounded-full ml-auto" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function RecentReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      
      if (!uid) {
        setReceipts([]);
        return;
      }

      // Obtener empresa_id del perfil
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", uid)
        .single();
      
      const empId = profile?.empresa_id;

      // Obtener últimos 4 recibos
      const { data: receiptsRaw, error } = await supabase
        .from("receipts")
        .select("id, proveedor, total, created_at, metadatos")
        .or(`user_id.eq.${uid}${empId ? ",empresa_id.eq." + empId : ""}`)
        .order("created_at", { ascending: false })
        .limit(4);

      if (error) {
        console.error("Error al cargar recibos:", error);
        setReceipts([]);
        return;
      }

      const mapped: Receipt[] = (receiptsRaw || []).map((r: any) => {
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
        
        const validKey = rawType && rawType in DOC_TYPE_MAP ? rawType : "other_financial";
        
        return {
          id: r.id,
          date: new Date(r.created_at).toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short"
          }),
          provider: r.proveedor || "Sin proveedor",
          documentType: validKey,
          total: parseFloat(r.total) || 0,
        };
      });

      setReceipts(mapped);
    } catch (error) {
      console.error("Error al cargar recibos:", error);
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, []);

  const handleViewAllReceipts = () => {
    router.push("/dashboard/recibos");
  };

  return (
    <Card className="rounded-2xl border bg-white shadow-none">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-neutral-900">Últimos Recibos</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadReceipts}
              disabled={loading}
              className="h-8 px-3 text-xs flex items-center gap-1"
            >
              <IconRefresh className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refrescar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewAllReceipts}
              className="h-8 px-3 text-xs"
            >
              Ver todos
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 overflow-hidden">
          <Table>
            <TableHeader className="border-b">
              <TableRow className="bg-neutral-50 border-none">
                <TableHead className="font-medium text-neutral-700 h-10">Proveedor</TableHead>
                <TableHead className="font-medium text-neutral-700 h-10">Fecha</TableHead>
                <TableHead className="font-medium text-neutral-700 h-10">Tipo</TableHead>
                <TableHead className="font-medium text-neutral-700 text-right h-10">Total</TableHead>
                <TableHead className="w-20 h-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="min-h-[240px]">
              {loading ? (
                <RecentReceiptsSkeleton />
              ) : receipts.length > 0 ? (
                <>
                  {receipts.map((receipt) => (
                    <TableRow key={receipt.id} className="border-neutral-200 hover:bg-neutral-50 transition-colors h-12">
                      <TableCell className="font-medium text-neutral-900">
                        <div className="max-w-[200px] truncate">
                          {receipt.provider}
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-neutral-600 text-sm">
                        {receipt.date}
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant="outline" className="gap-2 border-0 bg-neutral-100 hover:bg-neutral-100">
                          <div className={`w-2 h-2 rounded-full ${DOC_TYPE_MAP[receipt.documentType].color}`} />
                          <span className="text-xs font-medium text-neutral-700">
                            {DOC_TYPE_MAP[receipt.documentType].label}
                          </span>
                        </Badge>
                      </TableCell>
                      
                      <TableCell className="text-right font-medium text-neutral-900">
                        {formatCurrency(receipt.total)}
                      </TableCell>
                      
                      <TableCell className="w-20">
                        <ReceiptDetails
                          receipt={receipt}
                          trigger={
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <IconEye className="h-4 w-4" />
                            </Button>
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Rellenar filas vacías para mantener altura consistente */}
                  {Array.from({ length: Math.max(0, 4 - receipts.length) }).map((_, idx) => (
                    <TableRow key={`empty-${idx}`} className="h-12">
                      <TableCell colSpan={5} className="border-0"></TableCell>
                    </TableRow>
                  ))}
                </>
              ) : (
                <>
                                      <TableRow className="h-12">
                      <TableCell colSpan={5} className="h-28">
                        <div className="flex flex-col items-center justify-center text-center">
                          {/* Group 7 SVG */}
                          <div className="w-24 h-24 mx-auto mb-3">
                            <img 
                              src="/Group 7.svg" 
                              alt="No hay recibos recientes" 
                              className="w-full h-full object-contain"
                            />
                          </div>
                          
                          <h3 className="text-sm font-medium text-neutral-900 mb-1">
                            No hay recibos recientes
                          </h3>
                          <p className="text-sm text-neutral-500">
                            Los recibos que subas aparecerán aquí.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  {/* Rellenar filas vacías */}
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <TableRow key={`empty-${idx}`} className="h-12">
                      <TableCell colSpan={5} className="border-0"></TableCell>
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
} 