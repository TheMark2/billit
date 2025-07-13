"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconCheck, IconX } from '@tabler/icons-react';

export function CheckoutSuccess() {
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);
  const [type, setType] = useState<'success' | 'cancel' | null>(null);

  useEffect(() => {
    const success = searchParams?.get('success');
    const canceled = searchParams?.get('canceled');

    if (success === 'true') {
      setType('success');
      setShow(true);
    } else if (canceled === 'true') {
      setType('cancel');
      setShow(true);
    }

    // Auto ocultar después de 10 segundos
    if (success || canceled) {
      const timer = setTimeout(() => setShow(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  if (!show || !type) return null;

  return (
    <Card className={`p-4 mb-6 border-l-4 ${
      type === 'success' 
        ? 'border-l-green-500 bg-green-50' 
        : 'border-l-orange-500 bg-orange-50'
    }`}>
      <div className="flex items-center gap-3">
        {type === 'success' ? (
          <IconCheck className="w-5 h-5 text-green-600" />
        ) : (
          <IconX className="w-5 h-5 text-orange-600" />
        )}
        
        <div className="flex-1">
          <h4 className={`font-medium ${
            type === 'success' ? 'text-green-900' : 'text-orange-900'
          }`}>
            {type === 'success' 
              ? '¡Pago completado exitosamente!' 
              : 'Pago cancelado'
            }
          </h4>
          <p className={`text-sm ${
            type === 'success' ? 'text-green-700' : 'text-orange-700'
          }`}>
            {type === 'success'
              ? 'Tu suscripción se activará en unos minutos. Recibirás un email de confirmación.'
              : 'No se realizó ningún cargo. Puedes intentar de nuevo cuando quieras.'
            }
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShow(false)}
          className="text-neutral-500 hover:text-neutral-700"
        >
          ✕
        </Button>
      </div>
    </Card>
  );
} 