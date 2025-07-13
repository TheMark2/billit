// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

interface RequestBody {
  userId?: string;
}

serve(async (req) => {
  // Seguridad via API key
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

  const { userId } = body;
  if (!userId) {
    return new Response(JSON.stringify({ error: "User ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: credential, error } = await supabase
    .from("odoo_credentials")
    .select("url, database, username, password")
    .eq("user_id", userId)
    .single();

  if (error || !credential) {
    return new Response(
      JSON.stringify({ status: "error", message: "Odoo credentials not found or error." }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ 
      status: "success", 
      credentials: {
        url: credential.url,
        database: credential.database,
        username: credential.username,
        password: credential.password
      }
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}); 