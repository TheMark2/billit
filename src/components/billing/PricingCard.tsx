"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IconCheck, IconX } from '@tabler/icons-react';
import { getStripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabaseClient';

interface PricingCardProps {
  name: string;
  price: number;
  priceId: string;
  period: 'monthly' | 'yearly';
  features: string[];
  popular?: boolean;
  currentPlan?: boolean;
}

export function PricingCard({ 
  name, 
  price, 
  priceId, 
  period, 
  features, 
  popular = false,
  currentPlan = false 
}: PricingCardProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    
    try {
      // Obtener usuario actual
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        alert('Debes iniciar sesión para continuar');
        return;
      }

      console.log('Iniciando proceso de pago para:', { priceId, userId: session.user.id });

      // Crear sesión de checkout
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          userId: session.user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error en la respuesta:', data);
        throw new Error(data.error || 'Error creando sesión');
      }

      console.log('Sesión de checkout creada:', data.sessionId);

      // Redirigir a Stripe Checkout
      const stripe = await getStripe();
      if (stripe) {
        const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
        if (error) {
          console.error('Error redirecting to checkout:', error);
          throw error;
        }
      } else {
        throw new Error('No se pudo cargar Stripe');
      }
    } catch (error) {
      console.error('Error al procesar pago:', error);
      alert(`Error al procesar el pago: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error creando sesión del portal');
      }

      // Redirigir al portal de Stripe
      window.location.href = data.url;
    } catch (error) {
      console.error('Error al abrir portal:', error);
      alert('Error al abrir el portal. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={`relative p-6 ${popular ? 'border-2 border-blue-500 shadow-lg' : ''}`}>
      {popular && (
        <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white">
          Más Popular
        </Badge>
      )}
      
      <div className="text-center space-y-4">
        <h3 className="text-2xl font-bold">{name}</h3>
        
        <div className="space-y-1">
          <div className="text-4xl font-bold">
            €{price}
            <span className="text-lg font-normal text-neutral-600">
              /{period === 'monthly' ? 'mes' : 'año'}
            </span>
          </div>
          {period === 'yearly' && (
            <p className="text-sm text-green-600">
              Ahorra 20% pagando anualmente
            </p>
          )}
        </div>

        <div className="space-y-3">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2">
              <IconCheck className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>

        <div className="pt-4">
          {currentPlan ? (
            <div className="space-y-2">
              <Button variant="outline" className="w-full" disabled>
                Plan Actual
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleManageSubscription}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Cargando...' : 'Gestionar Suscripción'}
              </Button>
            </div>
          ) : (
            <Button 
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full"
              variant={popular ? "default" : "outline"}
            >
              {loading ? 'Procesando...' : 'Elegir Plan'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
} 