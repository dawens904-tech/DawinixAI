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

async function sendWhatsAppText(to: string, body: string) {
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
  if (!res.ok) throw new Error(data?.error?.message ?? `WhatsApp API error: ${res.status}`);
  return data;
}

async function updateBotProfile(name?: string, about?: string) {
  const results: Record<string, unknown> = {};

  // Update display name
  if (name) {
    const nameRes = await fetch(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/whatsapp_business_profile`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          about: about ?? undefined,
        }),
      }
    );
    results.profile = await nameRes.json();
  }

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  let body: {
    action: "send" | "update_profile";
    to?: string;
    message?: string;
    profile_about?: string;
    profile_name?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Send a direct message ──────────────────────────────────────────────
  if (body.action === "send") {
    const { to, message } = body;
    if (!to || !message) {
      return new Response(JSON.stringify({ error: "to and message are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize phone: strip non-digits
    const phone = to.replace(/\D/g, "");

    try {
      const result = await sendWhatsAppText(phone, message);
      await logEvent("message", "success", `[Admin] Direct message sent to +${phone}: "${message.slice(0, 60)}"`, { phone, messageId: result?.messages?.[0]?.id });

      // Upsert conversation in DB
      const { data: existing } = await supabase.from("conversations").select("id, message_count").eq("phone", phone).single();
      if (existing) {
        await supabase.from("conversations").update({
          last_message: `[Admin] ${message.slice(0, 100)}`,
          last_message_at: new Date().toISOString(),
          message_count: (existing.message_count ?? 0) + 1,
        }).eq("phone", phone);
      } else {
        const { data: conv } = await supabase.from("conversations").insert({
          phone,
          user_name: phone,
          last_message: `[Admin] ${message.slice(0, 100)}`,
        }).select().single();
        // Save message
        if (conv) {
          await supabase.from("messages").insert({
            conversation_id: conv.id,
            phone,
            role: "bot",
            content: `[Admin Direct] ${message}`,
            command: "admin",
          });
        }
      }

      return new Response(JSON.stringify({ success: true, messageId: result?.messages?.[0]?.id }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await logEvent("message", "error", `[Admin] Failed to send to +${phone}: ${errMsg}`);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ── Update bot profile ─────────────────────────────────────────────────
  if (body.action === "update_profile") {
    try {
      const result = await updateBotProfile(body.profile_name, body.profile_about);
      // Also update bot_config in DB
      if (body.profile_name) {
        await supabase.from("bot_config").upsert({ key: "bot_name", value: JSON.stringify(body.profile_name), updated_at: new Date().toISOString() }, { onConflict: "key" });
      }
      if (body.profile_about) {
        await supabase.from("bot_config").upsert({ key: "bot_about", value: JSON.stringify(body.profile_about), updated_at: new Date().toISOString() }, { onConflict: "key" });
      }
      await logEvent("config", "success", `[Admin] Bot profile updated: name="${body.profile_name}" about="${body.profile_about?.slice(0, 40)}"`);
      return new Response(JSON.stringify({ success: true, result }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await logEvent("config", "error", `[Admin] Profile update failed: ${errMsg}`);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
