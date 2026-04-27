import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const PHONE_NUMBER_ID = Deno.env.get("PHONE_NUMBER_ID") ?? "";
const ACCESS_TOKEN = Deno.env.get("ACCESS_TOKEN") ?? "";
const WEBHOOK_VERIFY_TOKEN = Deno.env.get("WEBHOOK_VERIFY_TOKEN") ?? "";
const AI_API_KEY = Deno.env.get("ONSPACE_AI_API_KEY") ?? "";
const AI_BASE_URL = Deno.env.get("ONSPACE_AI_BASE_URL") ?? "";

// ── Helpers ────────────────────────────────────────────────────────────────

async function logEvent(type: string, severity: string, message: string, metadata?: unknown) {
  await supabase.from("system_logs").insert({
    type, severity, message,
    metadata: metadata ?? null,
  });
}

async function getBotConfig(key: string, fallback: string): Promise<string> {
  const { data } = await supabase.from("bot_config").select("value").eq("key", key).single();
  if (!data) return fallback;
  const v = data.value;
  return typeof v === "string" ? v : JSON.stringify(v);
}

async function getOrCreateConversation(phone: string, name?: string) {
  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .eq("phone", phone)
    .single();
  if (existing) return existing;
  const { data: created } = await supabase
    .from("conversations")
    .insert({ phone, user_name: name ?? phone, last_message: "Started conversation" })
    .select()
    .single();
  return created;
}

async function upsertUser(phone: string, name?: string) {
  const { data: existing } = await supabase
    .from("whatsapp_users")
    .select("*")
    .eq("phone", phone)
    .single();
  if (existing) {
    await supabase.from("whatsapp_users").update({
      last_seen: new Date().toISOString(),
      total_messages: existing.total_messages + 1,
    }).eq("phone", phone);
    return existing;
  } else {
    const { data: created } = await supabase.from("whatsapp_users").insert({
      phone, name: name ?? phone, status: "active",
    }).select().single();
    return created;
  }
}

async function getContextMessages(phone: string, limit = 10) {
  const { data } = await supabase
    .from("messages")
    .select("role, content")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).reverse().map((m: { role: string; content: string }) => ({
    role: m.role === "bot" ? "assistant" : "user",
    content: m.content,
  }));
}

async function checkCustomCommand(text: string) {
  const lower = text.toLowerCase().trim();
  const { data: commands } = await supabase
    .from("custom_commands")
    .select("*")
    .eq("is_active", true);
  if (!commands) return null;
  for (const cmd of commands) {
    if (lower === cmd.command) {
      await supabase.from("custom_commands").update({ usage_count: cmd.usage_count + 1 }).eq("id", cmd.id);
      return cmd.response_template;
    }
    if (cmd.trigger_keywords?.some((kw: string) => lower.includes(kw.toLowerCase()))) {
      await supabase.from("custom_commands").update({ usage_count: cmd.usage_count + 1 }).eq("id", cmd.id);
      return cmd.response_template;
    }
  }
  return null;
}

async function callAI(messages: { role: string; content: string }[], systemPrompt: string) {
  const start = Date.now();
  const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content ?? "", elapsed: Date.now() - start };
}

async function generateCode(prompt: string) {
  const { text, elapsed } = await callAI(
    [{ role: "user", content: prompt }],
    "You are an expert code generator. Provide clean, well-commented code with explanations. Support Python, JavaScript, Node.js, HTML/CSS. Use markdown code blocks."
  );
  return { text: `💻 *Code Generated:*\n\n${text}`, elapsed };
}

// ── Image Generation ────────────────────────────────────────────────────────

async function generateImage(prompt: string, phone: string): Promise<string> {
  await logEvent("command", "info", `[Image] Generating image for ${phone}: "${prompt.slice(0, 60)}"`);

  const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      modalities: ["image", "text"],
      messages: [{ role: "user", content: prompt }],
      image_config: { aspect_ratio: "1:1", image_size: "1K" },
    }),
  });

  const data = await res.json();
  const imageDataUrl: string = data.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? "";

  if (!imageDataUrl) {
    throw new Error("No image returned from AI");
  }

  // Convert base64 data URL to blob
  const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const blob = new Blob([bytes], { type: "image/png" });

  // Upload to Supabase Storage
  const fileName = `${phone}/${crypto.randomUUID()}.png`;
  const { error: uploadError } = await supabase.storage
    .from("generated-images")
    .upload(fileName, blob, { contentType: "image/png", cacheControl: "3600", upsert: false });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from("generated-images")
    .getPublicUrl(fileName);

  await logEvent("command", "success", `[Image] Generated & stored for ${phone}`, { publicUrl: publicUrl.slice(0, 80) });

  return publicUrl;
}

