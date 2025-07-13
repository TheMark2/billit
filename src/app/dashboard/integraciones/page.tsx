"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { IconCheck, IconX, IconSettings, IconExternalLink, IconLoader2 } from '@tabler/icons-react';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';

interface Integration {
  id: string;
  name: string;
  description: string;
  logo: string;
  website: string;
  connected: boolean;
  category: 'accounting' | 'communication' | 'productivity';
  color: string;
}

type TabType = 'all' | 'connected' | 'disconnected';

const INTEGRATIONS: Integration[] = [
  {
    id: 'holded',
    name: 'Holded',
    description: 'Sincroniza automáticamente tus facturas con tu gestión empresarial',
    logo: '/logo_holded.png',
    website: 'https://www.holded.com',
    connected: false,
    category: 'accounting',
    color: 'bg-white border'
  },
  {
    id: 'odoo',
    name: 'Odoo',
    description: 'Conecta con tu ERP para sincronizar facturas y gestión empresarial',
    logo: '/logo_odoo.svg',
    website: 'https://www.odoo.com',
    connected: false,
    category: 'accounting',
    color: 'border bg-white'
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Sincroniza tus facturas con tu contabilidad usando OAuth 2.0',
    logo: '/logo_xero.webp',
    website: 'https://www.xero.com',
    connected: false,
    category: 'accounting',
    color: 'border bg-white'
  }
];

const CATEGORIES = {
  accounting: {
    title: 'Herramientas de Contabilidad y Gestión'
  },
  communication: {
    title: 'Comunicación y Colaboración'
  },
  productivity: {
    title: 'Productividad y Automatización'
  }
};

const tabs = [
  { key: 'all', label: 'Todas las aplicaciones' },
  { key: 'connected', label: 'Conectadas' },
  { key: 'disconnected', label: 'Desconectadas' }
] as const;

