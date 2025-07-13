"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import useSWR from "swr";
import { PlanStatusSkeleton } from "@/components/dashboard/Skeletons";

interface PlanInfo {
  name: string;
  limit: number;
  used: number;
}

const PLAN_KEY_MAP: Record<string, string> = {
  "Básico": "free",
  "Pro": "pro",
  "Pro Mensual": "pro",
  "Pro Anual": "pro", 
  "Unlimited": "unlimited",
  "Unlimited Mensual": "unlimited",
  "Unlimited Anual": "unlimited",
};

const gradientBorder =
  "bg-[linear-gradient(90deg,#c4bc00,#d29d00,#ff6251,#b92d5d,#7b219f)]";

async function fetchPlanInfo(): Promise<PlanInfo> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) throw new Error("No user");

  // Perfil -> plan_id y contador mensual
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id, recibos_mes_actual")
    .eq("id", uid)
    .single();
  const plan_id = profile?.plan_id;
  let used = profile?.recibos_mes_actual ?? 0;

  let name = "Básico";
  let limit = 0;
  if (plan_id) {
    const { data: planRow } = await supabase
      .from("plans")
      .select("nombre, limite_recibos")
      .eq("id", plan_id)
      .single();
    if (planRow) {
      name = planRow.nombre;
      limit = planRow.limite_recibos;
    }
  }

  // Si recibos_mes_actual no existe o es 0, como fallback contar recibos
  if (used === 0) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);

    const { data: receiptsData } = await supabase
      .from("receipts")
      .select("id")
      .eq("user_id", uid)
      .gte("created_at", startOfMonth.toISOString());

    used = receiptsData?.length ?? 0;
  }

  return { name, limit, used };
}

export function PlanStatus() {
  const { data: info, mutate } = useSWR<PlanInfo>("plan-info", fetchPlanInfo, {
    revalidateOnFocus: true,
    refreshInterval: 10000, // Refrescar cada 10 segundos
  });

  // Escuchar cambios en los profiles para revalidar datos
  useEffect(() => {
    const channel = supabase
      .channel('plan-status-updates')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'profiles' 
        }, 
        () => {
          console.log('🔄 Perfil actualizado, refrescando estado del plan...');
          mutate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mutate]);

  if (!info) return <PlanStatusSkeleton />;

  const usagePercent = info.limit ? Math.min(100, (info.used / info.limit) * 100) : 0;
  const key = PLAN_KEY_MAP[info.name] ?? "free";

  return (
    <div className="p-6 rounded-2xl border bg-white shadow-none">
      {/* Header simplificado */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-neutral-900">Estado del Plan</h2>
        
        {key === "pro" || key === "unlimited" ? (
          <div className={`p-[2px] rounded-full ${gradientBorder}`}>
            <span className="block bg-white rounded-full py-1 px-3 text-xs font-medium capitalize">
              {info.name}
            </span>
          </div>
        ) : (
          <Badge variant="outline" className="py-1 px-3 font-medium text-xs capitalize border-0 bg-neutral-100">
            {info.name}
          </Badge>
        )}
      </div>

      {/* Información de uso principal */}
      <div className="rounded-lg border border-neutral-200 p-4 bg-neutral-50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-neutral-700">Recibos procesados</span>
          <span className="text-lg font-semibold text-neutral-900">
            {info.used}{info.limit > 0 && `/${info.limit}`}
          </span>
        </div>

        {info.limit > 0 && (
          <div className="space-y-2">
            <div className="w-full bg-neutral-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-neutral-500">
              <span>{Math.round(usagePercent)}% usado</span>
              <span>{info.limit - info.used} restantes</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

 