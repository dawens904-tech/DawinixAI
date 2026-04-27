import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Accept both GET and POST
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  // Parse filters from query params (GET) or body (POST)
  let limit = 100;
  let severity: string | null = null;
  let type: string | null = null;

  if (req.method === "GET") {
    const url = new URL(req.url);
    limit = parseInt(url.searchParams.get("limit") ?? "100");
    severity = url.searchParams.get("severity");
    type = url.searchParams.get("type");
  } else {
    try {
      const body = await req.json();
      limit = body.limit ?? 100;
      severity = body.severity ?? null;
      type = body.type ?? null;
    } catch {
      // No body, use defaults
    }
  }

  let query = supabase
    .from("system_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 500));

  if (severity && severity !== "all") query = query.eq("severity", severity);
  if (type && type !== "all") query = query.eq("type", type);

  const { data, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ logs: data ?? [] }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
