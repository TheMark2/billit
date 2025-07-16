"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { IconPlug, IconCheck, IconX, IconSettings, IconRefresh } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

interface Integration {
  name: string;
  label: string;
  logo: string;
  connected: boolean;
  status: 'connected' | 'error' | 'not_configured';
  description: string;
}

// Skeleton para el widget
const IntegrationsWidgetSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-6 bg-neutral-200 rounded w-48" />
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50">
          <div className="w-8 h-8 bg-neutral-200 rounded" />
          <div className="flex-1 space-y-1">
            <div className="h-4 bg-neutral-200 rounded w-20" />
            <div className="h-3 bg-neutral-100 rounded w-32" />
          </div>
          <div className="w-12 h-5 bg-neutral-200 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);

export function IntegrationsWidget() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      
      if (!uid) {
        setLoading(false);
        return;
      }

      // Verificar estado de las integraciones
      const integrationChecks = await Promise.all([
        supabase.from('xero_credentials').select('id').eq('user_id', uid).single(),
        supabase.from('odoo_credentials').select('id').eq('user_id', uid).single(),
        supabase.from('holded_credentials').select('id').eq('user_id', uid).single(),
      ]);

      const integrationsData: Integration[] = [
        {
          name: 'xero',
          label: 'Xero',
          logo: '/logo_xero.webp',
          connected: !integrationChecks[0].error,
          status: !integrationChecks[0].error ? 'connected' : 'not_configured',
          description: 'Contabilidad y finanzas'
        },
        {
          name: 'odoo',
          label: 'Odoo',
          logo: '/logo_odoo.svg',
          connected: !integrationChecks[1].error,
          status: !integrationChecks[1].error ? 'connected' : 'not_configured',
          description: 'ERP empresarial'
        },
        {
          name: 'holded',
          label: 'Holded',
          logo: '/logo_holded.png',
          connected: !integrationChecks[2].error,
          status: !integrationChecks[2].error ? 'connected' : 'not_configured',
          description: 'Gestión empresarial'
        }
      ];

      setIntegrations(integrationsData);
    } catch (error) {
      console.error('Error loading integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntegrations();
  }, []);

  const connectedCount = integrations.filter(int => int.connected).length;

  if (loading) {
    return (
      <Card className="p-6 rounded-2xl border bg-white shadow-none">
        <IntegrationsWidgetSkeleton />
      </Card>
    );
  }

  return (
    <Card className="p-6 rounded-2xl border bg-white shadow-none">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-neutral-900">Integraciones</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={connectedCount > 0 ? "default" : "outline"} className="text-xs">
              {connectedCount} de {integrations.length} conectadas
            </Badge>
          </div>
        </div>

        {/* Lista de integraciones */}
        <div className="space-y-2">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 transition-colors"
            >
              <div className="w-8 h-8 flex items-center justify-center bg-white rounded border">
                <img 
                  src={integration.logo} 
                  alt={integration.label}
                  className="w-6 h-6 object-contain"
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-900">
                    {integration.label}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">{integration.description}</p>
              </div>

              <Badge 
                variant={integration.connected ? "success" : "outline"}
                className="text-xs"
              >
                {integration.connected ? "Conectado" : "Desconectado"}
              </Badge>
            </div>
          ))}
        </div>

        {/* Footer con botón de configurar */}
        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/integraciones')}
            className="w-full flex items-center gap-2"
          >
            <IconSettings className="w-4 h-4" />
            Gestionar integraciones
          </Button>
        </div>
      </div>
    </Card>
  );
} 