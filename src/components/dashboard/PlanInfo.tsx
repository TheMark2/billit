import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';
import { IconFileNeutral, IconArrowUpRight, IconSettings } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { openCustomerPortal } from '@/lib/checkout';

interface Plan {
  id: string;
  nombre: string;
  descripcion: string;
  limite_recibos: number;
  precio: number;
}

export function PlanInfo({ className = "" }: { className?: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const fetchPlan = async () => {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return setLoading(false);

      // Obtener el perfil del usuario con su plan_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan_id, is_subscribed')
        .eq('id', user.id)
        .single();

      if (profile?.plan_id) {
        setIsSubscribed(profile.is_subscribed || false);
        
        // Obtener la información del plan
        const { data: planData } = await supabase
          .from('plans')
          .select('*')
          .eq('id', profile.plan_id)
          .single();

        if (planData) {
          setPlan(planData);
        }
      }
      setLoading(false);
    };

    fetchPlan();

    // Escuchar cambios en tiempo real
    const channel = supabase
      .channel('plan-info-updates')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'profiles' 
        }, 
        () => {
          console.log('🔄 Perfil actualizado, refrescando información del plan...');
          fetchPlan();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return <div className="animate-pulse bg-neutral-100 h-20 rounded-lg" />;
  }

  if (!plan) {
    return (
      <div className={cn("border rounded-2xl p-6 bg-neutral-50", className)}>
        <h3 className="font-medium text-sm">Plan actual</h3>
        <p className="text-sm text-neutral-600 mt-1">Plan básico (gratuito)</p>
        <div className="mt-2">
          <Badge variant="default">50 recibos restantes</Badge>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border rounded-xl p-6 bg-neutral-50", className)}>
      <div className="flex items-center justify-between">
        <IconFileNeutral className="w-5 h-5 text-neutral-900" />
        <div className="mt-2 flex gap-2">
          <Badge variant="default" className="relative p-[1px] bg-[linear-gradient(90deg,#c4bc00,#d29d00,#ff6251,#b92d5d,#7b219f)]">
            <span className="block px-4 py-2 bg-neutral-100 rounded-full text-black">{plan.limite_recibos} recibos restantes</span>
          </Badge>
          <Badge variant="default" className="py-2 px-4">{plan.precio > 0 ? `${plan.precio}€/mes` : 'Gratis'}</Badge>
        </div>
      </div>
      <p className="text-sm text-neutral-900 font-medium mt-4">{plan.nombre}</p>
      <p className="text-xs text-neutral-500 mt-2">{plan.descripcion}</p>
              <div className="flex items-center justify-between mt-4">
          <p className="text-2xl font-bold text-neutral-900">{plan.precio} <span className="text-sm font-normal text-neutral-500">€/mes</span></p>
          {plan.nombre === "Ultimate" ? (
            isSubscribed && (
              <Button
                variant="outline"
                className="text-xs flex items-center gap-2"
                size="sm"
                onClick={async () => {
                  try {
                    await openCustomerPortal();
                  } catch (error) {
                    console.error('Error abriendo portal:', error);
                  }
                }}
              >
                Gestionar
                <IconSettings className="w-4 h-4" />
              </Button>
            )
          ) : (
            <Button
              variant="outline"
              className="text-xs flex items-center gap-2"
              size="sm"
              onClick={() => window.location.href = '/dashboard/pricing'}
            >
              Mejorar plan
              <IconArrowUpRight className="w-4 h-4" />
            </Button>
          )}
        </div>
    </div>
  );
} 