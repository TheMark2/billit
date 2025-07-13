"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Home() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setMessage("Por favor, introduce un email válido");
      setSuccess(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      // Simular envío de email - aquí iría la lógica real
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSuccess(true);
      setMessage("¡Gracias! Te contactaremos pronto.");
      setEmail("");
    } catch (error) {
      setSuccess(false);
      setMessage("Error al enviar. Por favor, inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white">
      <div className="relative isolate px-6 pt-14 lg:px-8">
        {/* Background gradient */}
        <div 
          className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" 
          aria-hidden="true"
        >
          <div 
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#10b981] to-[#3b82f6] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{
              clipPath: "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)"
            }}
          />
        </div>

        <div className="mx-auto max-w-4xl py-4 sm:py-8 lg:py-12">
          {/* Logo centrado */}
          <div className="flex justify-center mb-12">
            <div className="flex items-center gap-3">
              <img 
                src="/Logobillit1.svg" 
                alt="Billit Logo" 
                className="h-12 w-auto"
              />
            </div>
          </div>

          {/* Announcement badge */}
          <div className="hidden sm:mb-8 sm:flex sm:justify-center">
            <div className="relative rounded-full px-4 py-2 text-sm leading-6 text-gray-600 ring-1 ring-gray-900/10 hover:ring-gray-900/20 transition-all">
              <span className="inline-flex items-center gap-2">
                <span className="flex h-2 w-2">
                  <span className="absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Revolucionando la gestión de facturas empresariales
              </span>
            </div>
          </div>

          {/* Hero content */}
          <div className="text-center">
            <h1 className="text-5xl font-semibold tracking-tight text-balance text-gray-900 sm:text-7xl">
              Automatiza tus facturas con{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                inteligencia artificial
              </span>
            </h1>
            
            <div className="mt-8 space-y-4 text-lg font-medium text-gray-500 sm:text-xl/8 max-w-4xl mx-auto">
              <p className="text-pretty">
                <strong className="text-gray-700">Sube facturas por WhatsApp</strong> y extrae toda la información automáticamente. 
                Crea facturas digitales en segundos y mantén todo organizado desde la nube.
              </p>
              <p className="text-pretty">
                <strong className="text-gray-700">Integra con tus SaaS de contabilidad</strong> y gestión empresarial favoritos. 
                Conecta con Holded, Sage, ContaPlus y más sistemas de gestión.
              </p>
            </div>

            {/* Email signup form */}
            <div className="mt-12 max-w-lg mx-auto">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@empresa.com"
                      required
                      disabled={loading}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="default"
                    disabled={loading || !email || !email.includes('@')}
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Enviando...
                      </>
                    ) : (
                      "Solicitar acceso"
                    )}
                  </Button>
                </div>

                {message && (
                  <div className={`p-4 rounded-lg text-sm ${
                    success 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {message}
                  </div>
                )}
              </form>

              <p className="mt-4 text-sm text-gray-500">
                Te contactaremos para configurar tu acceso personalizado
              </p>
            </div>

            {/* Features grid */}
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="text-center p-6 bg-white/50 backdrop-blur-sm rounded-2xl border border-gray-100">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 mb-4">
                  <span className="text-2xl">📱</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">WhatsApp Integration</h3>
                <p className="text-gray-600">Envía facturas por WhatsApp y recibe los datos extraídos automáticamente</p>
              </div>

              <div className="text-center p-6 bg-white/50 backdrop-blur-sm rounded-2xl border border-gray-100">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 mb-4">
                  <span className="text-2xl">⚡</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Extracción Instantánea</h3>
                <p className="text-gray-600">IA avanzada que extrae fecha, proveedor, importe y conceptos en segundos</p>
              </div>

              <div className="text-center p-6 bg-white/50 backdrop-blur-sm rounded-2xl border border-gray-100">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 mb-4">
                  <span className="text-2xl">☁️</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Gestión en la Nube</h3>
                <p className="text-gray-600">Accede a tus facturas desde cualquier lugar, siempre organizadas y seguras</p>
              </div>

              <div className="text-center p-6 bg-white/50 backdrop-blur-sm rounded-2xl border border-gray-100">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 mb-4">
                  <span className="text-2xl">🔗</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Integraciones SaaS</h3>
                <p className="text-gray-600">Conecta con Holded, Sage, ContaPlus y otros sistemas de gestión empresarial</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom gradient */}
        <div 
          className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]" 
          aria-hidden="true"
        >
          <div 
            className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#10b981] to-[#3b82f6] opacity-20 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
            style={{
              clipPath: "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)"
            }}
          />
        </div>
      </div>
    </div>
  );
}