export default function IntegracionesPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(INTEGRATIONS);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Estados para los diálogos
  const [isHoldedDialogOpen, setIsHoldedDialogOpen] = useState(false);
  const [isXeroDialogOpen, setIsXeroDialogOpen] = useState(false);
  const [isOdooDialogOpen, setIsOdooDialogOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Estados para credenciales
  const [holdedCredentials, setHoldedCredentials] = useState({
    apiKey: '',
    testMode: false
  });
  const [odooCredentials, setOdooCredentials] = useState({
    url: '',
    database: '',
    username: '',
    password: ''
  });

  // Estados para el selector mejorado
  const [buttonWidths, setButtonWidths] = useState<Record<string, number>>({});
  const [buttonPositions, setButtonPositions] = useState<Record<string, number>>({});
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    checkConnections();
    
    // Manejar parámetros de URL del callback OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const successParam = urlParams.get('success');
    const errorParam = urlParams.get('error');
    
    if (successParam === 'xero_connected') {
      setSuccess('✅ Conexión con Xero establecida correctamente');
      window.history.replaceState({}, '', window.location.pathname);
      checkConnections();
    } else if (errorParam) {
      setError(`Error al conectar: ${errorParam}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Medir anchos y posiciones de los botones para el selector
  useEffect(() => {
    if (!containerRef) return;
    
    // Usar requestAnimationFrame para asegurar que los elementos estén renderizados
    const measureButtons = () => {
      const buttons = containerRef.querySelectorAll('[data-tab-button]');
      const widths: Record<string, number> = {};
      const positions: Record<string, number> = {};
      const containerRect = containerRef.getBoundingClientRect();
      
      buttons.forEach((button) => {
        const key = button.getAttribute('data-tab-button');
        if (key) {
          // Medir el ancho y posición real del botón
          const rect = button.getBoundingClientRect();
          widths[key] = rect.width;
          positions[key] = rect.left - containerRect.left;
        }
      });
      
      // Solo actualizar si hay cambios significativos
      const hasWidthChanges = Object.keys(widths).some(key => 
        Math.abs((widths[key] || 0) - (buttonWidths[key] || 0)) > 1
      );
      
      const hasPositionChanges = Object.keys(positions).some(key => 
        Math.abs((positions[key] || 0) - (buttonPositions[key] || 0)) > 1
      );
      
      if (hasWidthChanges || hasPositionChanges || Object.keys(buttonWidths).length === 0) {
        setButtonWidths(widths);
        setButtonPositions(positions);
      }
    };

    // Medir inmediatamente después del renderizado
    requestAnimationFrame(measureButtons);
    
    // También medir después de un pequeño delay para asegurar que las fuentes están cargadas
    const timeout = setTimeout(measureButtons, 100);
    
    return () => clearTimeout(timeout);
  }, [containerRef, activeTab]); // Agregar activeTab para remedir cuando cambia el estado activo

  const checkConnections = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const [holdedData, xeroData, odooData] = await Promise.all([
        supabase
          .from('holded_credentials')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single(),
        supabase
          .from('xero_credentials')
          .select('id')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('odoo_credentials')
          .select('id')
          .eq('user_id', user.id)
          .single()
      ]);

      setIntegrations(prev => 
        prev.map(integration => ({
          ...integration,
          connected: 
            integration.id === 'holded' ? !!holdedData.data :
            integration.id === 'xero' ? !!xeroData.data :
            integration.id === 'odoo' ? !!odooData.data :
            false
        }))
      );
    } catch (error) {
      console.error('Error checking connections:', error);
    }
  };

  const handleToggle = async (integrationId: string, currentState: boolean) => {
    if (!currentState) {
      // Conectar
      if (integrationId === 'holded') {
        setIsHoldedDialogOpen(true);
      } else if (integrationId === 'xero') {
        handleXeroOAuth();
      } else if (integrationId === 'odoo') {
        setIsOdooDialogOpen(true);
      }
    } else {
      // Desconectar
      await handleDisconnect(integrationId);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    setLoading(prev => ({ ...prev, [integrationId]: true }));
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const tableName = `${integrationId}_credentials`;
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setIntegrations(prev => prev.map(int => 
        int.id === integrationId 
          ? { ...int, connected: false }
          : int
      ));
      
      setSuccess(`Desconectado de ${integrationId} correctamente`);
    } catch (error) {
      console.error('Error disconnecting:', error);
      setError(`Error al desconectar de ${integrationId}`);
    } finally {
      setLoading(prev => ({ ...prev, [integrationId]: false }));
    }
  };

  const handleXeroOAuth = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!user || !session) {
        throw new Error('No se pudo obtener la sesión del usuario');
      }

      const response = await fetch('/api/integrations/xero/auth-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          redirectUri: `${window.location.origin}/api/integrations/xero/callback`
        })
      });

      if (!response.ok) {
        throw new Error('Error al generar URL de autorización');
      }

      const { authUrl } = await response.json();
      window.location.href = authUrl;

    } catch (error) {
      console.error('Error connecting to Xero:', error);
      setError('Error al conectar con Xero');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleHoldedConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (!holdedCredentials.apiKey) {
        throw new Error('API Key es obligatorio');
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();

      if (!user || !session) {
        throw new Error('No se pudo obtener la sesión del usuario');
      }

      const saveResponse = await fetch('/api/integrations/holded/save-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          apiKey: holdedCredentials.apiKey,
          testMode: holdedCredentials.testMode,
        })
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.error || 'Error al guardar credenciales');
      }

      setIntegrations(prev => prev.map(int => 
        int.id === 'holded' 
          ? { ...int, connected: true }
          : int
      ));
      
      setSuccess('✅ Conexión con Holded establecida correctamente');
      setIsHoldedDialogOpen(false);
      setHoldedCredentials({ apiKey: '', testMode: false });

    } catch (error) {
      console.error('Error connecting to Holded:', error);
      setError(error instanceof Error ? error.message : 'Error de conexión');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleOdooConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (!odooCredentials.url || !odooCredentials.database || !odooCredentials.username || !odooCredentials.password) {
        throw new Error('Todos los campos son obligatorios');
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();

      if (!user || !session) {
        throw new Error('No se pudo obtener la sesión del usuario');
      }

      const response = await fetch('/api/integrations/odoo/save-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          ...odooCredentials
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar credenciales');
      }

      setIntegrations(prev => prev.map(int => 
        int.id === 'odoo' 
          ? { ...int, connected: true }
          : int
      ));
      
      setSuccess('✅ Conexión con Odoo establecida correctamente');
      setIsOdooDialogOpen(false);
      setOdooCredentials({ url: '', database: '', username: '', password: '' });

    } catch (error) {
      console.error('Error connecting to Odoo:', error);
      setError(error instanceof Error ? error.message : 'Error de conexión');
    } finally {
      setIsConnecting(false);
    }
  };

  // Filtrar integraciones
  const filteredIntegrations = integrations.filter(integration => {
    const matchesTab = activeTab === 'all' || 
                      (activeTab === 'connected' && integration.connected) ||
                      (activeTab === 'disconnected' && !integration.connected);
    
    return matchesTab;
  });

  // Agrupar por categoría
  const integrationsByCategory = filteredIntegrations.reduce((acc, integration) => {
    if (!acc[integration.category]) {
      acc[integration.category] = [];
    }
    acc[integration.category].push(integration);
    return acc;
  }, {} as Record<string, Integration[]>);

  return (
    <div className="bg-white p-6 rounded-3xl border">
      <div className="flex flex-col gap-6 p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-800">Integraciones</h1>
            <p className="text-neutral-600 mt-1">Conecta con las herramientas que ya utilizas</p>
          </div>
        </div>

        {/* Mensajes de estado */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-3">
              <IconX className="h-5 w-5 text-red-600" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-3">
              <IconCheck className="h-5 w-5 text-green-600" />
              <span className="text-sm text-green-700">{success}</span>
            </div>
          </div>
        )}

        {/* Selector de tabs estilo pricing */}
        <div className="flex justify-center">
          <div 
            ref={setContainerRef}
            className="inline-flex bg-neutral-50 rounded-full p-1 relative border"
          >
            {/* Fondo deslizante mejorado */}
            <div 
              className="absolute h-[calc(100%-8px)] top-1 transition-all duration-300 ease-out rounded-full bg-white shadow-sm border border-neutral-200/50"
              style={{
                width: buttonWidths[activeTab] ? `${buttonWidths[activeTab]}px` : 
                       activeTab === 'all' ? '150px' : 
                       activeTab === 'connected' ? '100px' : '120px',
                left: (() => {
                  // Si tenemos posiciones medidas, usarlas directamente
                  if (buttonPositions[activeTab] !== undefined) {
                    return `${buttonPositions[activeTab]}px`;
                  }
                  
                  // Fallback con cálculo aproximado
                  const padding = 4;
                  if (activeTab === 'all') return `${padding}px`;
                  if (activeTab === 'connected') return `${padding + 150}px`;
                  if (activeTab === 'disconnected') return `${padding + 150 + 100}px`;
                  
                  return `${padding}px`;
                })(),
              }}
            />
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                data-tab-button={key}
                onClick={() => setActiveTab(key)}
                className={`px-6 py-2 text-sm rounded-full transition-all duration-300 font-medium relative z-10 whitespace-nowrap ${
                  activeTab === key 
                    ? "text-neutral-900 font-semibold transform scale-[1.02]" 
                    : "text-neutral-600 hover:text-neutral-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-8">
          {Object.entries(integrationsByCategory).map(([categoryKey, categoryIntegrations]) => {
            const category = CATEGORIES[categoryKey as keyof typeof CATEGORIES];
            if (!category || categoryIntegrations.length === 0) return null;

            return (
              <div key={categoryKey} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">{category.title}</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryIntegrations.map(integration => (
                    <Card key={integration.id} className="p-6 transition-colors border rounded-2xl">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3 justify-between">
                          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", integration.color)}>
                            <img src={integration.logo} alt={integration.name} className="w-8 h-8 object-contain" />
                          </div>
                          <div>
                            <h3 className="font-medium text-neutral-900">{integration.name}</h3>
                            {integration.connected && (
                              <Badge variant="outline" className="mt-1 bg-green-50 border-green-200 text-green-700">
                                Conectado
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Toggle
                            checked={integration.connected}
                            onCheckedChange={() => handleToggle(integration.id, integration.connected)}
                            disabled={loading[integration.id]}
                          />
                        </div>
                      </div>

                      <p className="text-sm text-neutral-600 mb-4">
                        {integration.description}
                      </p>

                      <div className="flex items-center justify-between">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="text-neutral-600 hover:text-neutral-800"
                        >
                          <a href={integration.website} target="_blank" rel="noopener noreferrer" className="gap-1 flex items-center">
                            <IconExternalLink className="w-4 h-4 mr-1" />
                            Sitio web
                          </a>
                        </Button>

                        {integration.connected && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDisconnect(integration.id)}
                            disabled={loading[integration.id]}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {loading[integration.id] ? (
                              <IconLoader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Desconectar'
                            )}
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {filteredIntegrations.length === 0 && (
          <div className="text-center py-12">
            {/* Representación visual según el tab activo */}
            <div className="mx-auto mb-6">
              {activeTab === 'connected' && (
                <div className="relative w-32 h-32 mx-auto">
                  {/* Dispositivo móvil */}
                  <div className="w-16 h-24 bg-neutral-100 rounded-lg border-2 border-neutral-200 mx-auto relative">
                    <div className="w-12 h-2 bg-neutral-200 rounded-full mt-2 mx-auto"></div>
                    <div className="w-10 h-10 bg-neutral-300 rounded-lg mt-3 mx-auto"></div>
                    <div className="w-8 h-1 bg-neutral-200 rounded mt-2 mx-auto"></div>
                    <div className="w-6 h-1 bg-neutral-200 rounded mt-1 mx-auto"></div>
                  </div>
                  {/* Líneas de conexión */}
                  <div className="absolute top-1/2 left-4 w-6 h-0.5 bg-neutral-300 transform -translate-y-1/2"></div>
                  <div className="absolute top-1/2 right-4 w-6 h-0.5 bg-neutral-300 transform -translate-y-1/2"></div>
                  {/* Círculos de conexión */}
                  <div className="absolute top-1/2 left-1 w-3 h-3 bg-neutral-300 rounded-full transform -translate-y-1/2"></div>
                  <div className="absolute top-1/2 right-1 w-3 h-3 bg-neutral-300 rounded-full transform -translate-y-1/2"></div>
                  {/* Líneas punteadas */}
                  <div className="absolute top-1/2 left-1 w-3 h-3 border-2 border-dashed border-neutral-300 rounded-full transform -translate-y-1/2"></div>
                  <div className="absolute top-1/2 right-1 w-3 h-3 border-2 border-dashed border-neutral-300 rounded-full transform -translate-y-1/2"></div>
                </div>
              )}
              
              {activeTab === 'disconnected' && (
                <div className="relative w-32 h-32 mx-auto">
                  {/* Puzzle incompleto */}
                  <div className="relative w-28 h-28 mx-auto">
                    {/* Piezas de puzzle */}
                    <div className="absolute top-2 left-2 w-10 h-10 bg-neutral-200 rounded-lg"></div>
                    <div className="absolute top-2 right-2 w-10 h-10 bg-neutral-200 rounded-lg"></div>
                    <div className="absolute bottom-2 left-2 w-10 h-10 bg-neutral-200 rounded-lg"></div>
                    {/* Espacio vacío con líneas punteadas */}
                    <div className="absolute bottom-2 right-2 w-10 h-10 border-2 border-dashed border-neutral-300 rounded-lg bg-neutral-50"></div>
                    {/* Líneas de separación */}
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-neutral-300 transform -translate-y-1/2"></div>
                    <div className="absolute top-0 left-1/2 w-0.5 h-full bg-neutral-300 transform -translate-x-1/2"></div>
                  </div>
                  {/* Signo de más flotante */}
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 text-blue-600 text-xs font-bold">+</div>
                  </div>
                </div>
              )}
              
              {activeTab === 'all' && (
                <div className="relative w-32 h-32 mx-auto">
                  {/* Cuadrícula vacía */}
                  <div className="grid grid-cols-3 gap-2 w-24 h-24 mx-auto">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="w-6 h-6 bg-neutral-100 rounded border-2 border-dashed border-neutral-300"></div>
                    ))}
                  </div>
                  {/* Lupa */}
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-neutral-200 rounded-full flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-neutral-400 rounded-full"></div>
                    <div className="w-2 h-0.5 bg-neutral-400 rotate-45 ml-1"></div>
                  </div>
                </div>
              )}
            </div>
            
            <h3 className="text-lg font-medium text-neutral-900 mb-2">
              {activeTab === 'connected' && 'No hay integraciones conectadas'}
              {activeTab === 'disconnected' && 'Todas las integraciones están conectadas'}
              {activeTab === 'all' && 'No se encontraron integraciones'}
            </h3>
            <p className="text-sm text-neutral-500">
              {activeTab === 'connected' && 'Conecta con tus herramientas favoritas para sincronizar automáticamente tus datos.'}
              {activeTab === 'disconnected' && '¡Excelente! Todas tus integraciones están configuradas y funcionando.'}
              {activeTab === 'all' && 'Intenta ajustar los filtros para encontrar lo que buscas.'}
            </p>
          </div>
        )}
      </div>

      {/* Diálogos de configuración */}
      <Dialog open={isHoldedDialogOpen} onOpenChange={setIsHoldedDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar con Holded</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-neutral-700">API Key</label>
              <input
                type="password"
                placeholder="Tu API Key de Holded"
                value={holdedCredentials.apiKey}
                onChange={(e) => setHoldedCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                className="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Toggle
                checked={holdedCredentials.testMode}
                onCheckedChange={(checked) => setHoldedCredentials(prev => ({ ...prev, testMode: checked }))}
              />
              <label className="text-sm text-neutral-700">Modo de prueba</label>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsHoldedDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleHoldedConnect} disabled={isConnecting}>
                {isConnecting ? (
                  <>
                    <IconLoader2 className="w-4 h-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  'Conectar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isOdooDialogOpen} onOpenChange={setIsOdooDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar con Odoo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-neutral-700">URL del servidor</label>
              <input
                placeholder="https://tu-servidor.odoo.com"
                value={odooCredentials.url}
                onChange={(e) => setOdooCredentials(prev => ({ ...prev, url: e.target.value }))}
                className="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700">Base de datos</label>
              <input
                placeholder="nombre_de_base_datos"
                value={odooCredentials.database}
                onChange={(e) => setOdooCredentials(prev => ({ ...prev, database: e.target.value }))}
                className="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700">Usuario</label>
              <input
                placeholder="admin"
                value={odooCredentials.username}
                onChange={(e) => setOdooCredentials(prev => ({ ...prev, username: e.target.value }))}
                className="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700">Contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                value={odooCredentials.password}
                onChange={(e) => setOdooCredentials(prev => ({ ...prev, password: e.target.value }))}
                className="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsOdooDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleOdooConnect} disabled={isConnecting}>
                {isConnecting ? (
                  <>
                    <IconLoader2 className="w-4 h-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  'Conectar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 