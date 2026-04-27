import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const PHONE_NUMBER_ID = Deno.env.get("PHONE_NUMBER_ID") ?? "";
const ACCESS_TOKEN = Deno.env.get("ACCESS_TOKEN") ?? "";

async function logEvent(type: string, severity: string, message: string, metadata?: unknown) {
  await supabase.from("system_logs").insert({
    type, severity, message, metadata: metadata ?? null,
  });
}

async function sendWhatsAppText(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: body.slice(0, 4096) },
      }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data?.error?.message ?? `HTTP ${res.status}` };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  let body: { message: string; filter?: "all" | "active" };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.message?.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch target users
  let query = supabase.from("whatsapp_users").select("phone, name, status");
  if (body.filter !== "all") {
    query = query.eq("status", "active");
  }
  const { data: users, error: usersError } = await query;

  if (usersError) {
    return new Response(JSON.stringify({ error: usersError.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!users || users.length === 0) {
    return new Response(JSON.stringify({ success: true, sent: 0, failed: 0, total: 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await logEvent("broadcast", "info", `[Broadcast] Starting broadcast to ${users.length} users`, { message: body.message.slice(0, 80) });

  let sent = 0;
  let failed = 0;
  const errors: { phone: string; error: string }[] = [];

  // Send with 200ms delay between each to respect rate limits
  for (const user of users) {
    const result = await sendWhatsAppText(user.phone, body.message);
    if (result.success) {
      sent++;
    } else {
      failed++;
      errors.push({ phone: user.phone, error: result.error ?? "Unknown error" });
    }
    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  await logEvent(
    "broadcast",
    failed > 0 ? "warning" : "success",
    `[Broadcast] Done: ${sent} sent, ${failed} failed out of ${users.length} total`,
    { sent, failed, errors: errors.slice(0, 10) }
  );

  return new Response(
    JSON.stringify({ success: true, sent, failed, total: users.length, errors: errors.slice(0, 10) }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
