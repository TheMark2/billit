"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, UploadCloud } from "lucide-react";
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

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("Error al obtener la sesión:", sessionError);
        return setLoading(false);
      }
      const user = session?.user;
      if (!user) return setLoading(false);

      const { data, error } = await supabase
        .from("profiles")
        .select("nombre,apellido,email,telefono,avatar_url,ciudad,nacimiento,empresa,plan_id,is_subscribed")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error al cargar el perfil:", error);
      } else if (data) {
        setFirstName(data.nombre ?? "");
        setLastName(data.apellido ?? "");
        setEmail(data.email ?? user.email ?? "");
        setPhone(data.telefono ?? "");
        setCity(data.ciudad ?? "");
        setBirthDate(data.nacimiento ?? "");
        setCompany(data.empresa ?? "");

        if (data.avatar_url) {
          const { data: publicUrl } = supabase.storage
            .from("avatars")
            .getPublicUrl(data.avatar_url);
          setProfileImg(publicUrl.publicUrl);
        }
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
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setLoading(false);
      return;
    }

    let avatarPath: string | undefined;
    if (avatarFile) {
      const fileExt = avatarFile.name.split(".").pop();
      avatarPath = `${user.id}/avatar.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(avatarPath, avatarFile, { upsert: true });
      if (uploadError) console.error(uploadError);
    }

    const updates = {
      id: user.id,
      nombre: firstName,
      apellido: lastName,
      email: email,
      telefono: phone,
      ciudad: city,
      nacimiento: birthDate,
      empresa: company,
      ...(avatarPath && { avatar_url: avatarPath }),
    };

    const { error } = await supabase.from("profiles").upsert(updates);
    if (error) {
      console.error("Error guardando perfil:", error.message || error);
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
            <Input label="Empresa" value={company} onChange={(e) => setCompany(e.target.value)} />
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