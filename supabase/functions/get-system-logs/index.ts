import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") ?? "50");
  const severity = url.searchParams.get("severity");
  const type = url.searchParams.get("type");

  let query = supabase
    .from("system_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 200));

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
