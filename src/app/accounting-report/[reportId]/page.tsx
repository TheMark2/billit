'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IconDownload, IconPrinter, IconCalendar, IconCurrencyEuro, IconReceipt } from '@tabler/icons-react';

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

export default function AccountingReportPage() {
  const params = useParams();
  const reportId = params.reportId as string;
  const [report, setReport] = useState<AccountingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (reportId) {
      loadReport();
    }
  }, [reportId]);

  const loadReport = async () => {
    try {
      setLoading(true);
      
      // Cargar el reporte (sin autenticación para permitir acceso al contable)
      const { data, error } = await supabase
        .from('accounting_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) {
        console.error('Error loading report:', error);
        setError('Reporte no encontrado o error al cargar');
        return;
      }

      setReport(data);

      // Marcar como visto
      await supabase
        .from('accounting_reports')
        .update({ 
          status: 'viewed',
          accessed_at: new Date().toISOString()
        })
        .eq('id', reportId);

    } catch (error) {
      console.error('Error:', error);
      setError('Error al cargar el reporte');
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
    link.setAttribute('download', `reporte_contable_${reportId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando reporte...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <IconReceipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Reporte Contable</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Generado el {formatDate(report.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={report.status === 'viewed' ? 'default' : 'outline'}>
                  {report.status === 'viewed' ? 'Visto' : 'Pendiente'}
                </Badge>
                <Button onClick={handleDownloadCSV} variant="outline" size="sm">
                  <IconDownload className="h-4 w-4 mr-2" />
                  Descargar CSV
                </Button>
                <Button onClick={handlePrint} variant="outline" size="sm">
                  <IconPrinter className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <IconReceipt className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Tickets</p>
                      <p className="text-2xl font-bold text-gray-900">{report_data.total_count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <IconCurrencyEuro className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Monto Total</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(report_data.total_amount)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <IconCalendar className="h-8 w-8 text-purple-600" />
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
            {Object.keys(report_data.filters_applied).length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Filtros Aplicados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {report_data.filters_applied.month && (
                      <Badge variant="outline">Mes: {report_data.filters_applied.month}</Badge>
                    )}
                    {report_data.filters_applied.quarter && (
                      <Badge variant="outline">Trimestre: {report_data.filters_applied.quarter}</Badge>
                    )}
                    {report_data.filters_applied.provider && (
                      <Badge variant="outline">Proveedor: {report_data.filters_applied.provider}</Badge>
                    )}
                    {report_data.filters_applied.dateRange?.start && (
                      <Badge variant="outline">
                        Rango: {formatDate(report_data.filters_applied.dateRange.start)} - {formatDate(report_data.filters_applied.dateRange.end || '')}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Receipts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detalle de Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report_data.receipts.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell className="font-medium">{receipt.provider}</TableCell>
                      <TableCell>{receipt.numero_factura || '-'}</TableCell>
                      <TableCell>{receipt.tipo_factura || '-'}</TableCell>
                      <TableCell>{formatDate(receipt.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{receipt.categoria}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(receipt.total)}
                      </TableCell>
                      <TableCell>{receipt.moneda}</TableCell>
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
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Reporte generado automáticamente • ID: {reportId}</p>
        </div>
      </div>
    </div>
  );
}
