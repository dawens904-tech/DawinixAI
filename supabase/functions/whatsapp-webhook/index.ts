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
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const AI_API_KEY = Deno.env.get("ONSPACE_AI_API_KEY") ?? "";
const AI_BASE_URL = Deno.env.get("ONSPACE_AI_BASE_URL") ?? "";

// ── Helpers ────────────────────────────────────────────────────────────────

async function logEvent(type: string, severity: string, message: string, metadata?: unknown) {
  try {
    await supabase.from("system_logs").insert({ type, severity, message, metadata: metadata ?? null });
  } catch { /* non-critical */ }
}

async function getBotConfig(key: string, fallback: string): Promise<string> {
  const { data } = await supabase.from("bot_config").select("value").eq("key", key).single();
  if (!data) return fallback;
  const v = data.value;
  return typeof v === "string" ? v : JSON.stringify(v);
}

async function getBotConfigBool(key: string, fallback: boolean): Promise<boolean> {
  const { data } = await supabase.from("bot_config").select("value").eq("key", key).single();
  if (!data) return fallback;
  const v = data.value;
  return v === true || v === "true";
}

async function getBotConfigNum(key: string, fallback: number): Promise<number> {
  const { data } = await supabase.from("bot_config").select("value").eq("key", key).single();
  if (!data) return fallback;
  const v = Number(data.value);
  return isNaN(v) ? fallback : v;
}

async function getOrCreateConversation(phone: string, name?: string, isGroup = false, groupId?: string) {
  const lookupPhone = isGroup && groupId ? groupId : phone;
  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .eq("phone", lookupPhone)
    .single();
  if (existing) return existing;
  const { data: created } = await supabase
    .from("conversations")
    .insert({
      phone: lookupPhone,
      user_name: name ?? lookupPhone,
      last_message: "Started conversation",
    })
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
  }
  const { data: created } = await supabase
    .from("whatsapp_users")
    .insert({ phone, name: name ?? phone, status: "active" })
    .select()
    .single();
  return created;
}

async function getContextMessages(phone: string, limit = 10): Promise<{ role: string; content: string }[]> {
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

async function checkCustomCommand(text: string): Promise<string | null> {
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

// ── AI Engine — OpenAI (primary) with OnSpace AI fallback ──────────────────

async function callOpenAI(
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<{ text: string; elapsed: number }> {
  const start = Date.now();

  // Try OpenAI first if key exists
  if (OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          max_tokens: 1500,
          temperature: 0.7,
        }),
      });
      const data = await res.json();
      if (res.ok && data.choices?.[0]?.message?.content) {
        return { text: data.choices[0].message.content.trim(), elapsed: Date.now() - start };
      }
      console.log("[AI] OpenAI error, falling back:", data?.error?.message);
    } catch (err) {
      console.log("[AI] OpenAI fetch failed, falling back:", err);
    }
  }

  // Fallback: OnSpace AI (Gemini 3 Flash)
  const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content?.trim() ?? "", elapsed: Date.now() - start };
}

async function generateCode(prompt: string): Promise<{ text: string; elapsed: number }> {
  const { text, elapsed } = await callOpenAI(
    [{ role: "user", content: prompt }],
    "You are an expert code generator. Provide clean, well-commented code with explanations. Support Python, JavaScript, Node.js, HTML/CSS. Use markdown code blocks."
  );
  return { text: `💻 *Code Generated:*\n\n${text}`, elapsed };
}

// ── Image Generation (OnSpace AI) ───────────────────────────────────────────

async function generateImage(prompt: string, phone: string): Promise<string> {
  await logEvent("command", "info", `[Image] Generating for ${phone}: "${prompt.slice(0, 60)}"`);

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
  if (!imageDataUrl) throw new Error("No image returned from AI");

  const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const blob = new Blob([bytes], { type: "image/png" });

  const fileName = `${phone}/${crypto.randomUUID()}.png`;
  const { error: uploadError } = await supabase.storage
    .from("generated-images")
    .upload(fileName, blob, { contentType: "image/png", cacheControl: "3600", upsert: false });
  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage.from("generated-images").getPublicUrl(fileName);
  await logEvent("command", "success", `[Image] Generated for ${phone}`, { publicUrl: publicUrl.slice(0, 80) });
  return publicUrl;
}

// ── WhatsApp Messaging ─────────────────────────────────────────────────────

async function sendWhatsAppText(to: string, body: string) {
  const res = await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: body.slice(0, 4096) },
    }),
  });
  return res.ok;
}

