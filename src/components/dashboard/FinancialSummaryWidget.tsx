"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { IconTrendingUp, IconTrendingDown, IconMinus, IconCurrencyEuro } from '@tabler/icons-react';

interface FinancialData {
  period: string;
  total: number;
  count: number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
}

export function FinancialSummaryWidget() {
  const [currentMonth, setCurrentMonth] = useState<FinancialData | null>(null);
  const [currentQuarter, setCurrentQuarter] = useState<FinancialData | null>(null);
  const [currentYear, setCurrentYear] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [buttonWidths, setButtonWidths] = useState<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchFinancialData = useCallback(async () => {
    setLoading(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;

    if (!uid) {
      setLoading(false);
      return;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based (0 = enero)
    const currentQuarter = Math.ceil((currentMonth + 1) / 3);

    try {
      // Datos del mes actual
      const startOfMonth = new Date(currentYear, currentMonth, 1);
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
      
      const { data: monthData } = await supabase
        .from('receipts')
        .select('total, fecha_emision')
        .eq('user_id', uid)
        .is('deleted_at', null)
        .gte('fecha_emision', startOfMonth.toISOString().split('T')[0])
        .lte('fecha_emision', endOfMonth.toISOString().split('T')[0]);

      // Datos del mes anterior para comparación
      const startOfPrevMonth = new Date(currentYear, currentMonth - 1, 1);
      const endOfPrevMonth = new Date(currentYear, currentMonth, 0);
      
      const { data: prevMonthData } = await supabase
        .from('receipts')
        .select('total')
        .eq('user_id', uid)
        .is('deleted_at', null)
        .gte('fecha_emision', startOfPrevMonth.toISOString().split('T')[0])
        .lte('fecha_emision', endOfPrevMonth.toISOString().split('T')[0]);

      // Datos del trimestre actual
      const startOfQuarter = new Date(currentYear, (currentQuarter - 1) * 3, 1);
      const endOfQuarter = new Date(currentYear, currentQuarter * 3, 0);
      
      const { data: quarterData } = await supabase
        .from('receipts')
        .select('total')
        .eq('user_id', uid)
        .is('deleted_at', null)
        .gte('fecha_emision', startOfQuarter.toISOString().split('T')[0])
        .lte('fecha_emision', endOfQuarter.toISOString().split('T')[0]);

      // Datos del año actual
      const startOfYear = new Date(currentYear, 0, 1);
      const endOfYear = new Date(currentYear, 11, 31);
      
      const { data: yearData } = await supabase
        .from('receipts')
        .select('total')
        .eq('user_id', uid)
        .is('deleted_at', null)
        .gte('fecha_emision', startOfYear.toISOString().split('T')[0])
        .lte('fecha_emision', endOfYear.toISOString().split('T')[0]);

      // Calcular totales y cambios
      const monthTotal = monthData?.reduce((sum, receipt) => sum + receipt.total, 0) || 0;
      const prevMonthTotal = prevMonthData?.reduce((sum, receipt) => sum + receipt.total, 0) || 0;
      const monthChange = prevMonthTotal > 0 ? ((monthTotal - prevMonthTotal) / prevMonthTotal) * 100 : 0;

      const quarterTotal = quarterData?.reduce((sum, receipt) => sum + receipt.total, 0) || 0;
      const yearTotal = yearData?.reduce((sum, receipt) => sum + receipt.total, 0) || 0;

      setCurrentMonth({
        period: now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
        total: monthTotal,
        count: monthData?.length || 0,
        change: monthChange,
        changeType: monthChange > 0 ? 'increase' : monthChange < 0 ? 'decrease' : 'neutral'
      });

      // Nombres de trimestres en español
      const quarterNames = ['1er Trimestre', '2do Trimestre', '3er Trimestre', '4to Trimestre'];
      setCurrentQuarter({
        period: `${quarterNames[currentQuarter - 1]} ${currentYear}`,
        total: quarterTotal,
        count: quarterData?.length || 0
      });

      setCurrentYear({
        period: `Año ${currentYear}`,
        total: yearTotal,
        count: yearData?.length || 0
      });

    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFinancialData();
  }, [fetchFinancialData]);

  // Efecto para medir anchos de botones
  useEffect(() => {
    if (!containerRef.current) return;

    const measureButtonWidths = () => {
      const newWidths: Record<string, number> = {};
      const buttons = containerRef.current?.querySelectorAll('[data-period-button]');
      
      buttons?.forEach((button) => {
        const period = button.getAttribute('data-period-button');
        if (period) {
          newWidths[period] = button.getBoundingClientRect().width;
        }
      });
      
      setButtonWidths(newWidths);
    };

    // Medir inmediatamente
    measureButtonWidths();

    // Medir después de que se rendericen los botones
    const timeoutId = setTimeout(measureButtonWidths, 100);

    return () => clearTimeout(timeoutId);
  }, [selectedPeriod]);

  const getCurrentData = () => {
    switch (selectedPeriod) {
      case 'month': return currentMonth;
      case 'quarter': return currentQuarter;
      case 'year': return currentYear;
      default: return currentMonth;
    }
  };

  const currentData = getCurrentData();

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-base font-medium text-neutral-900 mb-3">Resumen Financiero</h3>
        
        {/* Selector de período estilo pricing */}
        <div 
          ref={containerRef}
          className="inline-flex bg-neutral-50 rounded-full p-1 relative border"
        >
          {/* Fondo deslizante */}
          <div 
            className="absolute h-[calc(100%-8px)] top-1 transition-all duration-300 ease-out rounded-full bg-white shadow-sm border border-neutral-200/50"
            style={{
              width: buttonWidths[selectedPeriod] ? `${buttonWidths[selectedPeriod]}px` : 'calc(33.33% - 4px)',
              left: (() => {
                if (!buttonWidths.month || !buttonWidths.quarter || !buttonWidths.year) {
                  return selectedPeriod === 'month' ? '4px' : 
                         selectedPeriod === 'quarter' ? 'calc(33.33% + 4px)' : 
                         'calc(66.66% + 4px)';
                }
                
                let offset = 4; // padding inicial
                const periods = ['month', 'quarter', 'year'];
                for (const period of periods) {
                  if (period === selectedPeriod) break;
                  offset += buttonWidths[period] || 0;
                }
                return `${offset}px`;
              })(),
            }}
          />
          
          <button
            data-period-button="month"
            onClick={() => setSelectedPeriod('month')}
            className={`px-3 py-1 text-xs rounded-full transition-all duration-300 font-medium relative z-10 whitespace-nowrap ${
              selectedPeriod === 'month' 
                ? "text-neutral-900 font-semibold transform scale-[1.02]" 
                : "text-neutral-600 hover:text-neutral-800"
            }`}
          >
            Mes
          </button>
          <button
            data-period-button="quarter"
            onClick={() => setSelectedPeriod('quarter')}
            className={`px-3 py-1 text-xs rounded-full transition-all duration-300 font-medium relative z-10 whitespace-nowrap ${
              selectedPeriod === 'quarter' 
                ? "text-neutral-900 font-semibold transform scale-[1.02]" 
                : "text-neutral-600 hover:text-neutral-800"
            }`}
          >
            Trimestre
          </button>
          <button
            data-period-button="year"
            onClick={() => setSelectedPeriod('year')}
            className={`px-3 py-1 text-xs rounded-full transition-all duration-300 font-medium relative z-10 whitespace-nowrap ${
              selectedPeriod === 'year' 
                ? "text-neutral-900 font-semibold transform scale-[1.02]" 
                : "text-neutral-600 hover:text-neutral-800"
            }`}
          >
            Año
          </button>
        </div>
      </div>

      {currentData && (
        <div className="space-y-3">
          {/* Total principal */}
          <div>
            <div className="text-2xl font-bold text-neutral-900">
              {formatCurrency(currentData.total)}
            </div>
            <div className="text-sm text-neutral-500">
              {currentData.count} ticket{currentData.count !== 1 ? 's' : ''} • {currentData.period}
            </div>
          </div>

          {/* Métricas adicionales */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
            {/* Promedio por ticket */}
            {currentData.count > 0 && (
              <div>
                <div className="text-xs text-neutral-500">Promedio</div>
                <div className="text-sm font-medium text-neutral-900">
                  {formatCurrency(currentData.total / currentData.count)}
                </div>
              </div>
            )}

            {/* Cambio respecto al período anterior (solo para mes) */}
            {selectedPeriod === 'month' && currentData.change !== undefined && (
              <div className="flex items-center gap-1">
                {currentData.changeType === 'increase' && (
                  <>
                    <IconTrendingUp className="h-3 w-3 text-green-600" />
                    <span className="text-xs font-medium text-green-600">
                      +{currentData.change.toFixed(1)}%
                    </span>
                  </>
                )}
                {currentData.changeType === 'decrease' && (
                  <>
                    <IconTrendingDown className="h-3 w-3 text-red-600" />
                    <span className="text-xs font-medium text-red-600">
                      {currentData.change.toFixed(1)}%
                    </span>
                  </>
                )}
                {currentData.changeType === 'neutral' && (
                  <>
                    <IconMinus className="h-3 w-3 text-neutral-400" />
                    <span className="text-xs font-medium text-neutral-400">
                      0%
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
