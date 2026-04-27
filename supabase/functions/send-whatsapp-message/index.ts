import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

const PHONE_NUMBER_ID = Deno.env.get("PHONE_NUMBER_ID") ?? "";
const ACCESS_TOKEN = Deno.env.get("ACCESS_TOKEN") ?? "";
const APP_ID = Deno.env.get("APP_ID") ?? "";
const WA_API = `https://graph.facebook.com/v19.0`;

async function logEvent(type: string, severity: string, message: string, metadata?: unknown) {
  try {
    await supabase.from("system_logs").insert({
      type,
      severity,
      message,
      metadata: metadata ?? null,
    });
  } catch {
    // non-critical
  }
}

function checkSecrets() {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error("PHONE_NUMBER_ID or ACCESS_TOKEN not configured.");
  }
}

// ── Send a text message ─────────────────────────────────────────────────────
async function sendWhatsAppText(to: string, body: string) {
  checkSecrets();
  const res = await fetch(`${WA_API}/${PHONE_NUMBER_ID}/messages`, {
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
  if (!res.ok) {
    throw new Error(`WhatsApp API: ${data?.error?.message ?? `HTTP ${res.status}`}`);
  }
  return data;
}

// ── Resumable Upload: Step 1 — Create Session ───────────────────────────────
async function createUploadSession(fileLength: number, fileType: string): Promise<string> {
  if (!APP_ID) throw new Error("APP_ID secret is required for profile photo upload.");

  const url = new URL(`${WA_API}/${APP_ID}/uploads`);
  url.searchParams.set("access_token", ACCESS_TOKEN);
  url.searchParams.set("file_length", String(fileLength));
  url.searchParams.set("file_type", fileType);

  const res = await fetch(url.toString(), { method: "POST" });
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(`Create session failed: ${data?.error?.message ?? `HTTP ${res.status}`} — ${JSON.stringify(data)}`);
  }

  console.log("[profile] Session created:", data.id);
  return data.id;
}

// ── Resumable Upload: Step 2 — Upload File via MULTIPART/FORM-DATA ──────────
async function uploadFileMultipart(sessionId: string, blob: Blob, fileName: string, contentType: string): Promise<string> {
  // CRITICAL: Must use multipart/form-data, NOT raw binary/octet-stream
  const formData = new FormData();
  formData.append("file", blob, fileName);

  const res = await fetch(`${WA_API}/${sessionId}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${ACCESS_TOKEN}`,
      "file_offset": "0",
      // DO NOT set Content-Type manually — Deno will set the multipart boundary automatically
    },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Upload failed: ${data?.error?.message ?? `HTTP ${res.status}`} — ${JSON.stringify(data)}`);
  }

  console.log("[profile] Upload result:", data);
  if (!data.h) {
    throw new Error("No handle (h) returned from upload. Response: " + JSON.stringify(data));
  }
  return data.h;
}

// ── Get profile_picture_handle from image URL ───────────────────────────────
async function getProfilePictureHandle(imageUrl: string): Promise<string> {
  // 1. Fetch image from Supabase Storage
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch image: HTTP ${imgRes.status}`);
  const arrayBuffer = await imgRes.arrayBuffer();
  // WhatsApp ONLY accepts image/jpeg — force it regardless of source format
  const contentType = "image/jpeg";
  const blob = new Blob([arrayBuffer], { type: contentType });

  // 2. Create session
  const sessionId = await createUploadSession(blob.size, contentType);

  // 3. Upload via multipart/form-data
  const handle = await uploadFileMultipart(sessionId, blob, "profile.jpg", contentType);

  return handle;
}

// ── Update WhatsApp Business profile ───────────────────────────────────────
async function updateBotProfile(options: {
  name?: string;
  about?: string;
  photoUrl?: string;
}) {
  checkSecrets();

  let profilePictureHandle: string | undefined;
  if (options.photoUrl) {
    console.log("[profile] Starting resumable upload for profile photo...");
    profilePictureHandle = await getProfilePictureHandle(options.photoUrl);
    console.log("[profile] Got handle:", profilePictureHandle);
  }

  // Build payload — ONLY include fields with values
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
  };

  if (options.about && options.about.trim()) {
    payload.about = options.about.trim().slice(0, 139);
  }

  if (profilePictureHandle) {
    payload.profile_picture_handle = profilePictureHandle;
  }

  const hasUpdates = Object.keys(payload).length > 1;
  if (!hasUpdates) {
    throw new Error("No valid profile fields to update (about or photo required)");
  }

  const profileRes = await fetch(
    `${WA_API}/${PHONE_NUMBER_ID}/whatsapp_business_profile`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const profileData = await profileRes.json();
  if (!profileRes.ok) {
    throw new Error(
      `WhatsApp Profile API: ${profileData?.error?.message ?? `HTTP ${profileRes.status}`} — ${JSON.stringify(profileData)}`
    );
  }

  return profileData;
}

// ── Main handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  let body: {
    action: "send" | "update_profile";
    to?: string;
    message?: string;
    profile_about?: string;
    profile_name?: string;
    profile_photo_url?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[send-whatsapp-message] action:", body.action);

  // ── Send direct message ─────────────────────────────────────────────────
  if (body.action === "send") {
    const { to, message } = body;
    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "'to' and 'message' are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phone = to.replace(/\D/g, "");

    try {
      const result = await sendWhatsAppText(phone, message);
      await logEvent(
        "message",
        "success",
        `[Admin] Direct message sent to +${phone}: "${message.slice(0, 60)}"`,
        { phone, messageId: result?.messages?.[0]?.id }
      );

      const { data: existing } = await supabase
        .from("conversations")
        .select("id, message_count")
        .eq("phone", phone)
        .single();

      if (existing) {
        await supabase
          .from("conversations")
          .update({
            last_message: `[Admin] ${message.slice(0, 100)}`,
            last_message_at: new Date().toISOString(),
            message_count: (existing.message_count ?? 0) + 1,
          })
          .eq("phone", phone);
      } else {
        const { data: conv } = await supabase
          .from("conversations")
          .insert({ phone, user_name: phone, last_message: `[Admin] ${message.slice(0, 100)}` })
          .select()
          .single();

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

      return new Response(
        JSON.stringify({ success: true, messageId: result?.messages?.[0]?.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[send] Error:", errMsg);
      await logEvent("message", "error", `[Admin] Failed to send to +${phone}: ${errMsg}`);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ── Update bot profile ──────────────────────────────────────────────────
  if (body.action === "update_profile") {
    try {
      const result = await updateBotProfile({
        name: body.profile_name,
        about: body.profile_about,
        photoUrl: body.profile_photo_url,
      });

      const upserts = [];
      if (body.profile_name) {
        upserts.push({ key: "bot_name", value: JSON.stringify(body.profile_name), updated_at: new Date().toISOString() });
      }
      if (body.profile_about) {
        upserts.push({ key: "bot_about", value: JSON.stringify(body.profile_about), updated_at: new Date().toISOString() });
      }
      if (upserts.length > 0) {
        await supabase.from("bot_config").upsert(upserts, { onConflict: "key" });
      }

      await logEvent(
        "config",
        "success",
        `[Admin] Bot profile updated: name="${body.profile_name ?? "—"}" about="${(body.profile_about ?? "").slice(0, 40)}" photo=${body.profile_photo_url ? "yes" : "no"}`
      );

      return new Response(JSON.stringify({ success: true, result }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[update_profile] Error:", errMsg);
      await logEvent("config", "error", `[Admin] Profile update failed: ${errMsg}`);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(
    JSON.stringify({ error: "Unknown action. Use 'send' or 'update_profile'" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
