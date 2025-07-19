'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IconDownload, IconPhoto, IconFileText, IconEye } from '@tabler/icons-react';
import { formatCurrency } from '@/lib/utils';

interface ReportData {
  id: string;
  created_at: string;
  receipts: Array<{
    id: string;
    provider: string;
    total: number;
    date: string;
    numero_factura: string;
    tipo_factura: string;
    moneda: string;
    categoria: string;
    notas?: string;
  }>;
  total_amount: number;
  total_count: number;
  filters_applied: {
    month?: string;
    quarter?: string;
    provider?: string;
    dateRange?: { start?: string; end?: string };
  };
}

interface AccountingReport {
  id: string;
  report_data: ReportData;
  created_by: string;
  created_at: string;
  status: string;
  accessed_at?: string;
  notes?: string;
}

export default function ContablePage() {
  const params = useParams();
  const reportId = params.reportId as string;
  const [report, setReport] = useState<AccountingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    console.log('🚀 Component mounted with reportId:', reportId);
    console.log('🔧 Supabase client configured:', !!supabase);
    console.log('🔧 Environment check:', {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });
    
    if (reportId) {
      loadReport();
    } else {
      console.error('❌ No reportId provided');
      setError('ID de reporte no proporcionado');
      setLoading(false);
    }
  }, [reportId]);

  const loadReport = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading report with ID:', reportId);
      console.log('🔍 Report ID type:', typeof reportId);
      console.log('🔍 Report ID length:', reportId?.length);
      
      // Verificar si la tabla existe primero
      console.log('📡 Testing table existence...');
      const { data: testData, error: testError } = await supabase
        .from('accounting_reports')
        .select('count')
        .limit(1);
      
      console.log('📊 Table test result:', { testData, testError });
      
      // Cargar el reporte (sin autenticación para permitir acceso al contable)
      console.log('📡 Making Supabase query...');
      const { data, error } = await supabase
        .from('accounting_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      console.log('📊 Supabase response:', { data, error });

      if (error) {
        console.error('❌ Error loading report - Full error object:', error);
        console.error('❌ Error loading report - Stringified:', JSON.stringify(error, null, 2));
        console.error('❌ Error loading report - Properties:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        console.error('❌ Error loading report - All keys:', Object.keys(error));
        console.error('❌ Error loading report - Type:', typeof error);
        console.error('❌ Error loading report - Constructor:', error.constructor.name);
        setError(`Reporte no encontrado: ${error.message || 'Error desconocido'}`);
        return;
      }

      if (!data) {
        console.error('❌ No data returned from query');
        setError('No se encontró el reporte');
        return;
      }

      console.log('✅ Report loaded successfully:', data);
      setReport(data);

      // Marcar como visto
      console.log('👁️ Marking report as viewed...');
      const { error: updateError } = await supabase
        .from('accounting_reports')
        .update({ 
          status: 'viewed',
          accessed_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (updateError) {
        console.warn('⚠️ Error updating report status:', updateError);
      } else {
        console.log('✅ Report marked as viewed');
      }

    } catch (error) {
      console.error('💥 Unexpected error in loadReport:', error);
      setError(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    if (!report) return;

    const csvHeaders = [
      'ID',
      'Proveedor',
      'Número Factura',
      'Tipo Factura',
      'Fecha',
      'Total',
      'Moneda',
      'Categoría',
      'Notas'
    ];

    const csvData = report.report_data.receipts.map(receipt => [
      receipt.id,
      receipt.provider,
      receipt.numero_factura || '',
      receipt.tipo_factura || '',
      receipt.date,
      receipt.total.toString(),
      receipt.moneda,
      receipt.categoria,
      receipt.notas || ''
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `tickets_contable_${reportId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando reporte...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <IconFileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Reporte no encontrado</h2>
              <p className="text-gray-600">{error || 'El reporte solicitado no existe o ha expirado.'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { report_data } = report;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg border mb-6">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">📊 Reporte de Tickets - Contabilidad</h1>
                <p className="text-blue-100 mt-1">
                  Generado el {formatDate(report.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={report.status === 'viewed' ? 'default' : 'outline'} className="bg-white text-blue-600">
                  <IconEye className="h-3 w-3 mr-1" />
                  {report.status === 'viewed' ? 'Visto' : 'Pendiente'}
                </Badge>
                <Button onClick={handleDownloadCSV} variant="outline" size="sm" className="bg-white text-blue-600 hover:bg-blue-50">
                  <IconDownload className="h-4 w-4 mr-2" />
                  Descargar CSV
                </Button>
                <Button onClick={handlePrint} variant="outline" size="sm" className="bg-white text-blue-600 hover:bg-blue-50">
                  <IconPrinter className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <IconReceipt className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total de Tickets</p>
                      <p className="text-2xl font-bold text-gray-900">{report_data.total_count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <IconCurrencyEuro className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Monto Total</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(report_data.total_amount)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <IconCalendar className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Período</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {report_data.filters_applied.month || 
                         report_data.filters_applied.quarter || 
                         'Todos los períodos'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters Applied */}
            {Object.keys(report_data.filters_applied).some(key => report_data.filters_applied[key as keyof typeof report_data.filters_applied]) && (
              <Card className="mb-6 bg-gray-50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <IconFileText className="h-5 w-5 mr-2" />
                    Filtros Aplicados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {report_data.filters_applied.month && (
                      <Badge variant="outline" className="bg-blue-100 text-blue-800">
                        📅 Mes: {report_data.filters_applied.month}
                      </Badge>
                    )}
                    {report_data.filters_applied.quarter && (
                      <Badge variant="outline" className="bg-purple-100 text-purple-800">
                        📊 Trimestre: {report_data.filters_applied.quarter}
                      </Badge>
                    )}
                    {report_data.filters_applied.provider && (
                      <Badge variant="outline" className="bg-green-100 text-green-800">
                        🏢 Proveedor: {report_data.filters_applied.provider}
                      </Badge>
                    )}
                    {report_data.filters_applied.dateRange?.start && (
                      <Badge variant="outline" className="bg-orange-100 text-orange-800">
                        📅 Rango: {formatDate(report_data.filters_applied.dateRange.start)} - {formatDate(report_data.filters_applied.dateRange.end || '')}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Receipts Table */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gray-50">
            <CardTitle className="flex items-center">
              <IconReceipt className="h-5 w-5 mr-2" />
              Detalle de Tickets ({report_data.total_count} tickets)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100">
                    <TableHead className="font-semibold">🏢 Proveedor</TableHead>
                    <TableHead className="font-semibold">📄 Número</TableHead>
                    <TableHead className="font-semibold">📋 Tipo</TableHead>
                    <TableHead className="font-semibold">📅 Fecha</TableHead>
                    <TableHead className="font-semibold">🏷️ Categoría</TableHead>
                    <TableHead className="text-right font-semibold">💰 Total</TableHead>
                    <TableHead className="font-semibold">💱 Moneda</TableHead>
                    <TableHead className="font-semibold">📝 Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report_data.receipts.map((receipt, index) => (
                    <TableRow key={receipt.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <TableCell className="font-medium">{receipt.provider}</TableCell>
                      <TableCell>{receipt.numero_factura || '-'}</TableCell>
                      <TableCell>{receipt.tipo_factura || '-'}</TableCell>
                      <TableCell>{formatDate(receipt.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {receipt.categoria}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatCurrency(receipt.total)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{receipt.moneda}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={receipt.notas}>
                        {receipt.notas || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <CardContent className="py-4">
              <p className="text-sm">
                📊 Reporte generado automáticamente • ID: <code className="bg-white/20 px-2 py-1 rounded">{reportId}</code>
              </p>
              <p className="text-xs text-blue-100 mt-1">
                Sistema de Gestión de Tickets - Contabilidad
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