// Split and send long messages in chunks (WhatsApp limit: 4096 chars)
async function sendSplitMessage(to: string, text: string) {
  const MAX = 3800; // leave headroom for part labels
  if (text.length <= MAX) {
    await sendWhatsAppText(to, text);
    return;
  }
  // Split on double-newlines or sentence boundaries for natural breaks
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > MAX) {
    let splitAt = remaining.lastIndexOf("\n\n", MAX);
    if (splitAt < MAX * 0.5) splitAt = remaining.lastIndexOf(". ", MAX);
    if (splitAt < MAX * 0.5) splitAt = MAX;
    parts.push(remaining.slice(0, splitAt + 1).trim());
    remaining = remaining.slice(splitAt + 1).trim();
  }
  if (remaining.length > 0) parts.push(remaining);

  for (let i = 0; i < parts.length; i++) {
    const prefix = parts.length > 1 ? `_(${i + 1}/${parts.length})_\n\n` : "";
    await sendWhatsAppText(to, prefix + parts[i]);
    if (i < parts.length - 1) await new Promise((r) => setTimeout(r, 500)); // brief delay between parts
  }
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

// ── Group Chat Logic ───────────────────────────────────────────────────────

interface GroupInfo {
  isGroup: boolean;
  groupId: string | null;
  groupName: string | null;
  mentionedBot: boolean;
  cleanText: string; // text with @mention removed
}

