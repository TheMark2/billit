// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

interface RequestBody {
  userId?: string;
  receiptData?: Record<string, unknown>;
  originalPdfUrl?: string;
  status?: string;
  errorMessage?: string;
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

  const { userId, receiptData, originalPdfUrl, status, errorMessage } = body;

  if (!userId || !receiptData || !status) {
    return new Response(
      JSON.stringify({ error: "Missing required fields" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Insertar recibo
  const { error: insertError } = await supabase.from("receipts").insert({
    user_id: userId,
    fecha_emision: (receiptData as any).fecha || null,
    proveedor: (receiptData as any).proveedor || null,
    total: (receiptData as any).total || null,
    moneda: (receiptData as any).moneda || null,
    estado: status,
    url_archivo: originalPdfUrl,
    texto_extraido: JSON.stringify(receiptData),
    metadatos: errorMessage ? { error: errorMessage } : {},
  });

  if (insertError) {
    console.error("Error inserting receipt:", insertError);
    return new Response(
      JSON.stringify({ status: "error", message: "Error al guardar recibo" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Incrementar contador de recibos
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("recibos_mes_actual")
    .eq("id", userId)
    .single();

  if (!profileErr && profile) {
    const newCount = (profile.recibos_mes_actual || 0) + 1;
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ recibos_mes_actual: newCount })
      .eq("id", userId);

    if (updateErr) {
      console.error("Error updating receipt count:", updateErr);
    }
  } else {
    console.error("Error fetching profile to update count:", profileErr);
  }

  return new Response(JSON.stringify({ status: "success" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}); 