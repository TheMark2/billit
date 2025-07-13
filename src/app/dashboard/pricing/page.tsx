"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckoutSuccess } from "@/components/billing/CheckoutSuccess";
// import { DowngradeSuccessDialog } from "@/components/ui/dialog";
import { PricingSkeleton } from "@/components/ui/skeleton";
import { supabase } from '@/lib/supabaseClient';
import { initiateCheckout, openCustomerPortal } from '@/lib/checkout';
import { STRIPE_PRICES } from '@/lib/stripe';
import { IconBrandTelegram, IconInfoSquareRounded } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";

const billingCycles = [
  { key: "monthly", label: "Mensual" },
  { key: "yearly", label: "Anual" },
] as const;

type Cycle = typeof billingCycles[number]["key"];

const plans = [
  {
    key: "basic",
    name: "Básico",
    description: "Plan gratuito con 5 recibos mensuales incluidos. Perfecto para empezar.",
    prices: { monthly: 0, yearly: 0 },
    features: {
      users: "1 miembro",
      receipts: "5 recibos / mes",
      sync: "Sincronización básica",
      support: "Soporte por email",
    },
    popular: false,
  },
  {
    key: "pro",
    name: "Pro",
    description: "Plan profesional con 100 recibos mensuales. Ideal para pequeñas y medianas empresas.",
    prices: { monthly: 19.99, yearly: 19.99 * 12 - 2 * 19.99 /* 2 meses gratis */ },
    features: {
      users: "5 miembros",
      receipts: "100 recibos / mes",
      sync: "Sync con Holded / Xero",
      support: "Soporte prioritario",
    },
    popular: true,
  },
  {
    key: "unlimited",
    name: "Unlimited",
    description: "Plan sin límites con 2000 recibos mensuales. Para empresas que necesitan máxima capacidad.",
    prices: { monthly: 49.99, yearly: 49.99 * 12 - 2 * 49.99 },
    features: {
      users: "Miembros ilimitados",
      receipts: "2000 recibos / mes",
      sync: "Sync con cualquier ERP",
      support: "Soporte premium 24/7",
    },
    popular: false,
  },
  {
    key: "enterprise",
    name: "Empresarial",
    description: "Solución personalizada para empresas con grandes volúmenes de documentos.",
    prices: { monthly: 0, yearly: 0 }, // Precio personalizado
    features: {
      users: "Usuarios ilimitados",
      receipts: "Recibos ilimitados",
      sync: "Integración dedicada",
      support: "Soporte premium 24/7",
    },
    popular: false,
    isEnterprise: true,
  },
] as const;

const featureKeys = [
  { key: "users", label: "Usuarios" },
  { key: "receipts", label: "Recibos" },
  { key: "sync", label: "Sincronización" },
  { key: "support", label: "Soporte" },
] as const;

// Mapeo de planes a price IDs de Stripe
const PLAN_TO_PRICE: Record<string, { monthly: string; yearly: string }> = {
  pro: {
    monthly: STRIPE_PRICES.pro.monthly,
    yearly: STRIPE_PRICES.pro.yearly,
  },
  unlimited: {
    monthly: STRIPE_PRICES.unlimited.monthly,
    yearly: STRIPE_PRICES.unlimited.yearly,
  },
};

