"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  IconUpload, 
  IconFile, 
  IconTrash, 
  IconCheck, 
  IconX, 
  IconLoader2,
  IconFileInvoice,
  IconPhotoFilled,
  IconFileTypePdf,
  IconRobot,
  IconFileSmileFilled,
  IconFileHorizontalFilled,
  IconBellPause
} from '@tabler/icons-react';
import { supabase } from '@/lib/supabaseClient';

interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
  message?: string; // Mensaje descriptivo del estado actual
}

const ACCEPTED_FILE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf']
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const UPLOAD_API_URL = '/api/upload-receipt';

export default function SubirFacturasPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Generar preview para imágenes
  const generatePreview = useCallback((file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(file);
      } else {
        resolve(undefined);
      }
    });
  }, []);

  // Validar archivo
  const validateFile = (file: File): string | null => {
    if (!Object.keys(ACCEPTED_FILE_TYPES).includes(file.type)) {
      return 'Tipo de archivo no válido. Solo se permiten imágenes (JPG, PNG, WebP) y PDFs.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'El archivo es demasiado grande. Tamaño máximo: 10MB.';
    }
    return null;
  };

  // Agregar archivos
  const addFiles = useCallback(async (newFiles: FileList) => {
    const fileArray = Array.from(newFiles);
    const validFiles: UploadedFile[] = [];

    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        console.error(`Error con archivo ${file.name}: ${error}`);
        continue;
      }

      const preview = await generatePreview(file);
      validFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview,
        status: 'pending'
      });
    }

    setFiles(prev => [...prev, ...validFiles]);
  }, [generatePreview]);

  // Manejar drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      addFiles(files);
    }
  }, [addFiles]);

  // Manejar drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  // Manejar drag leave
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  // Manejar selección de archivos
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      addFiles(files);
    }
    e.target.value = '';
  }, [addFiles]);

  // Eliminar archivo
  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // Subir archivo individual con progreso real
  const uploadFile = async (uploadedFile: UploadedFile): Promise<boolean> => {
    try {
      // Obtener el token de autenticación del usuario
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No se pudo obtener el token de autenticación');
      }

      // Actualizar estado a uploading
      setFiles(prev => prev.map(f => 
        f.id === uploadedFile.id 
          ? { ...f, status: 'uploading', progress: 0, message: 'Iniciando procesamiento...' }
          : f
      ));

      // Crear FormData para enviar el archivo
      const formData = new FormData();
      formData.append('file', uploadedFile.file);

      console.log('Enviando archivo con progreso streaming:', uploadedFile.file.name);

      // Enviar archivo con streaming
      const response = await fetch(UPLOAD_API_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${session.access_token}`,
        }
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      // Procesar el stream de respuesta
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  
                  // Actualizar progreso y mensaje
                  setFiles(prev => prev.map(f => 
                    f.id === uploadedFile.id 
                      ? { 
                          ...f, 
                          progress: data.progress || 0,
                          message: data.message || 'Procesando...',
                          error: data.stage === 'error' ? data.message : undefined
                        }
                      : f
                  ));

                  // Manejar diferentes etapas
                  if (data.stage === 'completed') {
                    setFiles(prev => prev.map(f => 
                      f.id === uploadedFile.id 
                        ? { ...f, status: 'success', progress: 100, message: 'Completado' }
                        : f
                    ));
                    return true;
                  } else if (data.stage === 'error') {
                    setFiles(prev => prev.map(f => 
                      f.id === uploadedFile.id 
                        ? { 
                            ...f, 
                            status: 'error', 
                            error: data.message || 'Error desconocido',
                            progress: 0,
                            message: 'Error'
                          }
                        : f
                    ));
                    throw new Error(data.message || 'Error desconocido');
                  }
                } catch (parseError) {
                  console.error('Error parsing SSE data:', parseError);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      return true;

    } catch (error) {
      console.error('Error detallado uploading file:', error);
      
      let errorMessage = 'Error desconocido';
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Error de conexión - Verifica tu conexión a internet';
      } else if (error instanceof Error) {
        if (error.message.includes('CORS')) {
          errorMessage = 'Error de CORS - Problema de configuración del servidor';
        } else if (error.message.includes('404')) {
          errorMessage = 'Endpoint no encontrado - Verifica la configuración';
        } else if (error.message.includes('401')) {
          errorMessage = 'Error de autenticación - Inicia sesión nuevamente';
        } else if (error.message.includes('Tiempo de espera')) {
          errorMessage = 'Tiempo de espera agotado - El archivo es muy grande o el servidor está ocupado';
        } else {
          errorMessage = error.message;
        }
      }
      
      // Actualizar estado a error
      setFiles(prev => prev.map(f => 
        f.id === uploadedFile.id 
          ? { 
              ...f, 
              status: 'error', 
              error: errorMessage,
              progress: 0,
              message: 'Error'
            }
          : f
      ));

      return false;
    }
  };

  // Procesar todos los archivos
  const processAllFiles = async () => {
    setIsProcessing(true);
    
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    for (const file of pendingFiles) {
      await uploadFile(file);
    }
    
    setIsProcessing(false);
  };

  // Limpiar archivos completados
  const clearCompletedFiles = () => {
    setFiles(prev => prev.filter(f => f.status !== 'success'));
  };

  // Obtener icono según el tipo de archivo
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <IconPhotoFilled className="w-8 h-8 text-blue-500" />;
    } else if (file.type === 'application/pdf') {
      return <IconFileHorizontalFilled className="w-8 h-8 text-neutral-600" />;
    }
    return <IconFile className="w-8 h-8 text-gray-500" />;
  };

  // Obtener color del badge según el estado
  const getStatusBadge = (status: UploadedFile['status']) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            Pendiente
          </Badge>
        );
      case 'uploading':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
            <IconRobot className="w-3 h-3" />
            Procesando
          </Badge>
        );
      case 'success':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
            <IconCheck className="w-3 h-3" />
            Completado
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <IconX className="w-3 h-3" />
            Error
          </Badge>
        );
      default:
        return null;
    }
  };

  // Función para obtener badge de estadísticas
  const getCountBadge = (label: string, count: number, type: 'total' | 'pending' | 'completed' | 'error') => {
    const baseClasses = "gap-1 font-medium";
    
    switch (type) {
      case 'total':
        return (
          <Badge variant="outline" className={`${baseClasses} bg-neutral-50 text-neutral-700 border-neutral-200`}>
            <IconFileInvoice className="w-3 h-3" />
            {label}: {count}
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className={`${baseClasses} bg-amber-50 text-amber-700 border-amber-200`}>
            <IconBellPause className="w-3 h-3" />
            {label}: {count}
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className={`${baseClasses} bg-green-50 text-green-700 border-green-200`}>
            <IconCheck className="w-3 h-3" />
            {label}: {count}
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className={`${baseClasses}`}>
            <IconX className="w-3 h-3" />
            {label}: {count}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className={baseClasses}>
            {label}: {count}
          </Badge>
        );
    }
  };

  const pendingFilesCount = files.filter(f => f.status === 'pending').length;
  const completedFilesCount = files.filter(f => f.status === 'success').length;

  return (
    <div className="bg-white p-6 rounded-3xl border animate-fade-in">
      <div className="flex flex-col gap-6 p-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-800 mb-2">
              Subir Facturas
            </h1>
            <p className="text-sm text-neutral-600">
              Arrastra y suelta tus facturas para procesarlas automáticamente con IA.
            </p>
          </div>
          
          {files.length > 0 && (
            <div className="flex gap-2">
              {completedFilesCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearCompletedFiles}
                  className="text-xs"
                >
                  <IconTrash className="w-4 h-4 mr-1" />
                  Limpiar
                </Button>
              )}
              
              {pendingFilesCount > 0 && (
                <Button
                  onClick={processAllFiles}
                  disabled={isProcessing}
                  size="sm"
                  className="text-xs"
                >
                  {isProcessing ? (
                    <IconLoader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <IconUpload className="w-4 h-4 mr-1" />
                  )}
                  {isProcessing ? 'Procesando...' : `Procesar ${pendingFilesCount}`}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Zona de drop */}
        <Card 
          className={`border-2 border-dashed transition-all duration-200 ${
            isDragOver 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-neutral-300 hover:border-neutral-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <IconPhotoFilled className={`w-12 h-12 ${isDragOver ? 'text-blue-600' : 'text-neutral-500'}`} />
              
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-neutral-800">
                  {isDragOver ? 'Suelta aquí tus archivos' : 'Arrastra y suelta tus facturas'}
                </h3>
              </div>
              
              <div className="text-xs text-neutral-400 space-y-1 flex flex-col items-center">
                <p>JPG, PNG, WebP, PDF • Máx. 10MB</p>
                <p className="flex items-center justify-center gap-1 border rounded-full px-2 py-1 mt-2 w-fit">
                  <IconRobot className="w-3 h-3" />
                  Haz click para seleccionar o arrastra y suelta tus facturas
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Lista de archivos */}
        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-lg font-medium text-neutral-800">
                Archivos subidos
              </h3>
              {getCountBadge("Total", files.length, 'total')}
              {pendingFilesCount > 0 && getCountBadge("Pendientes", pendingFilesCount, 'pending')}
              {completedFilesCount > 0 && getCountBadge("Completados", completedFilesCount, 'completed')}
              {files.filter(f => f.status === 'error').length > 0 && 
                getCountBadge("Errores", files.filter(f => f.status === 'error').length, 'error')
              }
            </div>
            <div className="border p-1 rounded-2xl">
            <div className="space-y-1">
              {files.map((uploadedFile) => (
                <Card key={uploadedFile.id} className="p-4 rounded-xl">
                  <div className="flex items-center gap-4">
                    
                    {/* Preview o icono */}
                    <div className="flex-shrink-0">
                      {uploadedFile.preview ? (
                        <IconFileSmileFilled className="w-8 h-8 text-neutral-600" />
                      ) : (
                        <div className="">
                          {getFileIcon(uploadedFile.file)}
                        </div>
                      )}
                    </div>

                    {/* Info del archivo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-neutral-800 truncate">
                          {uploadedFile.file.name}
                        </p>
                        {getStatusBadge(uploadedFile.status)}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-neutral-500">
                        <span>
                          {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>

                      {/* Barra de progreso con mensaje */}
                      {uploadedFile.status === 'uploading' && uploadedFile.progress !== undefined && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-600">
                              {uploadedFile.message || 'Procesando...'}
                            </span>
                            <span className="text-neutral-500">
                              {uploadedFile.progress}%
                            </span>
                          </div>
                          <div className="w-full bg-neutral-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${uploadedFile.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Error message */}
                      {uploadedFile.status === 'error' && uploadedFile.error && (
                        <p className="text-xs text-red-600 mt-1">
                          {uploadedFile.error}
                        </p>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-2">
                      {uploadedFile.status === 'success' && (
                        <div className="text-green-600">
                          <IconCheck className="w-5 h-5" />
                        </div>
                      )}
                      
                      {uploadedFile.status === 'error' && (
                        <div className="text-red-600">
                          <IconX className="w-5 h-5" />
                        </div>
                      )}
                      
                      {uploadedFile.status === 'uploading' && (
                        <div className="text-blue-600">
                          <IconLoader2 className="w-5 h-5 animate-spin" />
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadedFile.id)}
                        disabled={uploadedFile.status === 'uploading'}
                        className="h-8 w-8 p-0 text-neutral-500 hover:text-red-600"
                      >
                        <IconTrash className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        {/* Sección de badges de abajo eliminada */}
      </div>
    </div>
  );
} 