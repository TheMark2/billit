"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, UploadCloud, Brain } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PlanInfo } from "@/components/dashboard/PlanInfo";
import { SettingsSkeleton } from "@/components/dashboard/Skeletons";

// Componente separador simple
const Separator: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("h-px w-full bg-neutral-200", className)} />
);

export default function AjustesPage() {
  const [profileImg, setProfileImg] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [birthDate, setBirthDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [cityInputFocused, setCityInputFocused] = useState(false);
  const [company, setCompany] = useState("");
  const [autoAIAnalysis, setAutoAIAnalysis] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      console.log("🔍 Iniciando carga del perfil...");
      
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("❌ Error al obtener la sesión:", sessionError);
        return setLoading(false);
      }
      
      const user = session?.user;
      if (!user) {
        console.log("⚠️ No hay usuario en la sesión");
        return setLoading(false);
      }

      console.log("👤 Usuario encontrado:", user.id);

      const { data, error } = await supabase
        .from("profiles")
        .select("nombre,apellido,email,telefono,avatar_url,ciudad,nacimiento,plan_id,is_subscribed,auto_ai_analysis")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("❌ Error al cargar el perfil:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      } else if (data) {
        console.log("✅ Perfil cargado exitosamente:", data);
        setFirstName(data.nombre ?? "");
        setLastName(data.apellido ?? "");
        setEmail(data.email ?? user.email ?? "");
        setPhone(data.telefono ?? "");
        setCity(data.ciudad ?? "");
        setBirthDate(data.nacimiento ?? "");
        // Nota: empresa ya no existe en la BD, mantenemos el campo vacío en la UI
        setCompany("");
        setAutoAIAnalysis(data.auto_ai_analysis ?? true);

        if (data.avatar_url) {
          const { data: publicUrl } = supabase.storage
            .from("avatars")
            .getPublicUrl(data.avatar_url);
          setProfileImg(publicUrl.publicUrl);
        }
      } else {
        console.log("⚠️ No se encontraron datos del perfil");
      }
      setLoading(false);
    };
    fetchProfile();
  }, []);

  const handleAvatarChange = (file?: File) => {
    if (!file) return;
    setAvatarFile(file);
    setProfileImg(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setLoading(true);
    console.log("💾 Iniciando guardado del perfil...");
    
    const {
      data: { session },
    } = await supabase.auth.getSession();
    
    const user = session?.user;
    if (!user) {
      console.log("⚠️ No hay usuario para guardar");
      setLoading(false);
      return;
    }

    console.log("👤 Guardando perfil para usuario:", user.id);

    let avatarPath: string | undefined;
    if (avatarFile) {
      console.log("📸 Subiendo avatar...");
      const fileExt = avatarFile.name.split(".").pop();
      avatarPath = `${user.id}/avatar.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(avatarPath, avatarFile, { upsert: true });
      if (uploadError) {
        console.error("❌ Error subiendo avatar:", uploadError);
      } else {
        console.log("✅ Avatar subido exitosamente");
      }
    }

    const updates = {
      id: user.id,
      nombre: firstName,
      apellido: lastName,
      email: email,
      telefono: phone,
      ciudad: city,
      nacimiento: birthDate,
      auto_ai_analysis: autoAIAnalysis,
      // Nota: empresa eliminado porque ya no existe en la BD
      ...(avatarPath && { avatar_url: avatarPath }),
    };

    console.log("📝 Datos a actualizar:", updates);

    const { error } = await supabase.from("profiles").upsert(updates);
    if (error) {
      console.error("❌ Error guardando perfil:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
    } else {
      console.log("✅ Perfil guardado exitosamente");
    }

    setLoading(false);
  };

  // Función de autocompletado Mapbox
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  async function fetchCitySuggestions(query: string) {
    if (!query) return setCitySuggestions([]);
    if (!mapboxToken) return;
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?autocomplete=true&types=place&language=es&limit=5&access_token=${mapboxToken}`
      );
      const data = await res.json();
      const suggestions = (data.features || []).map((f: any) => f.place_name);
      setCitySuggestions(suggestions);
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="bg-white p-6 rounded-3xl border">
    <div className="flex flex-col gap-6 h-full">
      <div className="bg-white w-full space-y-8 overflow-auto px-8 py-8 animate-fade-in">
        {/* Plan actual */}
        <div className="grid grid-cols-[350px_1fr] gap-10 items-start">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Tu plan</h2>
            <p className="text-sm text-neutral-500">Detalles de tu suscripción y límites de recibos</p>
          </div>
          <PlanInfo className="max-w-md" />
        </div>

        {/* Separador */}
        <Separator className="my-8" />

        {/* Configuración de IA */}
        <div className="grid grid-cols-[350px_1fr] gap-10 items-start">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-600" />
              Análisis con IA
            </h2>
            <p className="text-sm text-neutral-500">Configura el análisis automático de tus tickets con inteligencia artificial</p>
          </div>
          <div className="flex flex-col gap-4 w-full">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h3 className="font-medium">Análisis automático</h3>
                <p className="text-sm text-neutral-500">
                  Analiza automáticamente cada ticket al subirlo para generar descripciones y categorizar el tipo de negocio
                </p>
              </div>
              <Switch
                checked={autoAIAnalysis}
                onCheckedChange={setAutoAIAnalysis}
              />
            </div>
            {autoAIAnalysis && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  ✨ El análisis automático está activado. Cada ticket que subas será analizado automáticamente para generar una descripción y categorizar el tipo de negocio.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Separador */}
        <Separator className="my-8" />

        {/* Información de la cuenta */}
        <div className="grid grid-cols-[350px_1fr] gap-10 items-start">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Información de la cuenta</h2>
            <p className="text-sm text-neutral-500">Actualiza tu foto y tus datos personales aquí.</p>
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="mt-2 flex gap-2">
                Móvil sin verificar <AlertCircle className="w-4 h-4" />
              </Badge>
            </div>
          </div>

          {/* Sección derecha */}
          <div className="flex flex-col gap-4 w-full">
            {/* Foto */}
            <div className="space-y-3">
              <span className="text-sm font-medium flex items-center gap-1 text-neutral-700">
                Tu foto
              </span>
              <div
                className="w-full max-w-sm border border-dashed rounded-xl bg-neutral-50 flex flex-col items-center justify-center p-6 cursor-pointer hover:bg-neutral-100 transition"
                onClick={() => document.getElementById('profileInput')?.click()}
              >
                <input
                  id="profileInput"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAvatarChange(e.target.files?.[0])}
                />
                {profileImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profileImg} alt="Preview" className="w-32 h-32 rounded-full object-cover" />
                ) : (
                  <>
                    <UploadCloud className="h-5 w-5 text-neutral-900" />
                    <span className="text-sm text-neutral-700 mt-2">Haz clic para subir o arrastra la imagen</span>
                  </>
                )}
              </div>
            </div>

            {/* Campo nombre y apellido */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Nombre" placeholder="Nombre" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <Input label="Apellido" placeholder="Apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>

            {/* Email */}
            <Input label="Correo electrónico" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

            {/* Teléfono */}
            <div className="space-y-2">
              <Input label="Número de teléfono" placeholder="+34 600 000 000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <p className="text-xs text-yellow-600">Tu número de teléfono no está verificado.</p>
              <Button variant="link" className="p-0 h-auto text-xs">Verificar ahora</Button>
            </div>
          </div>
        </div>

        {/* Separador */}
        <Separator className="my-8" />

        {/* Más información */}
        <div className="grid grid-cols-[350px_1fr] gap-10 items-start">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Más información</h2>
            <p className="text-sm text-neutral-500">Información adicional sobre tu ubicación</p>
          </div>
          <div className="flex flex-col gap-4 w-full">
            {/* Ciudad */}
            <div className="relative">
              <Input
                label="Ciudad"
                placeholder="Escribe una ciudad"
                value={city}
                onChange={(e) => {
                  const val = e.target.value;
                  setCity(val);
                  fetchCitySuggestions(val);
                }}
                onFocus={() => setCityInputFocused(true)}
                onBlur={() => setTimeout(() => setCityInputFocused(false), 150)}
              />
              {cityInputFocused && citySuggestions.length > 0 && (
                <ul className="absolute z-10 bg-white border rounded w-full mt-1 max-h-40 overflow-auto shadow-lg">
                  {citySuggestions.map((sug) => (
                    <li
                      key={sug}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-neutral-100"
                      onMouseDown={() => {
                        setCity(sug);
                        setCitySuggestions([]);
                      }}
                    >
                      {sug}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Fecha de nacimiento */}
            <Input label="Fecha de nacimiento" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />

            {/* Empresa */}
            <div className="space-y-2">
              <Input label="Empresa" value={company} onChange={(e) => setCompany(e.target.value)} />
              <p className="text-xs text-neutral-500">Nota: Este campo ya no se guarda en el perfil.</p>
            </div>
          </div>
        </div>



        {/* Footer */}
        <div className="flex items-center justify-between gap-3 py-t w-full">
          <Button variant="outline" disabled={loading}>Cancelar</Button>
          <Button 
            onClick={handleSave} 
            isLoading={loading}
          >
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
    </div>
  );
}