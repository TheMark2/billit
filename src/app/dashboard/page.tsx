"use client";
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ReceiptDetails } from "@/components/ui/receipt-details";
import { IconBuildingCog, IconEdit, IconInfoCircle, IconLocationPin, IconMail, IconMessageCircle, IconPhone, IconReceipt, IconUserPlus, IconDotsVertical, IconTrendingUp, IconRefresh, IconEye, IconEyeOff } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Suspense } from "react";
import { PlanStatus } from "@/components/dashboard/PlanStatus";
import { PlanStatusSkeleton } from "@/components/dashboard/Skeletons";
import { MetricsSkeleton, ReceiptsSkeleton, CompanyInfoSkeleton } from "@/components/dashboard/Skeletons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RecentReceipts } from "@/components/dashboard/RecentReceipts";
import { useRouter } from 'next/navigation';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

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

// Componente compacto para cada métrica
const MetricBox = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => (
  <div className="flex items-center gap-4 rounded-xl bg-neutral-50 p-2 border">
    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white ring-1 ring-inset ring-neutral-200">
      {icon}
    </div>
    <div className="flex flex-col">
      <span className="text-xs text-neutral-500 leading-none">{label}</span>
      <span className="text-lg font-semibold text-neutral-800 leading-none">{value}</span>
    </div>
  </div>
);

