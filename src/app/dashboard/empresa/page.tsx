"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconBuildingCog, IconCheck, IconArrowLeft, IconDeviceFloppy, IconAlertCircle } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// Componente separador simple
const Separator: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("h-px w-full bg-neutral-200", className)} />
);

interface FormState {
  company: string;
  cif: string;
  address: string;
  billingEmail: string;
  phone: string;
}

type Mode = "create" | "edit";

export default function EmpresaPage() {
  const [form, setForm] = useState<FormState>({
    company: "",
    cif: "",
    address: "",
    billingEmail: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("create");
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      
      console.log("Cargando datos del usuario:", uid);
      
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", uid)
        .single();
        
      if (profileError) {
        console.error("Error al cargar perfil:", profileError);
        return;
      }

      const empId = profile?.empresa_id as string | null;
      if (empId) {
        console.log("Empresa ID encontrada:", empId);
        setEmpresaId(empId);
        
        const { data: emp, error: empError } = await supabase
          .from("empresas")
          .select("nombre_fiscal, cif, direccion, email_facturacion, telefono")
          .eq("id", empId)
          .single();
          
        if (empError) {
          console.error("Error al cargar empresa:", empError);
          return;
        }

        if (emp) {
          console.log("Datos de empresa cargados:", emp);
          setForm({
            company: emp.nombre_fiscal || "",
            cif: emp.cif || "",
            address: emp.direccion || "",
            billingEmail: emp.email_facturacion || "",
            phone: emp.telefono || "",
          });
          setMode("edit");
        }
        }
      } catch (error) {
        console.error("Error al cargar:", error);
        setError("Error al cargar los datos de la empresa");
      } finally {
        setInitialLoading(false);
      }
    }
    load();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError(null);
    if (saveSuccess) setSaveSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      
      if (!uid) {
        throw new Error("No se encontró sesión de usuario");
      }

      console.log("Modo actual:", mode);
      console.log("Empresa ID:", empresaId);
      console.log("Datos del formulario:", form);

      if (mode === "edit" && empresaId) {
        console.log("Actualizando empresa existente");
        const { data: updateData, error: updateError } = await supabase
          .from("empresas")
          .update({
            nombre_fiscal: form.company,
            cif: form.cif,
            direccion: form.address,
            email_facturacion: form.billingEmail,
            telefono: form.phone,
          })
          .eq("id", empresaId)
          .select();

        if (updateError) {
          throw new Error(`Error al actualizar empresa: ${updateError.message}`);
        }
        
        console.log("Empresa actualizada:", updateData);
      } else {
        console.log("Creando nueva empresa");
        // Primero creamos la empresa
        const { data: newEmp, error: insertError } = await supabase
          .from("empresas")
          .insert({
            nombre_fiscal: form.company,
            cif: form.cif,
            direccion: form.address,
            email_facturacion: form.billingEmail,
            telefono: form.phone,
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(`Error al crear empresa: ${insertError.message}`);
        }

        if (!newEmp) {
          throw new Error("No se recibieron datos de la empresa creada");
        }

        console.log("Nueva empresa creada:", newEmp);

        // Si la empresa se creó correctamente, actualizamos el perfil
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ empresa_id: newEmp.id })
          .eq("id", uid);

        if (profileError) {
          throw new Error(`Error al actualizar perfil: ${profileError.message}`);
        }

        console.log("Perfil actualizado con nueva empresa");
        setEmpresaId(newEmp.id);
        setMode("edit");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error completo:", error);
      setError(error instanceof Error ? error.message : "Error desconocido al guardar los datos");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="bg-white p-6 rounded-3xl border">
        <div className="flex flex-col gap-6 h-full">
          <div className="bg-white w-full space-y-8 overflow-auto px-8 py-8">
            <div className="animate-pulse space-y-8">
              {/* Header skeleton */}
              <div className="p-8 rounded-2xl bg-neutral-100 border space-y-3">
                <div className="h-6 bg-neutral-200 rounded w-32" />
                <div className="h-8 bg-neutral-200 rounded w-80" />
                <div className="h-4 bg-neutral-200 rounded w-96" />
              </div>

              {/* Form skeleton */}
              <div className="space-y-8">
                {/* Información básica skeleton */}
                <div className="grid grid-cols-[350px_1fr] gap-10 items-start">
                  <div className="space-y-2">
                    <div className="h-6 bg-neutral-200 rounded w-32" />
                    <div className="h-4 bg-neutral-200 rounded w-48" />
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="h-4 bg-neutral-200 rounded w-24" />
                        <div className="h-11 bg-neutral-200 rounded" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 bg-neutral-200 rounded w-20" />
                        <div className="h-11 bg-neutral-200 rounded" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-neutral-200 rounded w-36" />
                      <div className="h-11 bg-neutral-200 rounded" />
                    </div>
                  </div>
                </div>

                {/* Separador */}
                <div className="h-px bg-neutral-200" />

                {/* Datos de contacto skeleton */}
                <div className="grid grid-cols-[350px_1fr] gap-10 items-start">
                  <div className="space-y-2">
                    <div className="h-6 bg-neutral-200 rounded w-36" />
                    <div className="h-4 bg-neutral-200 rounded w-52" />
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="h-4 bg-neutral-200 rounded w-32" />
                        <div className="h-11 bg-neutral-200 rounded" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 bg-neutral-200 rounded w-20" />
                        <div className="h-11 bg-neutral-200 rounded" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer skeleton */}
                <div className="flex items-center justify-between pt-8">
                  <div className="h-4 bg-neutral-200 rounded w-32" />
                  <div className="flex gap-3">
                    <div className="h-10 bg-neutral-200 rounded w-20" />
                    <div className="h-10 bg-neutral-200 rounded w-24" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-3xl">
      <div className="flex flex-col gap-6 h-full">
        <div className="bg-white w-full space-y-8 overflow-auto px-8 py-8 animate-fade-in">
          {/* Header con botón de volver */}
          <div className="mb-12 p-8 rounded-2xl bg-neutral-50 border relative overflow-hidden">
            {/* Radial gradient sutil con colores del logo */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
              style={{
                width: 320,
                height: 320,
                background: "radial-gradient(circle at 60% 40%, #c4bc00 0%, #d29d00 20%, #ff6251 40%, #b92d5d 70%, #7b219f 100%)",
                filter: "blur(120px)",
                opacity: 0.3,
              }}
            />
            
            <div className="relative z-10 space-y-3">
              <Badge variant="outline" className="bg-neutral-200 border-neutral-300 text-neutral-800">Próximamente</Badge>
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
                Escoge mas de una empresa para gestionar
              </h1>
              <p className="text-sm text-neutral-600">
                Puedes añadir mas de una empresa para gestionar y optimizar al máximo tu tiempo.
              </p>
            </div>
          </div>

          {/* Mensajes de estado */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6">
              <div className="flex items-center gap-3">
                <IconAlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {saveSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 mb-6">
              <div className="flex items-center gap-3">
                <IconCheck className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-medium text-emerald-800">¡Guardado!</h3>
                  <p className="text-sm text-emerald-700">Los datos de la empresa se han guardado correctamente.</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Información básica y dirección fiscal */}
            <div className="grid grid-cols-[350px_1fr] gap-10 items-start">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Información básica</h2>
                <p className="text-sm text-neutral-500">Datos fiscales y dirección de tu empresa</p>
              </div>
              <div className="flex flex-col gap-4 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="company" className="text-sm font-medium text-neutral-700">
                      Nombre fiscal *
                    </label>
                    <Input 
                      id="company" 
                      name="company" 
                      value={form.company} 
                      onChange={handleChange} 
                      required 
                      className="h-11"
                      placeholder="Ej: Mi Empresa S.L."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="cif" className="text-sm font-medium text-neutral-700">
                      CIF/NIF *
                    </label>
                    <Input 
                      id="cif" 
                      name="cif" 
                      value={form.cif} 
                      onChange={handleChange} 
                      required 
                      className="h-11"
                      placeholder="Ej: B12345678"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="address" className="text-sm font-medium text-neutral-700">
                    Dirección fiscal completa *
                  </label>
                  <Input 
                    id="address" 
                    name="address" 
                    value={form.address} 
                    onChange={handleChange} 
                    required 
                    className="h-11"
                    placeholder="Ej: Calle Mayor 123, 28001 Madrid"
                  />
                </div>
              </div>
            </div>

            {/* Separador */}
            <Separator className="my-8" />

            {/* Contacto */}
            <div className="grid grid-cols-[350px_1fr] gap-10 items-start">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Datos de contacto</h2>
                <p className="text-sm text-neutral-500">Información de contacto para facturación</p>
              </div>
              <div className="flex flex-col gap-4 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="billingEmail" className="text-sm font-medium text-neutral-700">
                      Email de facturación
                    </label>
                    <Input 
                      id="billingEmail" 
                      type="email" 
                      name="billingEmail" 
                      value={form.billingEmail} 
                      onChange={handleChange} 
                      className="h-11"
                      placeholder="facturacion@miempresa.com"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="phone" className="text-sm font-medium text-neutral-700">
                      Teléfono
                    </label>
                    <Input 
                      id="phone" 
                      name="phone" 
                      value={form.phone} 
                      onChange={handleChange} 
                      className="h-11"
                      placeholder="+34 123 456 789"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer con botones */}
            <div className="flex items-center justify-between gap-3 pt-8 w-full">
              <p className="text-xs py-1 px-2 rounded-full border">
                * Campos obligatorios
              </p>
              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Guardando...
                    </div>
                  ) : (
                    <>
                      {mode === "edit" ? "Actualizar" : "Guardar"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 