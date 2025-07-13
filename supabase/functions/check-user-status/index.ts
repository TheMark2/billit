// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

// Tipos auxiliares
interface RequestBody {
  phoneNumber?: string;
}

serve(async (req) => {
  const N8N_SECRET_KEY = Deno.env.get("N8N_SECRET_KEY");
  if (req.headers.get("x-api-key") !== N8N_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { phoneNumber } = body;
  if (!phoneNumber) {
    return new Response(
      JSON.stringify({ error: "Phone number is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Adaptar formato del número si es necesario
  const cleanPhone = phoneNumber.replace(/^\+/, "");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, is_subscribed, recibos_mes_actual, plan_id, plans(limite_recibos)")
    .eq("telefono", cleanPhone)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching profile:", error);
    return new Response(
      JSON.stringify({ status: "error", message: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!profile || !profile.is_subscribed) {
    return new Response(
      JSON.stringify({
        status: "unsubscribed",
        message: "Tu número no está suscrito o no existe.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const limiteRecibos: number = profile.plans?.limite_recibos ?? 0;
  const recibosProcesados: number = profile.recibos_mes_actual ?? 0;
  const canProcess = recibosProcesados < limiteRecibos;

  return new Response(
    JSON.stringify({
      status: "success",
      userId: profile.id,
      planId: profile.plan_id,
      recibosMesActual: recibosProcesados,
      limiteRecibos: limiteRecibos,
      recibosQuotaRemaining: limiteRecibos - recibosProcesados,
      canProcessReceipt: canProcess,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}); 