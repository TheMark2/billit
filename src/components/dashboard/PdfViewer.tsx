'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { IconEye } from '@tabler/icons-react';
import { supabase } from '@/lib/supabaseClient';
import { IconFileInfo, IconFileInvoice } from '@tabler/icons-react';

interface PdfViewerProps {
  receiptId: string;
  receiptInfo: {
    proveedor: string;
    total: number;
    fecha_emision: string;
    numero_factura: string;
  };
}

// Skeleton para el PDF
const PdfSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-6 bg-neutral-200 rounded w-48" />
    <div className="h-4 bg-neutral-100 rounded w-64" />
    <div className="w-full h-96 bg-neutral-100 rounded-lg flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 bg-neutral-200 rounded-full mx-auto" />
        <div className="h-4 bg-neutral-200 rounded w-32 mx-auto" />
      </div>
    </div>
  </div>
);

export default function PdfViewer({ receiptId, receiptInfo }: PdfViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<any>(null);

  const fetchPdf = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Obtener el token de autenticación del usuario
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No se pudo obtener el token de autenticación');
      }

      const response = await fetch(`/api/pdf-factura?receipt_id=${receiptId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al obtener el PDF');
      }

      const data = await response.json();
      setPdfData(data.data);
      setPdfUrl(data.data.pdf_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  const regeneratePdf = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Obtener el token de autenticación del usuario
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No se pudo obtener el token de autenticación');
      }

      const response = await fetch('/api/pdf-factura', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receipt_id: receiptId,
          regenerate: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al regenerar el PDF');
      }

      const data = await response.json();
      setPdfData(data.data);
      setPdfUrl(data.data.pdf_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPdf = () => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `factura_${receiptInfo.numero_factura}.pdf`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
          onClick={fetchPdf}
          disabled={isLoading}
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
              <IconEye className="w-4 h-4" />
            )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PDF de Factura</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Card className="border-red-200 bg-red-50 p-6">
              <div className="flex items-center space-x-2 text-red-700">
                <FileText className="w-5 h-5" />
                <span className="font-medium">Error: {error}</span>
              </div>
              <p className="text-sm text-red-600 mt-2">
                Intenta regenerar el PDF o contacta con soporte si el problema persiste.
              </p>
            </Card>
          )}

          {/* Mostrar skeleton mientras carga */}
          {isLoading && !pdfData && (
            <PdfSkeleton />
          )}

          {pdfData && (
            <Card className="p-6">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">Factura de {receiptInfo.proveedor}</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={regeneratePdf}
                      disabled={isLoading}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Regenerar
                    </Button>
                    <Button
                      size="sm"
                      onClick={downloadPdf}
                      disabled={!pdfUrl}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Descargar
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 bg-neutral-100 p-2 rounded-lg w-fit flex items-center gap-2">
                    <IconFileInfo className="w-4 h-4" />
                  {receiptInfo.proveedor} - {receiptInfo.fecha_emision}
                </p>
              </div>
              
              <div>
                {isLoading ? (
                  <PdfSkeleton />
                ) : pdfUrl ? (
                  <div className="w-full h-120 border rounded-lg overflow-hidden">
                    <iframe
                      src={pdfUrl}
                      className="w-full h-full"
                      title="PDF de Factura"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Cargando PDF...</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 