// ── WhatsApp Messaging ─────────────────────────────────────────────────────

async function sendWhatsAppText(to: string, body: string) {
  await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: body.slice(0, 4096) },
    }),
  });
}

async function sendWhatsAppImage(to: string, imageUrl: string, caption: string) {
  await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: imageUrl, caption: caption.slice(0, 1024) },
    }),
  });
}

// ── Invite System ──────────────────────────────────────────────────────────

function generateInviteLink(phone: string): string {
  // Encode phone as a base64 token for the invite URL
  const token = btoa(`dawinix:${phone}:${Date.now()}`).replace(/=/g, "");
  return `https://wa.me/${PHONE_NUMBER_ID}?text=Hi+Dawinix+AI%21+I+was+invited+by+a+friend.+Code%3A+${token}`;
}

async function checkAndSendInvite(phone: string, totalMessages: number) {
  // After every 5th message, send an invite link
  if (totalMessages > 0 && totalMessages % 5 === 0) {
    const { data: user } = await supabase
      .from("whatsapp_users")
      .select("invite_sent")
      .eq("phone", phone)
      .single();

    // Only send once per 5-message milestone (track via total_messages)
    const inviteLink = generateInviteLink(phone);
    await sendWhatsAppText(phone,
      `🎉 *Enjoying Dawinix AI?*\n\nShare the bot with friends and colleagues!\n\n👉 ${inviteLink}\n\n_Anyone who joins via your link gets the same full AI access you have!_ 🚀`
    );
    await logEvent("invite", "info", `Invite link sent to ${phone} at message #${totalMessages}`);
  }
}

// ── Static Replies ─────────────────────────────────────────────────────────

function getWelcomeMessage(botName: string) {
  return `👋 Welcome to *${botName}* — your intelligent WhatsApp assistant!\n\n🤖 I can help you with:\n\n💬 /ai — Ask me anything\n💻 /code — Generate or fix code\n🎨 /image — Create AI images\n❓ /help — Show all commands\n\nOr just type naturally — I understand plain messages too! 🚀`;
}

function getHelpMessage() {
  return `📋 *Dawinix AI — Commands*\n\n\`/ai [question]\` — Ask anything\n\`/code [task]\` — Generate Python, JS, Node.js, HTML/CSS\n\`/image [prompt]\` — Generate AI images\n\`/start\` — Welcome message\n\`/help\` — This list\n\nOr just type naturally without any command!\n🌍 Languages: English, French, Haitian Creole`;
}

