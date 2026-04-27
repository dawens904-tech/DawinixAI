import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);
const AI_API_KEY = Deno.env.get("ONSPACE_AI_API_KEY") ?? "";
const AI_BASE_URL = Deno.env.get("ONSPACE_AI_BASE_URL") ?? "";

async function logEvent(type: string, severity: string, message: string, metadata?: unknown) {
  await supabase.from("system_logs").insert({ type, severity, message, metadata: metadata ?? null });
}

async function getBotConfig(key: string, fallback: string) {
  const { data } = await supabase.from("bot_config").select("value").eq("key", key).single();
  return data ? (JSON.parse(JSON.stringify(data.value)) as string) : fallback;
}

async function checkCustomCommand(text: string) {
  const lower = text.toLowerCase().trim();
  const { data: commands } = await supabase.from("custom_commands").select("*").eq("is_active", true);
  if (!commands) return null;
  for (const cmd of commands) {
    if (lower === cmd.command) return cmd.response_template;
    if (cmd.trigger_keywords?.some((kw: string) => lower.includes(kw.toLowerCase()))) return cmd.response_template;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  let body: { message: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400, headers: corsHeaders });
  }

  const { message, phone = "simulator_test" } = body;
  if (!message) {
    return new Response(JSON.stringify({ error: "message is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const pipeline: { step: string; status: string; detail: string; duration: number }[] = [];
  const t0 = Date.now();

  // Step 1: Webhook receipt
  await new Promise((r) => setTimeout(r, 80 + Math.random() * 60));
  const t1 = Date.now();
  pipeline.push({ step: "Webhook Receipt", status: "success", detail: `POST /webhook received from ${phone}`, duration: t1 - t0 });
  await logEvent("webhook", "info", `[Simulator] Test message received: "${message.slice(0, 60)}"`, { phone, message });

  // Step 2: Message parsing
  await new Promise((r) => setTimeout(r, 30));
  const t2 = Date.now();
  const lower = message.toLowerCase().trim();
  let commandType = "text";
  if (lower === "/start") commandType = "/start";
  else if (lower === "/help") commandType = "/help";
  else if (lower.startsWith("/ai ")) commandType = "/ai";
  else if (lower.startsWith("/code ")) commandType = "/code";
  else if (lower.startsWith("/image ")) commandType = "/image";
  else if (lower.startsWith("/")) commandType = "custom";
  pipeline.push({ step: "Message Parsing", status: "success", detail: `Command type detected: ${commandType}`, duration: t2 - t1 });

  // Step 3: Command routing
  await new Promise((r) => setTimeout(r, 20));
  const t3 = Date.now();
  pipeline.push({ step: "Command Router", status: "success", detail: `Routing to handler: ${commandType}`, duration: t3 - t2 });

  // Step 4: AI / custom processing
  let reply = "";
  let aiModel = "none";
  let processingStatus = "success";
  let processingDetail = "";

  const systemPrompt = await getBotConfig("system_prompt", "You are Dawinix AI, a helpful WhatsApp assistant.");
  const botName = await getBotConfig("bot_name", "Dawinix AI");

  try {
    if (lower === "/start") {
      reply = `👋 Welcome to *${botName}*!\n\n🤖 Commands:\n• /ai — Ask anything\n• /code — Generate code\n• /image — Create images\n• /help — All commands\n\nOr just type naturally! 🚀`;
      processingDetail = "Static welcome message returned";
    } else if (lower === "/help") {
      reply = `📋 *${botName} — Commands*\n\n\`/ai [question]\` — AI answers\n\`/code [task]\` — Generate code\n\`/image [prompt]\` — AI images\n\`/start\` — Welcome\n\`/help\` — This list\n\nOr just type naturally!`;
      processingDetail = "Static help message returned";
    } else if (lower.startsWith("/code ")) {
      const prompt = message.slice(6);
      aiModel = "google/gemini-3-flash-preview";
      const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${AI_API_KEY}` },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            { role: "system", content: "You are an expert code generator. Provide clean, well-commented code with a brief explanation. Use markdown code blocks." },
            { role: "user", content: prompt },
          ],
        }),
      });
      const data = await res.json();
      reply = `💻 *Code Generated:*\n\n${data.choices?.[0]?.message?.content ?? "Error generating code"}`;
      processingDetail = `OnSpace AI (${aiModel}) generated code response`;
    } else if (lower.startsWith("/image ")) {
      const imgPrompt = message.slice(7);
      aiModel = "google/gemini-2.5-flash-image";
      try {
        const imgRes = await fetch(`${AI_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${AI_API_KEY}` },
          body: JSON.stringify({
            model: aiModel,
            modalities: ["image", "text"],
            messages: [{ role: "user", content: imgPrompt }],
            image_config: { aspect_ratio: "1:1", image_size: "1K" },
          }),
        });
        const imgData = await imgRes.json();
        const imageDataUrl: string = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? "";
        if (imageDataUrl) {
          // Upload to storage
          const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
          const blob = new Blob([bytes], { type: "image/png" });
          const fileName = `simulator/${crypto.randomUUID()}.png`;
          const { error: uploadErr } = await supabase.storage.from("generated-images").upload(fileName, blob, { contentType: "image/png", upsert: false });
          if (!uploadErr) {
            const { data: { publicUrl } } = supabase.storage.from("generated-images").getPublicUrl(fileName);
            reply = `🎨 *AI Image Generated!*\n\n📎 ${publicUrl}\n\n_Prompt: "${imgPrompt}"_`;
          } else {
            reply = `🎨 Image generated but upload failed: ${uploadErr.message}`;
          }
        } else {
          reply = `🎨 Image generation returned no data. Try a different prompt.`;
        }
        processingDetail = `OnSpace AI (${aiModel}) generated image`;
      } catch (imgErr) {
        reply = `❌ Image generation error: ${imgErr instanceof Error ? imgErr.message : String(imgErr)}`;
        processingDetail = `Image generation failed`;
        processingStatus = "error";
      }
    } else {
      // Check custom commands
      const customReply = await checkCustomCommand(message);
      if (customReply) {
        reply = customReply;
        processingDetail = "Custom command matched from database";
      } else {
        // AI chat
        const prompt = lower.startsWith("/ai ") ? message.slice(4) : message;
        aiModel = "google/gemini-3-flash-preview";
        const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${AI_API_KEY}` },
          body: JSON.stringify({
            model: aiModel,
            messages: [
              { role: "system", content: systemPrompt as string },
              { role: "user", content: prompt },
            ],
          }),
        });
        const data = await res.json();
        reply = data.choices?.[0]?.message?.content ?? "I couldn't process that request.";
        processingDetail = `OnSpace AI (${aiModel}) generated response`;
      }
    }
  } catch (err) {
    processingStatus = "error";
    processingDetail = `AI error: ${err instanceof Error ? err.message : String(err)}`;
    reply = "Sorry, an error occurred. Please try again. 🙏";
  }

  const t4 = Date.now();
  pipeline.push({
    step: "AI Processing",
    status: processingStatus,
    detail: processingDetail + (aiModel !== "none" ? ` | Model: ${aiModel}` : ""),
    duration: t4 - t3,
  });

  await logEvent("command", processingStatus === "success" ? "success" : "error",
    `[Simulator] AI processed "${commandType}" in ${t4 - t3}ms`, { model: aiModel, phone });

  // Step 5: Response dispatch (simulated)
  await new Promise((r) => setTimeout(r, 40));
  const t5 = Date.now();
  pipeline.push({ step: "Response Dispatch", status: "success", detail: "Reply formatted and ready (WhatsApp send simulated)", duration: t5 - t4 });

  await logEvent("message", "success", `[Simulator] Response dispatched in ${t5 - t0}ms total`);

  const totalDuration = t5 - t0;

  return new Response(
    JSON.stringify({ success: true, reply, pipeline, totalDuration, aiModel }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
