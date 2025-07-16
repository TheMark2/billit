"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
    <div className="bg-white min-h-screen font-plus-jakarta">
      {/* Banner promocional */}
      <div className="bg-emerald-500 py-2 text-white overflow-hidden relative">
        <div 
          className="flex whitespace-nowrap"
          style={{
            animation: 'marquee 20s linear infinite',
            willChange: 'transform',
          }}
        >
          <span className="mx-4">🎉 ¡1 mes gratis de prueba! Regístrate ahora y descubre todo el potencial de nuestra plataforma</span>
          <span className="mx-4">🎉 ¡1 mes gratis de prueba! Regístrate ahora y descubre todo el potencial de nuestra plataforma</span>
          <span className="mx-4">🎉 ¡1 mes gratis de prueba! Regístrate ahora y descubre todo el potencial de nuestra plataforma</span>
          <span className="mx-4">🎉 ¡1 mes gratis de prueba! Regístrate ahora y descubre todo el potencial de nuestra plataforma</span>
        </div>
        <style jsx>{`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-100%); }
          }
        `}</style>
      </div>

      <div className="relative isolate px-6 pt-14 lg:px-8 bg-neutral-50">
        <div className="mx-auto max-w-7xl py-4 sm:py-8 lg:py-12">
          {/* Contenido principal centrado */}
          <div className="text-center">
            {/* Título principal */}
            <h1 className="text-3xl tracking-[-1.215px] font-bold text-neutral-700 sm:text-6xl lg:text-6xl max-w-5xl mx-auto">
              Digitaliza y organiza tus tickets con{" "}
              <span className="relative">
                <span className="font-lora font-[400] italic tracking-[-1.215px] bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  inteligencia artificial.
                </span>
              </span>
            </h1>
            
            {/* Descripción */}
            <div className="mt-8 max-w-4xl mx-auto">
              <p className="text-lg text-neutral-600 font-normal">
                La solución más avanzada para digitalizar y gestionar tus tickets de compra. 
                Automatiza la extracción de datos, organiza tus gastos y mantén todo bajo control 
                con nuestro sistema inteligente basado en IA.
              </p>
            </div>

            {/* Botones de acción */}
            <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                variant="outline"
                className="px-8 py-3 font-medium"
                onClick={() => window.location.href = '/login'}
              >
                Iniciar Sesión
              </Button>
              <Button
                className="px-8 py-3 font-medium"
                onClick={() => window.location.href = '/login'}
              >
                Registrate aquí
              </Button>
            </div>
          </div>

          {/* Dashboard mockup con fondo degradado */}
          <div className="mt-16 flex justify-center">
            <div className="relative max-w-6xl p-8 rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 via-purple-400 to-amber-300 opacity-75"></div>
              <div className="absolute inset-0 bg-gradient-to-tr from-teal-400 via-fuchsia-300 to-orange-200 mix-blend-soft-light"></div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(49,230,180,0.7),transparent_50%)]"></div>
              <img 
                src="/Landingimg.png" 
                alt="Billit Dashboard" 
                className="w-full h-auto rounded-xl border relative z-0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4 Secciones de características */}
      <div className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 space-y-48">
          {/* Sección 1: Digitalización de Tickets */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 space-y-6">
              <Badge className="font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                Digitalización Inteligente
              </Badge>
              <h2 className="text-4xl font-bold text-neutral-800">
                Convierte tickets físicos en datos digitales
              </h2>
              <p className="text-lg text-neutral-600 font-normal">
                Fotografía cualquier ticket y nuestra IA extrae automáticamente todos los datos: 
                fecha, importe, comercio, productos y categorías. Elimina el papeleo y los errores 
                de transcripción manual. <strong>Ahorra hasta 80% del tiempo</strong> en gestión de gastos.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                <p className="text-sm text-blue-800 font-medium">
                  🎯 <strong>Beneficio clave:</strong> Reduce el tiempo de gestión de gastos de horas a minutos, 
                  mejorando la productividad y precisión de tu contabilidad.
                </p>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="relative pt-8 pl-8 rounded-2xl overflow-hidden bg-neutral-50">
                <div className="absolute w-[300px] h-[300px] rounded-full bg-emerald-400/30 blur-3xl -top-24 -right-24"></div>
                <div className="absolute w-[250px] h-[250px] rounded-full bg-purple-400/20 blur-3xl -bottom-20 -left-20"></div>
                <img 
                  src="/static1.png" 
                  alt="Digitalización de facturas" 
                  className="relative z-10 w-full h-auto"
                />
              </div>
            </div>
          </div>

          {/* Sección 2: WhatsApp */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="relative p-8 rounded-2xl overflow-hidden bg-neutral-50">
                <div className="absolute w-[300px] h-[300px] rounded-full bg-purple-400/30 blur-3xl -top-24 -left-24"></div>
                <div className="absolute w-[250px] h-[250px] rounded-full bg-blue-400/20 blur-3xl -bottom-20 -right-20"></div>
                <img 
                  src="/mockup-whatsapp.png" 
                  alt="Digitalización por WhatsApp" 
                  className="relative z-10 rounded-xl w-full h-auto"
                />
              </div>
            </div>
            <div className="space-y-6">
              <Badge className="font-medium bg-purple-50 text-purple-700 hover:bg-purple-50">
                Digitalización Móvil
              </Badge>
              <h2 className="text-4xl font-bold text-neutral-800">
                Digitaliza tickets desde WhatsApp
              </h2>
              <p className="text-lg text-neutral-600 font-normal">
                Envía una foto de tu ticket por WhatsApp y recibe automáticamente los datos 
                digitalizados. Sin apps adicionales, sin complicaciones. 
                <strong>Cumple con la normativa fiscal española</strong> y mantén tus gastos organizados al instante.
              </p>
              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                <p className="text-sm text-green-800 font-medium">
                  📱 <strong>Ventaja única:</strong> Compatible con TicketBAI y normativa fiscal española. 
                  Genera documentos válidos para Hacienda automáticamente.
                </p>
              </div>
            </div>
          </div>

          {/* Sección 3: Organización Inteligente */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 space-y-6">
              <Badge className="font-medium bg-blue-50 text-blue-700 hover:bg-blue-50">
                Organización Automática
              </Badge>
              <h2 className="text-4xl font-bold text-neutral-800">
                Categorización y control de gastos automático
              </h2>
              <p className="text-lg text-neutral-600 font-normal">
                Nuestro sistema clasifica automáticamente tus tickets por categorías: 
                alimentación, transporte, material de oficina, etc. Detecta gastos duplicados, 
                identifica patrones de consumo y te ayuda a <strong>optimizar tu presupuesto</strong> 
                con reportes detallados.
              </p>
              <div className="bg-amber-50 p-4 rounded-lg border-l-4 border-amber-400">
                <p className="text-sm text-amber-800 font-medium">
                  📊 <strong>Control total:</strong> Visualiza tus gastos por categorías, períodos y establecimientos. 
                  Identifica oportunidades de ahorro y mantén tu presupuesto bajo control.
                </p>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="relative pl-8 pt-8 rounded-2xl overflow-hidden bg-neutral-50">
                <div className="absolute w-[300px] h-[300px] rounded-full bg-blue-400/30 blur-3xl -top-24 -right-24"></div>
                <div className="absolute w-[250px] h-[250px] rounded-full bg-cyan-400/20 blur-3xl -bottom-20 -left-20"></div>
                <img 
                  src="/static3.png" 
                  alt="Gestión automática" 
                  className="relative z-10 w-full h-auto"
                />
              </div>
            </div>
          </div>

          {/* Sección 4: Exportación y Compatibilidad */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="relative pr-8 pt-8 rounded-2xl overflow-hidden bg-neutral-50">
                <div className="absolute w-[300px] h-[300px] rounded-full bg-orange-400/30 blur-3xl -top-24 -left-24"></div>
                <div className="absolute w-[250px] h-[250px] rounded-full bg-amber-400/20 blur-3xl -bottom-20 -right-20"></div>
                <img 
                  src="/static4.png" 
                  alt="Exportación de datos" 
                  className="relative z-10 w-full h-auto"
                />
              </div>
            </div>
            <div className="space-y-6">
              <Badge className="font-medium bg-orange-50 text-orange-700 hover:bg-orange-50">
                Exportación Profesional
              </Badge>
              <h2 className="text-4xl font-bold text-neutral-800">
                Exporta a Excel, PDF y software contable
              </h2>
              <p className="text-lg text-neutral-600 font-normal">
                Exporta tus tickets digitalizados a Excel para análisis detallado, 
                genera PDFs organizados por períodos, o sincroniza directamente con 
                <strong> Holded, Xero y Odoo</strong>. Facilita tu declaración de impuestos 
                y simplifica la gestión contable.
              </p>
              <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-400">
                <p className="text-sm text-purple-800 font-medium">
                  💼 <strong>Para profesionales:</strong> Formatos compatibles con gestorías y asesores fiscales. 
                  Facilita la preparación de declaraciones y auditorías.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
