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

async function logEvent(type: string, severity: string, message: string, metadata?: unknown) {
  await supabase.from("system_logs").insert({
    type, severity, message,
    metadata: metadata ?? null,
  });
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
  } else {
    await supabase.from("whatsapp_users").insert({
      phone, name: name ?? phone, status: "active",
    });
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

async function getBotConfig(key: string, fallback: string) {
  const { data } = await supabase.from("bot_config").select("value").eq("key", key).single();
  return data ? (JSON.parse(JSON.stringify(data.value)) as string) : fallback;
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
  const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  const data = await response.json();
  const elapsed = Date.now() - start;
  const text = data.choices?.[0]?.message?.content ?? "";
  return { text, elapsed };
}

async function generateCode(prompt: string) {
  const { text, elapsed } = await callAI(
    [{ role: "user", content: prompt }],
    "You are an expert code generator. Provide clean, well-commented code with a brief explanation. Support Python, JavaScript, Node.js, HTML/CSS. Use markdown code blocks."
  );
  return { text: `💻 *Code Generated:*\n\n${text}`, elapsed };
}

async function sendWhatsAppMessage(to: string, body: string) {
  await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
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
}

function getWelcomeMessage(botName: string) {
  return `👋 Welcome to *${botName}* — your intelligent WhatsApp assistant!\n\n🤖 I can help you with:\n• 💬 /ai — Ask me anything\n• 💻 /code — Generate or fix code\n• 🎨 /image — Create AI images\n• ❓ /help — Show commands\n\nOr just type naturally — I understand plain messages too! 🚀`;
}

function getHelpMessage() {
  return `📋 *Dawinix AI — Commands*\n\n\`/ai [question]\` — Ask anything\n\`/code [task]\` — Generate Python, JS, Node.js, HTML/CSS\n\`/image [prompt]\` — Generate AI images\n\`/start\` — Welcome message\n\`/help\` — This list\n\nOr just type naturally without any command!\n🌍 Languages: English, French, Haitian Creole`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const startTime = Date.now();

  // ── GET: Webhook Verification ──────────────────────────────────────────────
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
      await logEvent("webhook", "success", "Meta webhook verification successful — handshake complete");
      return new Response(challenge ?? "ok", { headers: corsHeaders });
    }
    await logEvent("webhook", "error", "Webhook verification failed — invalid verify token");
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // ── POST: Incoming Messages ────────────────────────────────────────────────
  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response("Bad Request", { status: 400, headers: corsHeaders });
    }

    const elapsed_webhook = Date.now() - startTime;
    await logEvent("webhook", "success", `Webhook POST received — processed in ${elapsed_webhook}ms`, body);

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

    await logEvent("message", "info", `New message from ${from}: ${text.slice(0, 80)}`);

    // Setup user and conversation
    await upsertUser(from, contactName);
    const conversation = await getOrCreateConversation(from, contactName);

    // Save user message
    await supabase.from("messages").insert({
      conversation_id: conversation?.id,
      phone: from,
      role: "user",
      content: text,
      command: text.startsWith("/") ? text.split(" ")[0] : "text",
    });

    // Update conversation stats
    await supabase.from("conversations").update({
      last_message: text.slice(0, 100),
      last_message_at: new Date().toISOString(),
      message_count: (conversation?.message_count ?? 0) + 1,
    }).eq("phone", from);

    let reply = "";
    const lower = text.toLowerCase().trim();
    const systemPrompt = await getBotConfig("system_prompt", "You are Dawinix AI, a helpful WhatsApp assistant.");
    const botName = await getBotConfig("bot_name", "Dawinix AI");
    const fallback = await getBotConfig("fallback_message", "Sorry, I could not process your request. 🙏");

    try {
      // Route message
      if (lower === "/start") {
        reply = getWelcomeMessage(botName);
        await logEvent("command", "success", `/start executed by ${from}`);
      } else if (lower === "/help") {
        reply = getHelpMessage();
        await logEvent("command", "success", `/help executed by ${from}`);
      } else if (lower.startsWith("/code ")) {
        const prompt = text.slice(6);
        const { text: codeReply, elapsed } = await generateCode(prompt);
        reply = codeReply;
        await logEvent("command", "success", `/code executed by ${from} — response in ${elapsed}ms`);
        await supabase.from("whatsapp_users").update({ commands_used: 1 }).eq("phone", from);
      } else if (lower.startsWith("/ai ")) {
        const prompt = text.slice(4);
        const context = await getContextMessages(from);
        const { text: aiReply, elapsed } = await callAI([...context, { role: "user", content: prompt }], systemPrompt as string);
        reply = aiReply;
        await logEvent("command", "success", `/ai executed by ${from} — response in ${elapsed}ms`);
        await supabase.from("whatsapp_users").update({ commands_used: 1 }).eq("phone", from);
      } else if (lower.startsWith("/image ")) {
        reply = `🎨 Image generation coming soon! Use /ai for smart answers or /code for code generation.`;
        await logEvent("command", "info", `/image requested by ${from} — feature placeholder`);
      } else {
        // Check custom commands first
        const customReply = await checkCustomCommand(text);
        if (customReply) {
          reply = customReply;
          await logEvent("command", "success", `Custom command matched for ${from}`);
        } else {
          // Plain text → AI
          const context = await getContextMessages(from);
          const { text: aiReply, elapsed } = await callAI([...context, { role: "user", content: text }], systemPrompt as string);
          reply = aiReply;
          await logEvent("message", "success", `AI responded to plain text from ${from} in ${elapsed}ms`);
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      reply = fallback as string;
      await logEvent("error", "error", `AI processing failed for ${from}: ${errMsg}`);
    }

    // Save bot reply
    await supabase.from("messages").insert({
      conversation_id: conversation?.id,
      phone: from,
      role: "bot",
      content: reply,
    });

    // Send WhatsApp reply
    await sendWhatsAppMessage(from, reply);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
});
