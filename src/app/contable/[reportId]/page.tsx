'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { IconDownload, IconFileText, IconPhoto } from '@tabler/icons-react';

interface ReportData {
  id: string;
  created_at: string;
  viewed_at?: string;
  status: string;
  report_data: {
    tickets: Array<{
      id: string;
      date: string;
      provider: string;
      amount: number;
      tipo_factura: string;
      numero_factura: string;
      cuenta_contable: string;
      image_url?: string;
    }>;
    totalTickets: number;
    totalAmount: number;
  };
  filters_applied?: {
    month?: string;
    quarter?: string;
    provider?: string;
    dateRange?: {
      start: string;
      end: string;
    };
  };
}

export default function AccountantReportPage() {
  const params = useParams();
  const reportId = params.reportId as string;
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);


  const supabase = createClientComponentClient();

  // Function to normalize report data structure
  const normalizeReportData = (rawData: any) => {
    console.log(' Normalizing report data:', rawData);
    console.log('🔧 Normalizing report data:', rawData);
    
    // If report_data is missing or malformed, create a default structure
    if (!rawData.report_data || typeof rawData.report_data !== 'object') {
      console.log('⚠️ Report data is missing or malformed, creating default structure');
      return {
        ...rawData,
        report_data: {
          totalTickets: 0,
          totalAmount: 0,
          dateRange: 'N/A',
          tickets: []
        }
      };
    }

    const reportData = rawData.report_data;
    
    // Handle the actual structure from handleGenerateReport
    // It uses: receipts, total_count, total_amount
    // We need to convert to: tickets, totalTickets, totalAmount
    const normalized = {
      ...rawData,
      report_data: {
        totalTickets: reportData.total_count || reportData.totalTickets || 0,
        totalAmount: reportData.total_amount || reportData.totalAmount || 0,
        dateRange: reportData.dateRange || 'N/A',
        tickets: Array.isArray(reportData.receipts) 
          ? reportData.receipts.map((receipt: any) => ({
              id: receipt.id,
              date: receipt.date,
              provider: receipt.provider,
              amount: receipt.total || receipt.amount || 0,
              tipo_factura: receipt.tipo_factura,
              numero_factura: receipt.numero_factura,
              cuenta_contable: receipt.cuenta_contable,
              image_url: receipt.image_url
            }))
          : Array.isArray(reportData.tickets) 
            ? reportData.tickets 
            : []
      }
    };

    console.log('✅ Normalized report data:', normalized);
    return normalized;
  };

  const loadReport = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading report with ID:', reportId);
      console.log('🔍 Report ID type:', typeof reportId);
      console.log('🔍 Report ID length:', reportId?.length);
      console.log('🔧 Supabase client configured:', !!supabase);
      console.log('🔧 Environment check:', {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      });

      // Test query to check if table exists
      const { data: testData, error: testError } = await supabase
        .from('accounting_reports')
        .select('count')
        .limit(1);
      console.log('📊 Table test result:', { testData, testError });

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
        setError('Reporte no encontrado');
        return;
      }

      console.log('✅ Report loaded successfully:', data);
      console.log('📊 Report data structure:', {
        id: data.id,
        report_data: data.report_data,
        report_data_type: typeof data.report_data,
        report_data_keys: data.report_data ? Object.keys(data.report_data) : 'null',
        totalTickets: data.report_data?.totalTickets,
        totalAmount: data.report_data?.totalAmount,
        tickets: data.report_data?.tickets,
        tickets_length: data.report_data?.tickets?.length
      });
      
      const normalizedData = normalizeReportData(data);
      setReport(normalizedData);

      // Mark report as viewed
      try {
        const { error: updateError } = await supabase
          .from('accounting_reports')
          .update({ 
            status: 'viewed',
            accessed_at: new Date().toISOString()
          })
          .eq('id', reportId);

        if (updateError) {
          console.error('❌ Error updating report status:', updateError);
        } else {
          console.log('✅ Report marked as viewed');
        }
      } catch (updateError) {
        console.error('❌ Unexpected error updating report:', updateError);
      }

    } catch (error) {
      console.error('❌ Unexpected error in loadReport:', error);
      setError('Error inesperado al cargar el reporte');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🚀 Component mounted with reportId:', reportId);
    
    if (reportId) {
      loadReport();
    } else {
      console.error('❌ No reportId provided');
      setError('ID de reporte no proporcionado');
      setLoading(false);
    }
  }, [reportId]);

  const downloadCSV = () => {
    if (!report || !report.report_data?.tickets) return;

    const csvContent = [
      ['Fecha', 'Proveedor', 'Importe', 'Tipo', 'Categoría Contable'].join(','),
      ...report.report_data.tickets.map(ticket => [
        ticket.date || '',
        ticket.provider || '',
        (ticket.amount || 0).toFixed(2),
        ticket.tipo_factura || '',
        ticket.cuenta_contable || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_contable_${reportId}.csv`;
    link.click();
  };



  const handleImageView = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setIsImageDialogOpen(true);
  };

  const getReportPeriod = () => {
    if (!report?.filters_applied) return 'Período no especificado';
    
    const filters = report.filters_applied;
    
    if (filters.month) {
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      const [year, month] = filters.month.split('-');
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    }
    
    if (filters.quarter) {
      const [year, quarter] = filters.quarter.split('-Q');
      return `Q${quarter} ${year}`;
    }
    
    if (filters.dateRange?.start && filters.dateRange?.end) {
      const start = new Date(filters.dateRange.start).toLocaleDateString('es-ES');
      const end = new Date(filters.dateRange.end).toLocaleDateString('es-ES');
      return `${start} - ${end}`;
    }
    
    return 'Todos los períodos';
  };

  const handleDownload = async (ticketId: string, numeroFactura: string | null) => {
    try {
      const downloadUrl = `/api/pdf-download?receipt_id=${ticketId}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      const safeNumeroFactura = numeroFactura || 'sin_numero';
      link.download = `factura_${safeNumeroFactura.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-neutral-100">
        <main className="flex-1 p-6 overflow-auto">
          <div className="bg-white p-6 rounded-3xl flex flex-col animate-fade-in border">
            <div className="flex flex-col gap-6 p-8">
              {/* Header skeleton */}
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-24" />
                </div>
              </div>

              {/* Summary cards skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-20" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-20" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-16" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-24" />
                  </CardContent>
                </Card>
              </div>

              {/* Table skeleton */}
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Table header */}
                    <div className="flex gap-4 pb-2 border-b">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    {/* Table rows */}
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex gap-4 py-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen bg-neutral-100">
        <main className="flex-1 p-6 overflow-auto">
          <div className="bg-white p-6 rounded-3xl flex flex-col animate-fade-in border">
            <div className="flex flex-col gap-6 p-8">
              <div className="flex items-center justify-center py-12">
                <div className="text-red-500">{error}</div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex h-screen bg-neutral-100">
        <main className="flex-1 p-6 overflow-auto">
          <div className="bg-white p-6 rounded-3xl flex flex-col animate-fade-in border">
            <div className="flex flex-col gap-6 p-8">
              <div className="flex items-center justify-center py-12">
                <div className="text-neutral-500">Reporte no encontrado</div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-screen bg-neutral-100">
        <main className="flex-1 p-6 overflow-auto">
          <div className="bg-white p-6 rounded-3xl flex flex-col animate-fade-in border">
            <div className="flex flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-2xl font-bold text-neutral-900">Reporte Contable</h1>
                <p className="text-neutral-600 mt-1">
                  {report.report_data?.totalTickets || 0} tickets • {(report.report_data?.totalAmount || 0).toFixed(2)}€
                </p>
                <p className="text-sm text-blue-600 font-medium mt-1">
                  Período: {getReportPeriod()}
                </p>
              </div>
              <Button onClick={downloadCSV} className="bg-neutral-900 hover:bg-neutral-800">
                <IconDownload className="w-4 h-4 mr-2" />
                Descargar CSV
              </Button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-neutral-50 p-4 rounded-2xl">
                <div className="text-sm text-neutral-600">Total Tickets</div>
                <div className="text-2xl font-semibold text-neutral-800">
                  {report.report_data?.totalTickets || 0}
                </div>
              </div>
              <div className="bg-neutral-50 p-4 rounded-2xl">
                <div className="text-sm text-neutral-600">Importe Total</div>
                <div className="text-2xl font-semibold text-neutral-800">
                  {(report.report_data?.totalAmount || 0).toFixed(2)}€
                </div>
              </div>
              <div className="bg-neutral-50 p-4 rounded-2xl">
                <div className="text-sm text-neutral-600">Estado</div>
                <Badge variant={report.status === 'viewed' ? 'default' : 'outline'}>
                  {report.status === 'viewed' ? 'Visto' : 'Pendiente'}
                </Badge>
              </div>
            </div>

            {/* Tickets Table */}
            <div className="border rounded-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50">
                    <TableHead className="font-medium text-neutral-700">Fecha</TableHead>
                    <TableHead className="font-medium text-neutral-700">Proveedor</TableHead>
                    <TableHead className="font-medium text-neutral-700">Importe</TableHead>
                    <TableHead className="font-medium text-neutral-700">Tipo</TableHead>
                    <TableHead className="font-semibold text-neutral-900 bg-blue-50">Categoría Contable</TableHead>
                    <TableHead className="font-medium text-neutral-700">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(report.report_data?.tickets || []).map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="text-neutral-800">
                        {ticket.date ? new Date(ticket.date).toLocaleDateString('es-ES') : 'Sin fecha'}
                      </TableCell>
                      <TableCell className="text-neutral-800">
                        {ticket.provider || 'Sin proveedor'}
                      </TableCell>
                      <TableCell className="text-neutral-800 font-medium">
                        {(ticket.amount || 0).toFixed(2)}€
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        {ticket.tipo_factura || 'N/A'}
                      </TableCell>
                      <TableCell className="bg-blue-50">
                        <span className="font-semibold text-blue-900 px-2 py-1 bg-blue-100 rounded-md">
                          {ticket.cuenta_contable || '629 - Otros servicios'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(ticket.id, ticket.numero_factura)}
                          >
                            <IconFileText size={14} />
                          </Button>
                          {ticket.image_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleImageView(ticket.image_url!)}
                            >
                              <IconPhoto size={14} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </main>
    </div>

    {/* Image Dialog */}
    <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Imagen del Ticket</DialogTitle>
        </DialogHeader>
        {selectedImage && (
          <div className="flex justify-center">
            <img
              src={selectedImage || ''}
              alt="Ticket"
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
