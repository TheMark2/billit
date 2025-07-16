"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconHome,
  IconReceipt,
  IconAffiliate,
  IconSettings,
  IconCreditCard,
  IconLogout2,
  IconHomeFilled,
  IconReceiptFilled,
  IconAffiliateFilled,
  IconSettingsFilled,
  IconCreditCardFilled,
  IconBasketFilled,
  IconBasket,
  IconPhotoFilled,
  IconPhoto,
  IconBell,
  IconBellFilled,
} from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "../ui/button";
import { ProfileSkeleton } from "./Skeletons";
import { Notifications } from "./Notifications";

const menuItems = [
  { 
    label: "Inicio", 
    icon: IconHome, 
    iconFilled: IconHomeFilled, 
    href: "/dashboard" 
  },
  { 
    label: "Tickets", 
    icon: IconReceipt, 
    iconFilled: IconReceiptFilled, 
    href: "/dashboard/recibos" 
  },
  { 
    label: "Subir Tickets", 
    icon: IconPhoto, 
    iconFilled: IconPhotoFilled, 
    href: "/dashboard/subir-facturas" 
  },
  { 
    label: "Integraciones", 
    icon: IconAffiliate, 
    iconFilled: IconAffiliateFilled, 
    href: "/dashboard/integraciones" 
  },
  { 
    label: "Planes", 
    icon: IconCreditCard, 
    iconFilled: IconCreditCardFilled, 
    href: "/dashboard/pricing" 
  },
  { 
    label: "Ajustes y ayuda", 
    icon: IconSettings, 
    iconFilled: IconSettingsFilled, 
    href: "/dashboard/ajustes" 
  },
];

export default function DashboardNavbar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return setLoading(false);
      
      const { data, error } = await supabase
        .from("profiles")
        .select("nombre,apellido,email,avatar_url,plan_id")
        .eq("id", user.id)
        .single();
      
      if (!error && data) {
        let planName = "Básico";
        if (data.plan_id) {
          const { data: planData } = await supabase
            .from("plans")
            .select("nombre")
            .eq("id", data.plan_id)
            .single();
          if (planData) planName = planData.nombre;
        }
        setProfile({ ...data, email: data.email ?? user.email, planName });
      }
      setLoading(false);
    }
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <aside className="h-screen w-64 bg-white flex flex-col px-4 py-6 rounded-r-3xl">
      {/* Header con logo y notificaciones */}
      <div className="mb-8 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center">
          <img 
            src="/Logobillit1.svg" 
            alt="Billit Logo" 
            className="h-6 w-auto opacity-60 hover:opacity-80 transition-opacity duration-200"
            style={{
              filter: 'grayscale(1) brightness(0.6)'
            }}
          />
        </Link>
        
        {/* Notificaciones */}
        <Notifications />
      </div>

      <div className="mb-6">
        <div className="text-xs text-neutral-400 font-semibold mb-2 px-2">Menú</div>
        <nav className="flex flex-col gap-1">
          {menuItems.map(({ label, icon: Icon, iconFilled: IconFilled, href }) => {
            const isActive = pathname === href;
            const IconToUse = isActive ? IconFilled : Icon;
            return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 ease-in-out
                  ${isActive 
                    ? "bg-neutral-100 text-neutral-900 transform scale-[1.02]" 
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800 hover:transform hover:scale-[1.01]"
                  }`}
            >
                <IconToUse className={`h-5 w-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} stroke={1.5} />
              {label}
            </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto">
        {loading ? (
          <ProfileSkeleton />
        ) : (
          <div className="flex flex-col gap-3 p-3 rounded-md bg-neutral-50">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt="Usuario" />
                ) : (
                  <AvatarFallback>
                    {profile?.nombre?.[0] || "U"}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-medium text-sm truncate">
                  {profile?.nombre || "Usuario"}
                </span>
                <span className="text-xs text-neutral-500 truncate">
                  {profile?.email || ""}
                </span>
              </div>
            </div>
            
            {profile?.planName && (
              <div className="flex items-center justify-center">
                <span className="text-xs text-neutral-600 bg-neutral-200 px-2 py-1 rounded-full font-medium">
                  Plan {profile.planName}
                </span>
              </div>
            )}
            
            <Button
              onClick={handleLogout}
              size="sm"
              className="w-full bg-neutral-200 hover:bg-neutral-300 text-neutral-700 text-xs font-medium rounded-md py-2 transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <IconLogout2 className="h-4 w-4" /> Cerrar sesión
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
} 