function parseGroupInfo(
  message: Record<string, unknown>,
  value: Record<string, unknown>,
  botPhoneId: string,
  botName: string
): GroupInfo {
  const contextObj = message.context as Record<string, unknown> | undefined;
  const groupId = (message.group_id as string) ?? null;

  // Check if this is a group message via group_id in context or top-level group_id
  const isGroup = !!groupId;

  // Parse group name from metadata
  const metadata = value.metadata as Record<string, unknown> | undefined;
  const groupName = (metadata?.display_phone_number as string) ?? null;

  const textBody = ((message.text as Record<string, unknown>)?.body as string ?? "").trim();

  // Check if bot was mentioned: @phone_number or @bot_name
  const mentionRegex = new RegExp(
    `@${botPhoneId}|@${botName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    "gi"
  );
  const mentionedBot = mentionRegex.test(textBody);
  const cleanText = textBody.replace(mentionRegex, "").trim();

  return { isGroup, groupId, groupName, mentionedBot, cleanText };
}

// ── Invite System ──────────────────────────────────────────────────────────

function generateInviteLink(phone: string): string {
  const token = btoa(`dawinix:${phone}:${Date.now()}`).replace(/=/g, "");
  return `https://wa.me/${PHONE_NUMBER_ID}?text=Hi+Dawinix+AI%21+I+was+invited.+Code%3A+${token}`;
}

async function checkAndSendInvite(phone: string, totalMessages: number, isGroup: boolean) {
  if (isGroup) return; // Don't send invites in group chats
  if (totalMessages > 0 && totalMessages % 5 === 0) {
    const inviteLink = generateInviteLink(phone);
    await sendWhatsAppText(phone,
      `🎉 *Enjoying Dawinix AI?*\n\nShare it with friends!\n\n👉 ${inviteLink}\n\n_Anyone who joins via your link gets the same full AI access!_ 🚀`
    );
    await logEvent("invite", "info", `Invite sent to ${phone} at message #${totalMessages}`);
  }
}

// ── Static Replies ─────────────────────────────────────────────────────────

function getWelcomeMessage(botName: string) {
  return `👋 Welcome to *${botName}* — your intelligent AI assistant!\n\n🤖 Just send me any message and I'll reply instantly.\n\nI can:\n💬 Answer any question\n💻 /code — Generate code (Python, JS, HTML…)\n🎨 /image — Create AI images\n❓ /help — Show commands\n\n🌍 I speak English, French & Haitian Creole!\n\nJust start chatting — no commands needed! 🚀`;
}

function getHelpMessage(botName: string) {
  return `📋 *${botName} — Help*\n\n*Just chat naturally — no commands required!*\n\n*Optional commands:*\n\`/code [task]\` — Generate code\n\`/image [prompt]\` — AI image generation\n\`/start\` — Welcome message\n\`/help\` — This list\n\n*In groups:*\nMention me or reply to my messages to get a response.\n\n🌍 English · Français · Kreyòl Ayisyen`;
}

// ── Main Handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const startTime = Date.now();

  // ── GET: Webhook Verification ──────────────────────────────────────────
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

  // ── POST: Incoming Messages ────────────────────────────────────────────
  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response("Bad Request", { status: 400, headers: corsHeaders });
    }

    if (body.object !== "whatsapp_business_account") {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const entry = (body.entry as Record<string, unknown>[])?.[0];
    const change = (entry?.changes as Record<string, unknown>[])?.[0];
    const value = change?.value as Record<string, unknown>;
    const message = (value?.messages as Record<string, unknown>[])?.[0];

    // Acknowledge non-text messages immediately (status updates, reactions, etc.)
    if (!message) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const msgType = message.type as string;

    // Handle audio/document/video with a polite reply
    if (msgType !== "text" && msgType !== "image") {
      const from = message.from as string;
      if (from) {
        await sendWhatsAppText(
          from,
          "📎 I received your file/media, but I can only process *text messages* right now. Please type your question or request! 💬"
        );
      }
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const from = message.from as string;
    const contactName = (
      (value?.contacts as Record<string, unknown>[])?.[0]?.profile as Record<string, unknown>
    )?.name as string | undefined;

    // ── Load bot config ──────────────────────────────────────────────────
    const [systemPrompt, botName, fallback, maxContextStr, groupModeStr, groupRespondAllStr] =
      await Promise.all([
        getBotConfig("system_prompt", "You are Dawinix AI, a smart and helpful WhatsApp AI assistant. You respond naturally and intelligently to any message. You support English, French, and Haitian Creole."),
        getBotConfig("bot_name", "Dawinix AI"),
        getBotConfig("fallback_message", "Sorry, I could not process your request right now. Please try again. 🙏"),
        getBotConfig("max_context", "10"),
        getBotConfig("group_mode", "mention_only"),      // mention_only | all_messages
        getBotConfig("group_respond_all", "false"),
      ]);

    const maxContext = Math.min(parseInt(maxContextStr) || 10, 20);
    const groupRespondAll = groupRespondAllStr === "true";

    // ── Group detection ──────────────────────────────────────────────────
    let textBody = ((message.text as Record<string, unknown>)?.body as string ?? "").trim();
    let isGroup = false;
    let groupId: string | null = null;
    let mentionedBot = false;

    // WhatsApp Cloud API: group messages have a "group_id" context or the "to" field differs from PHONE_NUMBER_ID
    const to = message.to as string | undefined;
    const ctxMsg = message.context as Record<string, unknown> | undefined;

    // Detect group: the destination is not our PHONE_NUMBER_ID, or group_id exists in context
    if (to && to !== PHONE_NUMBER_ID) {
      isGroup = true;
      groupId = to; // group JID is in "to" field for group messages
    }

    if (isGroup) {
      // Check if bot was mentioned by name or quoted message was from bot
      const botPhoneClean = PHONE_NUMBER_ID.replace(/\D/g, "");
      const nameLower = botName.toLowerCase();
      const bodyLower = textBody.toLowerCase();

      mentionedBot =
        textBody.includes(`@${botPhoneClean}`) ||
        bodyLower.includes(`@${nameLower}`) ||
        bodyLower.includes("@dawinix") ||
        !!(ctxMsg && (ctxMsg.from as string) === PHONE_NUMBER_ID); // reply to bot's message

      // Remove @mention from text
      textBody = textBody
        .replace(new RegExp(`@${botPhoneClean}`, "g"), "")
        .replace(new RegExp(`@${nameLower}`, "gi"), "")
        .replace(/@dawinix/gi, "")
        .trim();

      // Decide if we should respond
      const shouldRespond = groupRespondAll || mentionedBot;
      if (!shouldRespond) {
        // Silently ignore group messages not directed at bot
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
    }

    if (!textBody) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const replyTo = isGroup && groupId ? groupId : from;
    const contextPhone = from; // always use sender's phone for per-user memory

    await logEvent(
      "message",
      "info",
      `${isGroup ? "[Group]" : "[DM]"} ${from}${groupId ? ` in ${groupId}` : ""}: "${textBody.slice(0, 80)}"`,
      { isGroup, groupId, mentionedBot }
    );

    // ── User and conversation setup ──────────────────────────────────────
    const userRecord = await upsertUser(from, contactName);
    const conversation = await getOrCreateConversation(contextPhone, contactName, isGroup, groupId ?? undefined);
    const newTotal = (userRecord?.total_messages ?? 0) + 1;

    // ── Rate limiting ────────────────────────────────────────────────────
    const rateLimit = userRecord?.rate_limit ?? 50;
    // Simple check: count messages in last hour
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count: recentCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("phone", contextPhone)
      .eq("role", "user")
      .gte("created_at", hourAgo);

    if ((recentCount ?? 0) >= rateLimit) {
      await sendWhatsAppText(
        replyTo,
        `⚠️ You've reached your message limit (${rateLimit}/hour). Please wait a bit before sending more messages.`
      );
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Save incoming message ────────────────────────────────────────────
    await supabase.from("messages").insert({
      conversation_id: conversation?.id,
      phone: contextPhone,
      role: "user",
      content: textBody,
      command: textBody.startsWith("/") ? textBody.split(" ")[0] : "text",
    });

    await supabase.from("conversations").update({
      last_message: textBody.slice(0, 100),
      last_message_at: new Date().toISOString(),
      message_count: (conversation?.message_count ?? 0) + 1,
    }).eq("phone", isGroup && groupId ? groupId : contextPhone);

    const lower = textBody.toLowerCase().trim();
    let reply = "";
    let imageUrl: string | null = null;

    try {
      // ── Command routing ────────────────────────────────────────────────
      if (lower === "/start") {
        reply = getWelcomeMessage(botName);
        await logEvent("command", "success", `/start by ${from}`);

      } else if (lower === "/help") {
        reply = getHelpMessage(botName);
        await logEvent("command", "success", `/help by ${from}`);

      } else if (lower.startsWith("/code ") || lower.startsWith("/code\n")) {
        const prompt = textBody.slice(6).trim();
        const { text: codeReply, elapsed } = await generateCode(prompt);
        reply = codeReply;
        await logEvent("command", "success", `/code by ${from} — ${elapsed}ms`);
        await supabase.from("whatsapp_users")
          .update({ commands_used: (userRecord?.commands_used ?? 0) + 1 })
          .eq("phone", from);

      } else if (lower.startsWith("/image ") || lower.startsWith("/image\n")) {
        const imgPrompt = textBody.slice(7).trim();

        // Send "generating..." message
        await sendWhatsAppText(replyTo, `🎨 Generating: _"${imgPrompt}"_\n\nPlease wait...`);

        try {
          imageUrl = await generateImage(imgPrompt, contextPhone);
          await sendWhatsAppImage(replyTo, imageUrl, `🎨 *AI Generated:* ${imgPrompt}`);
          await supabase.from("messages").insert({
            conversation_id: conversation?.id,
            phone: contextPhone,
            role: "bot",
            content: `🎨 Image generated for: "${imgPrompt}"`,
            command: "/image",
            image_url: imageUrl,
          });
          await logEvent("command", "success", `/image for ${from}`, { prompt: imgPrompt });
        } catch (imgErr) {
          const errMsg = imgErr instanceof Error ? imgErr.message : String(imgErr);
          await sendWhatsAppText(replyTo, `❌ Image generation failed: ${errMsg}\n\nTry a different prompt.`);
          await logEvent("command", "error", `/image failed for ${from}: ${errMsg}`);
        }

        await checkAndSendInvite(from, newTotal, isGroup);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } else {
        // ── Natural conversation (no command) ──────────────────────────
        // Check custom commands first
        const customReply = await checkCustomCommand(textBody);
        if (customReply) {
          reply = customReply;
          await logEvent("command", "success", `Custom command matched for ${from}`);
        } else {
          // Full AI conversation with context memory
          const context = await getContextMessages(contextPhone, maxContext);

          // Enhance system prompt for group awareness
          let effectivePrompt = systemPrompt;
          if (isGroup) {
            effectivePrompt += `\n\nYou are currently responding in a WhatsApp group chat. Keep responses concise and relevant. The user who addressed you is ${contactName ?? from}.`;
          }

          const { text: aiReply, elapsed } = await callOpenAI(
            [...context, { role: "user", content: textBody }],
            effectivePrompt
          );
          reply = aiReply;
          await logEvent("message", "success", `AI replied to ${from} in ${elapsed}ms`, { isGroup, model: OPENAI_API_KEY ? "gpt-4o-mini" : "gemini-3-flash" });
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      reply = fallback;
      await logEvent("error", "error", `Processing failed for ${from}: ${errMsg}`, { textBody });
    }

    // ── Save bot reply ───────────────────────────────────────────────────
    await supabase.from("messages").insert({
      conversation_id: conversation?.id,
      phone: contextPhone,
      role: "bot",
      content: reply,
    });

    // ── Send reply (with auto-splitting for long responses) ──────────────
    await sendSplitMessage(replyTo, reply);

    // ── Invite check (DMs only) ──────────────────────────────────────────
    await checkAndSendInvite(from, newTotal, isGroup);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
});