// ── Main Handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const startTime = Date.now();

  // GET: Webhook verification
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
      await logEvent("webhook", "success", "Meta webhook verification successful");
      return new Response(challenge ?? "ok", { headers: corsHeaders });
    }
    await logEvent("webhook", "error", "Webhook verification failed — invalid token");
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // POST: Incoming messages
  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return new Response("Bad Request", { status: 400, headers: corsHeaders });
    }

    await logEvent("webhook", "success", `Webhook POST received in ${Date.now() - startTime}ms`, body);

    if (body.object !== "whatsapp_business_account") {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const entry = (body.entry as Record<string, unknown>[])?.[0];
    const change = (entry?.changes as Record<string, unknown>[])?.[0];
    const value = change?.value as Record<string, unknown>;
    const message = (value?.messages as Record<string, unknown>[])?.[0];

    if (!message || message.type !== "text") {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const from = message.from as string;
    const textObj = message.text as { body: string };
    const text = textObj.body?.trim() ?? "";
    const contactName = ((value?.contacts as Record<string, unknown>[])?.[0]?.profile as Record<string, unknown>)?.name as string | undefined;

    await logEvent("message", "info", `New message from ${from}: "${text.slice(0, 80)}"`);

    // Setup user and conversation
    const userRecord = await upsertUser(from, contactName);
    const conversation = await getOrCreateConversation(from, contactName);
    const newTotal = (userRecord?.total_messages ?? 0) + 1;

    // Save user message
    await supabase.from("messages").insert({
      conversation_id: conversation?.id,
      phone: from,
      role: "user",
      content: text,
      command: text.startsWith("/") ? text.split(" ")[0] : "text",
    });

    // Update conversation
    await supabase.from("conversations").update({
      last_message: text.slice(0, 100),
      last_message_at: new Date().toISOString(),
      message_count: (conversation?.message_count ?? 0) + 1,
    }).eq("phone", from);

    const lower = text.toLowerCase().trim();
    const systemPrompt = await getBotConfig("system_prompt", "You are Dawinix AI, a helpful WhatsApp assistant.");
    const botName = await getBotConfig("bot_name", "Dawinix AI");
    const fallback = await getBotConfig("fallback_message", "Sorry, I could not process your request. 🙏");

    let reply = "";
    let imageUrl: string | null = null;

    try {
      if (lower === "/start") {
        reply = getWelcomeMessage(botName);
        await logEvent("command", "success", `/start by ${from}`);
      } else if (lower === "/help") {
        reply = getHelpMessage();
        await logEvent("command", "success", `/help by ${from}`);
      } else if (lower.startsWith("/code ")) {
        const { text: codeReply, elapsed } = await generateCode(text.slice(6));
        reply = codeReply;
        await logEvent("command", "success", `/code by ${from} — ${elapsed}ms`);
        await supabase.from("whatsapp_users").update({ commands_used: (userRecord?.commands_used ?? 0) + 1 }).eq("phone", from);
      } else if (lower.startsWith("/ai ")) {
        const context = await getContextMessages(from);
        const { text: aiReply, elapsed } = await callAI([...context, { role: "user", content: text.slice(4) }], systemPrompt);
        reply = aiReply;
        await logEvent("command", "success", `/ai by ${from} — ${elapsed}ms`);
        await supabase.from("whatsapp_users").update({ commands_used: (userRecord?.commands_used ?? 0) + 1 }).eq("phone", from);
      } else if (lower.startsWith("/image ")) {
        const imgPrompt = text.slice(7);
        reply = `🎨 Generating your image: _"${imgPrompt}"_\n\nPlease wait a moment...`;
        await sendWhatsAppText(from, reply);

        try {
          imageUrl = await generateImage(imgPrompt, from);
          await sendWhatsAppImage(from, imageUrl, `🎨 *AI Generated:* ${imgPrompt}`);
          // Save bot message with image_url
          await supabase.from("messages").insert({
            conversation_id: conversation?.id,
            phone: from,
            role: "bot",
            content: `🎨 Image generated for: "${imgPrompt}"`,
            command: "/image",
            image_url: imageUrl,
          });
          await logEvent("command", "success", `/image generated for ${from}`, { prompt: imgPrompt });
        } catch (imgErr) {
          const errMsg = imgErr instanceof Error ? imgErr.message : String(imgErr);
          await sendWhatsAppText(from, `❌ Image generation failed: ${errMsg}\n\nPlease try again with a different prompt.`);
          await logEvent("command", "error", `/image failed for ${from}: ${errMsg}`);
        }
        // Invite check
        await checkAndSendInvite(from, newTotal);
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // Custom command check
        const customReply = await checkCustomCommand(text);
        if (customReply) {
          reply = customReply;
          await logEvent("command", "success", `Custom command matched for ${from}`);
        } else {
          // Plain text → AI
          const context = await getContextMessages(from);
          const { text: aiReply, elapsed } = await callAI([...context, { role: "user", content: text }], systemPrompt);
          reply = aiReply;
          await logEvent("message", "success", `AI responded to ${from} in ${elapsed}ms`);
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      reply = fallback;
      await logEvent("error", "error", `Processing failed for ${from}: ${errMsg}`);
    }

    // Save bot reply
    await supabase.from("messages").insert({
      conversation_id: conversation?.id,
      phone: from,
      role: "bot",
      content: reply,
    });

    // Send reply
    await sendWhatsAppText(from, reply);

    // Check invite after every 5 messages
    await checkAndSendInvite(from, newTotal);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
});