export default function DashboardPage() {
  const [metrics, setMetrics] = useState({
    totalReceipts: 0,
    totalComments: 0,
    totalShares: 0,
    engagement: 0,
  });
  const [dailyStats, setDailyStats] = useState<Array<{
    date: string;
    count: number;
  }>>([]);
  const [hoveredData, setHoveredData] = useState<{
    date: string;
    count: number;
  } | null>(null);
  const [chartPeriod, setChartPeriod] = useState<'weekly' | 'monthly' | 'quarterly'>('weekly');
  const [buttonWidths, setButtonWidths] = useState<Record<string, number>>({});
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  const [companyInfo, setCompanyInfo] = useState<{
    nombre: string;
    cif: string;
    direccion: string;
    email: string;
    telefono: string;
    empresa_id: string;
  } | null>(null);

  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingChart, setLoadingChart] = useState(false);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [showCif, setShowCif] = useState(false);

  const [user, setUser] = useState<User | null>(null);

  const router = useRouter();

  // Memoizar datos de empresa para evitar recálculos
  const companyConnected = useMemo(() => !!companyInfo, [companyInfo]);

  // Función para obtener estadísticas según el período seleccionado
  const fetchChartData = useCallback(async (period: 'weekly' | 'monthly' | 'quarterly') => {
    setLoadingChart(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) {
      setLoadingChart(false);
      return;
    }

    let daysBack: number;
    let dateFormat: Intl.DateTimeFormatOptions;
    let groupBy: 'day' | 'week' | 'month' = 'day';
    
    switch (period) {
      case 'weekly':
        daysBack = 7;
        dateFormat = { weekday: 'short' };
        groupBy = 'day';
        break;
      case 'monthly':
        daysBack = 30;
        dateFormat = { day: 'numeric' };
        groupBy = 'day';
        break;
      case 'quarterly':
        daysBack = 90;
        dateFormat = { month: 'short' };
        groupBy = 'month';
        break;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const { data: receipts } = await supabase
      .from("receipts")
      .select("created_at")
      .eq("user_id", uid)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true });

    // Crear un mapa de fechas con conteos inicializados a 0
    const dateMap = new Map();
    const datesList: string[] = [];
    
    if (period === 'weekly') {
      // Para semanal, mostrar los últimos 7 días en orden
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        datesList.push(dateStr);
        dateMap.set(dateStr, 0);
      }
    } else if (period === 'monthly') {
      // Para mensual, mostrar los últimos 30 días en orden
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        datesList.push(dateStr);
        dateMap.set(dateStr, 0);
      }
    } else {
      // Para trimestral, agrupar por meses (últimos 3 meses) en orden
      for (let i = 2; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const dateStr = monthStart.toISOString().split('T')[0];
        datesList.push(dateStr);
        dateMap.set(dateStr, 0);
      }
    }

    // Contar recibos por período
    (receipts || []).forEach((receipt: any) => {
      const receiptDate = new Date(receipt.created_at);
      
      if (period === 'quarterly') {
        // Para trimestral, agrupar por meses
        const monthStart = new Date(receiptDate.getFullYear(), receiptDate.getMonth(), 1);
        const dateStr = monthStart.toISOString().split('T')[0];
        if (dateMap.has(dateStr)) {
          dateMap.set(dateStr, dateMap.get(dateStr) + 1);
        }
      } else {
        // Para semanal y mensual, agrupar por días
        const dateStr = receipt.created_at.split('T')[0];
        if (dateMap.has(dateStr)) {
          dateMap.set(dateStr, dateMap.get(dateStr) + 1);
        }
      }
    });

    // Convertir a array manteniendo el orden correcto
    const chartData = datesList.map(dateStr => {
      const count = dateMap.get(dateStr) || 0;
      const date = new Date(dateStr);
      return {
        date: date.toLocaleDateString('es-ES', dateFormat),
        count,
        rawDate: dateStr // Añadir fecha raw para debugging
      };
    });

    console.log('Chart data generated:', chartData); // Debug log
    setDailyStats(chartData);
    setLoadingChart(false);
  }, []);

  // Memoizar función de fetch de datos
  const fetchData = useCallback(async () => {
    setLoadingMetrics(true);
    setLoadingCompany(true);

    // 1. Obtener sesión y UID
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;

    if (!uid) {
      setLoadingMetrics(false);
      setLoadingCompany(false);
      return;
    }

    // 2. Obtener empresa_id del perfil para poder filtrar recibos
    const { data: profile } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("id", uid)
      .single();
    const empId = profile?.empresa_id as string | undefined;

    // 3. Obtener el total de recibos para métricas
    const { data: receiptsRaw, error: receiptsErr } = await supabase
      .from("receipts")
      .select("id")
      .or(`user_id.eq.${uid}${empId ? ",empresa_id.eq." + empId : ""}`);

    if (receiptsErr) {
      console.error("Supabase receipts error", receiptsErr);
      console.error("Error details:", {
        message: receiptsErr.message,
        details: receiptsErr.details,
        hint: receiptsErr.hint,
        code: receiptsErr.code
      });
    } else {
      setMetrics((prev) => ({
        ...prev,
        totalReceipts: (receiptsRaw || []).length,
      }));
    }

    // 4. Obtener datos del gráfico según el período seleccionado
    await fetchChartData(chartPeriod);
    setLoadingMetrics(false);

    // 5. Información de la empresa (muy básica, puedes ampliar)
    if (empId) {
      const { data: empresa } = await supabase
        .from("empresas")
        .select("nombre_fiscal, cif, direccion, email_facturacion, telefono")
        .eq("id", empId)
        .single();

      if (empresa) {
        setCompanyInfo({
          nombre: empresa.nombre_fiscal,
          cif: empresa.cif,
          direccion: empresa.direccion,
          email: empresa.email_facturacion,
          telefono: empresa.telefono,
          empresa_id: empId,
        });
      }
    }

    setLoadingCompany(false);
  }, [fetchChartData, chartPeriod]);

  // Actualizar gráfico cuando cambie el período
  useEffect(() => {
    if (!loadingMetrics) {
      fetchChartData(chartPeriod);
    }
  }, [chartPeriod, fetchChartData, loadingMetrics]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Memoizar función de fetch de usuario
  const fetchUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    setUser(data.user ?? null);
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Efecto para medir anchos de botones
  useEffect(() => {
    if (!containerRef) return;

    const measureButtonWidths = () => {
      const newWidths: Record<string, number> = {};
      const buttons = containerRef.querySelectorAll('[data-period-button]');
      
      buttons.forEach((button) => {
        const period = button.getAttribute('data-period-button');
        if (period) {
          newWidths[period] = button.getBoundingClientRect().width;
        }
      });
      
      setButtonWidths(newWidths);
    };

    // Medir inmediatamente
    measureButtonWidths();
    
    // Medir después de un pequeño delay para asegurar que el DOM esté listo
    const timer = setTimeout(measureButtonWidths, 100);
    
    return () => clearTimeout(timer);
  }, [containerRef, chartPeriod]);

  // Componentes de skeleton específicos
  const NumberSkeleton = () => (
    <div className="flex flex-col">
      <div className="h-4 bg-neutral-200 rounded w-24 mb-2 animate-pulse"></div>
      <div className="h-8 bg-neutral-200 rounded w-16 animate-pulse"></div>
    </div>
  );

  const ChartSkeleton = () => {
    // Alturas fijas para evitar parpadeos
    const barHeights = [40, 60, 35, 80, 50, 70, 45];
    
    return (
      <div className="h-[120px] w-full bg-neutral-50 rounded-lg flex items-end justify-between p-4 border">
        {barHeights.map((height, i) => (
          <div 
            key={i} 
            className="bg-neutral-200 rounded-sm"
            style={{ 
              height: `${height}px`,
              width: '8px',
              animation: `pulse 2s infinite ${i * 0.1}s`
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Primera columna - Métricas principales */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 rounded-2xl border-0 bg-white p-8 shadow-none border">
            <>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-semibold tracking-tight text-neutral-800">¡Bienvenido{user?.user_metadata?.nombre ? `, ${user.user_metadata.nombre}` : ""}!</h1>
              </div>
              
              <div className="space-y-6">
                {/* Número total de recibos - dinámico */}
                <div className="flex items-center justify-between">
                  {loadingMetrics ? (
                    <NumberSkeleton />
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-neutral-500">Total de recibos</span>
                        <span className="text-2xl font-semibold text-neutral-800">
                          {metrics.totalReceipts.toLocaleString()}
                        </span>
                      </div>
                      
                      {/* Texto variable que cambia con hover */}
                      <div className="flex flex-col min-w-[120px]">
                        <span className="text-xs text-neutral-400">
                          {hoveredData ? `${hoveredData.date}` : 'Resumen del período'}
                        </span>
                        <span className="text-sm font-medium text-neutral-600">
                          {hoveredData ? `${hoveredData.count} recibos` : `${metrics.totalReceipts} total`}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Selector de período estilo pricing */}
                  <div 
                    ref={setContainerRef}
                    className="inline-flex bg-neutral-50 rounded-full p-1 relative border"
                  >
                    {/* Fondo deslizante */}
                    <div 
                      className="absolute h-[calc(100%-8px)] top-1 transition-all duration-300 ease-out rounded-full bg-white shadow-sm border border-neutral-200/50"
                      style={{
                        width: buttonWidths[chartPeriod] ? `${buttonWidths[chartPeriod]}px` : 'calc(33.33% - 4px)',
                        left: (() => {
                          if (!buttonWidths.weekly || !buttonWidths.monthly || !buttonWidths.quarterly) {
                            return chartPeriod === 'weekly' ? '4px' : 
                                   chartPeriod === 'monthly' ? 'calc(33.33% + 4px)' : 
                                   'calc(66.66% + 4px)';
                          }
                          
                          let offset = 4; // padding inicial
                          const periods = ['weekly', 'monthly', 'quarterly'];
                          for (const period of periods) {
                            if (period === chartPeriod) break;
                            offset += buttonWidths[period] || 0;
                          }
                          return `${offset}px`;
                        })(),
                      }}
                    />
                    
                    <button
                      data-period-button="weekly"
                      onClick={() => setChartPeriod('weekly')}
                      className={`px-3 py-1 text-xs rounded-full transition-all duration-300 font-medium relative z-10 whitespace-nowrap ${
                        chartPeriod === 'weekly' 
                          ? "text-neutral-900 font-semibold transform scale-[1.02]" 
                          : "text-neutral-600 hover:text-neutral-800"
                      }`}
                    >
                      Semanal
                    </button>
                    <button
                      data-period-button="monthly"
                      onClick={() => setChartPeriod('monthly')}
                      className={`px-3 py-1 text-xs rounded-full transition-all duration-300 font-medium relative z-10 whitespace-nowrap ${
                        chartPeriod === 'monthly' 
                          ? "text-neutral-900 font-semibold transform scale-[1.02]" 
                          : "text-neutral-600 hover:text-neutral-800"
                      }`}
                    >
                      Mensual
                    </button>
                    <button
                      data-period-button="quarterly"
                      onClick={() => setChartPeriod('quarterly')}
                      className={`px-3 py-1 text-xs rounded-full transition-all duration-300 font-medium relative z-10 whitespace-nowrap ${
                        chartPeriod === 'quarterly' 
                          ? "text-neutral-900 font-semibold transform scale-[1.02]" 
                          : "text-neutral-600 hover:text-neutral-800"
                      }`}
                    >
                      Trimestral
                    </button>
                  </div>
                </div>

                {/* Gráfico de actividad - ancho completo */}
                <div className="w-full">
                  {loadingChart ? (
                    <ChartSkeleton />
                  ) : (
                    <div className="h-[120px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart 
                          data={dailyStats}
                          onMouseMove={(event: any) => {
                            console.log('Mouse move event:', event); // Debug log
                            if (event && event.activePayload && event.activePayload.length > 0) {
                              const payload = event.activePayload[0].payload;
                              const newHoveredData = {
                                date: payload.date,
                                count: payload.count
                              };
                              console.log('Setting hovered data:', newHoveredData); // Debug log
                              setHoveredData(newHoveredData);
                            }
                          }}
                          onMouseLeave={() => {
                            console.log('Mouse leave'); // Debug log
                            setHoveredData(null);
                          }}
                          style={{ outline: 'none' }}
                          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                        >
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid 
                            strokeDasharray="0" 
                            stroke="#f3f4f6" 
                            vertical={true} 
                            horizontal={false}
                          />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 12, fill: '#9ca3af' }}
                            axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                            tickLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                            height={25}
                          />
                          <YAxis hide />
                          <Tooltip 
                            content={() => null}
                            cursor={{ stroke: '#e5e7eb', strokeWidth: 1, strokeDasharray: '3 3' }}
                            active={true}
                          />
                          <Area
                            type="monotone"
                            dataKey="count"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fill="url(#colorCount)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </>
          </Card>

          {/* Componente de últimos recibos */}
          <RecentReceipts />
        </div>

        {/* Segunda columna - Información de la empresa y plan */}
        <div className="space-y-6">
          <Suspense fallback={<PlanStatusSkeleton />}>
            <PlanStatus />
          </Suspense>

          <Card className="p-6 rounded-2xl border bg-white shadow-none">
            {loadingCompany ? (
              <CompanyInfoSkeleton />
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-neutral-900">Empresa</h2>
                  </div>
                  
                  {companyConnected && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/dashboard/empresa")}
                      className="h-8 px-3"
                    >
                      <IconEdit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                  )}
                </div>

                {companyConnected ? (
                  <div className="space-y-4">
                    {/* Información principal de la empresa */}
                    <div className="rounded-lg border border-neutral-200 p-4 bg-white relative overflow-hidden">
                      {/* Puntos blur radial degradado */}
                      <div className="absolute inset-0 overflow-hidden">
                        <div 
                          className="absolute -top-4 -left-4 w-16 h-16 rounded-full opacity-30"
                          style={{
                            background: 'radial-gradient(circle, #10b981 0%, #34d399 50%, transparent 70%)',
                            filter: 'blur(20px)'
                          }}
                        />
                        <div 
                          className="absolute top-2 right-8 w-12 h-12 rounded-full opacity-25"
                          style={{
                            background: 'radial-gradient(circle, #3b82f6 0%, #60a5fa 50%, transparent 70%)',
                            filter: 'blur(15px)'
                          }}
                        />
                        <div 
                          className="absolute bottom-0 left-1/3 w-20 h-20 rounded-full opacity-20"
                          style={{
                            background: 'radial-gradient(circle, #8b5cf6 0%, #a78bfa 50%, transparent 70%)',
                            filter: 'blur(25px)'
                          }}
                        />
                        <div 
                          className="absolute -bottom-2 -right-2 w-14 h-14 rounded-full opacity-25"
                          style={{
                            background: 'radial-gradient(circle, #f59e0b 0%, #fbbf24 50%, transparent 70%)',
                            filter: 'blur(18px)'
                          }}
                        />
                      </div>
                      
                      <div className="flex items-start justify-between relative z-10">
                        <div className="flex-1">
                          <h3 className="font-semibold text-neutral-900 text-base mb-2">
                            {companyInfo?.nombre}
                          </h3>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-neutral-600 font-mono">
                              {showCif ? companyInfo?.cif : '••••••••••'}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowCif(!showCif)}
                              className="h-6 w-6 p-0 text-neutral-500 hover:text-neutral-700"
                            >
                              {showCif ? (
                                <IconEyeOff className="h-3 w-3" />
                              ) : (
                                <IconEye className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-emerald-100 border-emerald-200 text-emerald-800 text-xs">
                          Activa
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Detalles de contacto */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-neutral-50">
                        <IconLocationPin className="w-4 h-4 text-neutral-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-neutral-900 leading-relaxed">
                            {companyInfo?.direccion}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50">
                        <IconMail className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-neutral-900 truncate">
                            {companyInfo?.email}
                          </p>
                        </div>
                      </div>
                      
                      {companyInfo?.telefono && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50">
                          <IconPhone className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-neutral-900">
                              {companyInfo?.telefono}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center border bg-neutral-50 rounded-lg p-8">
                    <h3 className="text-base font-semibold text-neutral-900 mb-2">
                      Configura tu empresa
                    </h3>
                    <p className="text-sm text-neutral-600 mb-6 max-w-sm mx-auto leading-relaxed">
                      Añade los datos de tu empresa para generar facturas automáticamente con tus datos.
                    </p>
                    <Button 
                      size="sm"
                      variant="outline"
                      onClick={() => router.push("/dashboard/empresa")}
                      className="text-xs"
                    >
                      <IconUserPlus className="w-4 h-4 mr-2" />
                      Configurar empresa
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
} 