export default function PricingPage() {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [currentCycle, setCurrentCycle] = useState<Cycle | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  
  // Estados para el selector de ciclo mejorado
  const [buttonWidths, setButtonWidths] = useState<Record<string, number>>({});
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  
  // Estados para alertas (simplificado)
  const [alert, setAlert] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);



  const formatPrice = (value: number) => `${value.toLocaleString("es-ES", { minimumFractionDigits: 0 })}€`;

  const getButtonText = (planKey: string, currentPlan: string | null, currentUserCycle: Cycle | null, loading: string | null, planLoading: boolean, isUpgradePrice: boolean, selectedCycle: Cycle) => {
    if (planLoading) return 'Verificando...';
    if (loading === planKey) return 'Cargando...';
    if (loading === 'portal') return 'Abriendo...';
    
    // Para plan actual, considerar tanto el plan como el ciclo de facturación
    const isCurrentPlanAndCycle = planKey === currentPlan && selectedCycle === currentUserCycle;
    
    if (isCurrentPlanAndCycle) {
      return planKey === 'basic' ? 'Plan Actual' : 'Plan Actual';
    }
    
    // Si es el mismo plan pero diferente ciclo
    if (planKey === currentPlan && selectedCycle !== currentUserCycle) {
      return selectedCycle === 'monthly' ? 'Cambiar a Mensual' : 'Cambiar a Anual';
    }
    
    // Determinar jerarquía de planes
    const planOrder = { 'basic': 0, 'pro': 1, 'unlimited': 2 };
    const currentOrder = planOrder[currentPlan as keyof typeof planOrder] || 0;
    const targetOrder = planOrder[planKey as keyof typeof planOrder] || 0;
    
    if (targetOrder > currentOrder) {
      // Upgrade
      return isUpgradePrice ? 'Hacer Upgrade (30€)' : 'Elegir Plan';
    } else if (targetOrder < currentOrder) {
      // Downgrade
      const planNames = { 'basic': 'Básico', 'pro': 'Pro', 'unlimited': 'Unlimited' };
      return `Bajar a ${planNames[planKey as keyof typeof planNames]}`;
    } else {
      return 'Elegir Plan';
    }
  };

  const shouldShowManageButton = (planKey: string, currentPlan: string | null, currentUserCycle: Cycle | null, selectedCycle: Cycle) => {
    // Solo mostrar si es el plan actual Y el ciclo actual
    const isCurrentPlanAndCycle = planKey === currentPlan && selectedCycle === currentUserCycle;
    return isCurrentPlanAndCycle && planKey !== 'basic';
  };

  // Componente skeleton para botones
  const ButtonSkeleton = () => (
    <div className="space-y-2">
      <div className="h-10 bg-neutral-200 rounded-md animate-pulse w-full"></div>
      <div className="h-8 bg-neutral-100 rounded-md animate-pulse w-full"></div>
    </div>
  );

  // Componente para la tarjeta empresarial
  const EnterpriseCard = ({ plan }: { plan: any }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email || loading) return;

      setLoading(true);
      // Simular envío
      setTimeout(() => {
        setSubmitted(true);
        setLoading(false);
        setEmail('');
      }, 1000);
    };

    return (
      <div className="relative bg-neutral-800 rounded-2xl p-8 flex flex-col gap-6 border border-neutral-200 w-full">
        <div className="flex flex-col md:flex-row gap-8 h-full">
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-semibold text-lg text-white mb-1">{plan.name}</h3>
              <p className="text-sm text-neutral-300 min-h-[40px]">{plan.description}</p>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">XXX€/mes</span>
            </div>
          </div>

          <div className="md:w-[350px] flex flex-col justify-center">
            {submitted ? (
              <div className="bg-neutral-700 border border-neutral-600 rounded-xl p-4 text-center">
                <div className="text-neutral-300">
                  <IconBrandTelegram className="w-5 h-5 mx-auto mb-2" />
                  <span className="font-medium">¡Enviado!</span>
                </div>
                <p className="text-sm text-neutral-300 mt-1">
                  Te contactaremos pronto
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button 
                  type="submit"
                  disabled={!email || loading}
                  variant="outline"
                  className="w-full border-neutral-200 text-white"
                >
                  {loading ? 'Enviando...' : 'Contactar Ventas'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Medir anchos de los botones para el selector
  useEffect(() => {
    if (!containerRef) return;
    
    const buttons = containerRef.querySelectorAll('[data-cycle-button]');
    const widths: Record<string, number> = {};
    
    buttons.forEach((button) => {
      const key = button.getAttribute('data-cycle-button');
      if (key) {
        widths[key] = button.getBoundingClientRect().width;
      }
    });
    
    setButtonWidths(widths);
  }, [containerRef]);

  // Obtener plan actual del usuario
  useEffect(() => {
    const fetchCurrentPlan = async () => {
      try {
        setPlanLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          console.log('🔍 No user session, defaulting to basic plan');
          setCurrentPlan('basic');
          setCurrentCycle('monthly');
          return;
        }

        console.log('🔍 Fetching current plan for user:', session.user.id);

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select(`
            plan_id, 
            is_subscribed,
            subscription_status,
            stripe_customer_id,
            stripe_subscription_id,
            billing_period
          `)
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          console.error('❌ Error fetching profile:', profileError);
          setCurrentPlan('basic');
          setCurrentCycle('monthly');
          return;
        }

        console.log('📊 Profile data:', profile);

        // Obtener plan actual
        if (profile?.plan_id) {
          const { data: plan, error: planError } = await supabase
            .from('plans')
            .select('nombre')
            .eq('id', profile.plan_id)
            .single();

          if (planError) {
            console.error('❌ Error fetching plan:', planError);
            setCurrentPlan('basic');
            setCurrentCycle('monthly');
            return;
          }

          console.log('📋 Plan data:', plan);

          if (plan) {
            // Mapear nombres de BD a keys del frontend
            const planNameMap: Record<string, string> = {
              'Básico': 'basic',
              'Pro': 'pro', 
              'Pro Mensual': 'pro',
              'Pro Anual': 'pro',
              'Unlimited': 'unlimited',
              'Unlimited Mensual': 'unlimited',
              'Unlimited Anual': 'unlimited'
            };
            const mappedPlan = planNameMap[plan.nombre] || 'basic';
            console.log('✅ Current plan detected:', mappedPlan, 'from DB plan:', plan.nombre);
            setCurrentPlan(mappedPlan);
            
            // También establecer el ciclo actual basado en billing_period
            const currentBillingCycle = profile.billing_period === 'yearly' ? 'yearly' : 'monthly';
            setCurrentCycle(currentBillingCycle);
            console.log('💰 Current billing cycle:', currentBillingCycle);
          } else {
            console.log('⚠️ No plan found, defaulting to basic');
            setCurrentPlan('basic');
            setCurrentCycle('monthly');
          }
        } else {
          console.log('⚠️ No plan_id in profile, defaulting to basic');
          setCurrentPlan('basic');
          setCurrentCycle('monthly');
        }

      } catch (error) {
        console.error('❌ Error al obtener plan actual:', error);
        setCurrentPlan('basic');
        setCurrentCycle('monthly');
      } finally {
        setPlanLoading(false);
      }
    };

    fetchCurrentPlan();

    // Refetch only when returning from Stripe checkout
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      console.log('🎉 Returned from successful checkout, refetching plan...');
      
      // Single refetch after 2 seconds to allow webhook processing
      setTimeout(() => {
        console.log('🔄 Refetch after successful checkout');
        fetchCurrentPlan();
      }, 2000);

      // Clean up URL after 3 seconds
      setTimeout(() => {
        window.history.replaceState({}, '', window.location.pathname);
      }, 3000);
    }

    // Escuchar cambios en profiles para refrescar el plan actual (solo eventos de actualización)
    const channel = supabase
      .channel('pricing-page-updates')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles' 
        }, 
        (payload) => {
          console.log('🔄 Profile updated via real-time:', payload);
          // Refrescar plan después de cambios en la base de datos
          fetchCurrentPlan();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handlePlanSelection = async (planKey: string) => {
    // Si es el plan actual y el ciclo actual (no hacer nada)
    if (planKey === currentPlan && cycle === currentCycle) {
      if (planKey === 'basic') return; // No hacer nada si ya estás en básico
      
      // Si es el plan actual de pago y el ciclo actual, abrir portal de gestión
      setLoading('portal');
      try {
        await openCustomerPortal();
      } catch (error) {
        console.error('Error abriendo portal:', error);
      } finally {
        setLoading(null);
      }
      return;
    }

    // Downgrade al plan básico (cancelar suscripción)
    if (planKey === 'basic') {
      setLoading('portal');
      try {
        await openCustomerPortal();
      } catch (error) {
        console.error('Error abriendo portal:', error);
      } finally {
        setLoading(null);
      }
      return;
    }

    // Todos los cambios de plan ahora se manejan directamente con Stripe
    // El ciclo (monthly/yearly) se obtiene del estado actual del toggle
    const priceId = PLAN_TO_PRICE[planKey]?.[cycle];
    
    console.log('🚀 Plan selection:', { planKey, cycle, priceId });
    
    if (!priceId) {
      console.error('❌ No price ID found for:', { planKey, cycle });
      setAlert({
        type: 'error',
        message: 'Error: No se encontró el precio para este plan.'
      });
      return;
    }

    setLoading(planKey);
    try {
      await initiateCheckout(priceId);
    } catch (error) {
      console.error('Error en checkout:', error);
      setAlert({
        type: 'error',
        message: 'Error al procesar el pago. Inténtalo de nuevo.'
      });
    } finally {
      setLoading(null);
    }
  };



  // Mostrar skeleton mientras carga
  if (planLoading) {
    return <PricingSkeleton />;
  }

  return (
    <div className="bg-white p-6 rounded-3xl animate-fade-in border">
    <div className="flex flex-col gap-6 p-8 min-h-[calc(100vh-theme(spacing.6)*4)]">

      <CheckoutSuccess />

      <h1 className="text-2xl font-semibold tracking-tight text-center">Planes & Suscripciones</h1>

      {/* Alerta de estado */}
      {alert && (
        <div className={`border rounded-lg p-4 max-w-2xl mx-auto ${
          alert.type === 'error' ? 'bg-red-50 border-red-200' :
          alert.type === 'warning' ? 'bg-amber-50 border-amber-200' :
          'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-start space-x-3">
            <div className={`mt-0.5 ${
              alert.type === 'error' ? 'text-red-600' :
              alert.type === 'warning' ? 'text-amber-600' :
              'text-green-600'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d={alert.type === 'error' ? "M6 18L18 6M6 6l12 12" : 
                     alert.type === 'warning' ? "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" :
                     "M5 13l4 4L19 7"} />
              </svg>
            </div>
            <div className="flex-1">
              <p className={`text-sm ${
                alert.type === 'error' ? 'text-red-700' :
                alert.type === 'warning' ? 'text-amber-700' :
                'text-green-700'
              }`}>
                {alert.message}
              </p>
              <button
                onClick={() => setAlert(null)}
                className={`mt-2 text-sm underline ${
                  alert.type === 'error' ? 'text-red-600 hover:text-red-800' :
                  alert.type === 'warning' ? 'text-amber-600 hover:text-amber-800' :
                  'text-green-600 hover:text-green-800'
                }`}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selector de ciclo */}
      <div className="flex justify-center">
        <div 
          ref={setContainerRef}
          className="inline-flex bg-neutral-50 rounded-full p-1 relative border"
        >
          {/* Fondo deslizante mejorado */}
          <div 
            className="absolute h-[calc(100%-8px)] top-1 transition-all duration-300 ease-out rounded-full bg-white shadow-sm border border-neutral-200/50"
            style={{
              width: buttonWidths[cycle] ? `${buttonWidths[cycle]}px` : 'calc(50% - 4px)',
              left: (() => {
                if (!buttonWidths.monthly || !buttonWidths.yearly) return cycle === 'monthly' ? '4px' : 'calc(50% + 4px)';
                
                let offset = 4; // padding inicial
                for (const cycleOption of billingCycles) {
                  if (cycleOption.key === cycle) break;
                  offset += buttonWidths[cycleOption.key] || 0;
                }
                return `${offset}px`;
              })(),
            }}
          />
          {billingCycles.map(({ key, label }) => (
            <button
              key={key}
              data-cycle-button={key}
              onClick={() => setCycle(key)}
              className={`px-6 py-2 text-sm rounded-full transition-all duration-300 font-medium relative z-10 whitespace-nowrap ${
                cycle === key 
                  ? "text-neutral-900 font-semibold transform scale-[1.02]" 
                  : "text-neutral-600 hover:text-neutral-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tarjetas de planes principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {plans.filter(plan => plan.key !== 'enterprise').map((plan) => {
          let price = cycle === "monthly" ? plan.prices.monthly : plan.prices.yearly;
          let isUpgradePrice = false;
          
          // Precio especial para upgrade de Pro a Unlimited
          if (plan.key === 'unlimited' && currentPlan === 'pro' && cycle === 'monthly') {
            price = 30; // 30€ primer mes
            isUpgradePrice = true;
          }

          return (
            <div
              key={plan.key}
              className={`relative bg-white rounded-2xl p-6 flex flex-col gap-6 ${
                plan.popular 
                  ? "p-[2px] bg-[linear-gradient(90deg,#c4bc00,#d29d00,#ff6251,#b92d5d,#7b219f)]" 
                  : "border border-neutral-200"
              }`}
            >
              <div className={`${plan.popular ? "bg-white rounded-2xl p-6" : ""} flex flex-col gap-6 h-full`}>
                {plan.popular && (
                  <Badge variant="default" className="absolute -top-3 right-4">
                    Más popular
                  </Badge>
                )}

                <div>
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <p className="text-sm text-neutral-500 min-h-[40px]">{plan.description}</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{formatPrice(price)}</span>
                  <span className="text-sm text-neutral-500">/ {cycle === "monthly" ? "mes" : "año"}</span>
                </div>
                
                {isUpgradePrice && (
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-2 mt-2 w-fit">
                    <p className="text-xs flex items-center gap-2">
                      <IconInfoSquareRounded className="w-4 h-4" />
                      30€ el primer mes, luego {formatPrice(plan.prices.monthly)} normales
                    </p>
                  </div>
                )}

                <ul className="space-y-1 text-sm flex-1">
                  {featureKeys.map((fk) => (
                    <li key={fk.key} className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      {plan.features[fk.key]}
                    </li>
                  ))}
                </ul>

                {/* Botones con skeleton loader */}
                {planLoading ? (
                  <ButtonSkeleton />
                ) : (
                  <div className="space-y-2">
                    <Button 
                      variant={plan.key === currentPlan ? "default" : plan.popular ? "default" : "secondary"}
                      onClick={() => handlePlanSelection(plan.key)}
                      disabled={!!loading}
                      className="w-full relative"
                    >
                      {getButtonText(plan.key, currentPlan, currentCycle, loading, planLoading, isUpgradePrice, cycle)}
                      {plan.key === currentPlan && cycle === currentCycle && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
                      )}
                    </Button>
                    
                    {/* Botón "Gestionar Plan" para planes activos de pago */}
                    {shouldShowManageButton(plan.key, currentPlan, currentCycle, cycle) && (
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setLoading('portal');
                          openCustomerPortal().catch(error => {
                            console.error('Error abriendo portal:', error);
                          }).finally(() => {
                            setLoading(null);
                          });
                        }}
                        disabled={!!loading}
                        className="w-full"
                        size="sm"
                      >
                        {loading === 'portal' ? 'Abriendo...' : 'Gestionar Plan'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tarjeta empresarial debajo */}
      <div className="flex justify-center">
        <div className="w-full">
          <EnterpriseCard plan={plans.find(p => p.key === 'enterprise')!} />
        </div>
      </div>



    </div>

    </div>
  );
} 