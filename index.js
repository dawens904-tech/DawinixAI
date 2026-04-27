require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { OpenAI } = require("openai");

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const userContexts = {}; // In-memory conversation memory

// ── Webhook Verification (GET) ──────────────────────────────────────────────
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log("✅ Webhook verified by Meta");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ── Incoming Messages (POST) ─────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Acknowledge immediately

  const body = req.body;
  if (body.object !== "whatsapp_business_account") return;

  const entry = body.entry?.[0]?.changes?.[0]?.value;
  const message = entry?.messages?.[0];
  if (!message || message.type !== "text") return;

  const from = message.from;
  const text = message.text.body.trim();

  console.log(`📩 Message from ${from}: ${text}`);

  try {
    const reply = await processMessage(from, text);
    await sendMessage(from, reply);
  } catch (err) {
    console.error("Error processing message:", err.message);
    await sendMessage(from, process.env.FALLBACK_MESSAGE || "Sorry, an error occurred 🙏");
  }
});

// ── Message Router ────────────────────────────────────────────────────────────
async function processMessage(userId, text) {
  const lower = text.toLowerCase();

  if (lower === "/start") return getWelcomeMessage();
  if (lower === "/help") return getHelpMessage();
  if (lower.startsWith("/image ")) return await generateImage(text.slice(7));
  if (lower.startsWith("/code ")) return await generateCode(userId, text.slice(6));
  if (lower.startsWith("/ai ")) return await chatWithAI(userId, text.slice(4));

  // Default: treat as AI chat
  return await chatWithAI(userId, text);
}

// ── AI Chat (with memory) ─────────────────────────────────────────────────────
async function chatWithAI(userId, userMessage) {
  if (!userContexts[userId]) userContexts[userId] = [];

  userContexts[userId].push({ role: "user", content: userMessage });

  // Keep last 10 messages for context
  if (userContexts[userId].length > 10) userContexts[userId].shift();

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are Dawinix AI, a smart and helpful WhatsApp assistant. Respond clearly and concisely. You support English, French, and Haitian Creole. For code, use clear formatting with comments."
      },
      ...userContexts[userId]
    ],
    max_tokens: 1000,
  });

  const reply = response.choices[0].message.content;
  userContexts[userId].push({ role: "assistant", content: reply });
  return reply;
}

// ── Code Generation ───────────────────────────────────────────────────────────
async function generateCode(userId, prompt) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert code generator. Provide clean, well-commented code with a brief explanation. Support Python, JavaScript, Node.js, HTML/CSS." },
      { role: "user", content: prompt }
    ],
    max_tokens: 1500,
  });
  return "💻 *Code Generated:*\n\n" + response.choices[0].message.content;
}

// ── Image Generation ──────────────────────────────────────────────────────────
async function generateImage(prompt) {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    n: 1,
    size: "1024x1024",
  });
  const imageUrl = response.data[0].url;
  return `🎨 *Image Generated!*\n\nPrompt: "${prompt}"\n🖼️ ${imageUrl}`;
}

// ── WhatsApp Message Sender ───────────────────────────────────────────────────
async function sendMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text.slice(0, 4096) }, // WhatsApp text limit
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
}

// ── Welcome & Help Messages ───────────────────────────────────────────────────
function getWelcomeMessage() {
  return `👋 Welcome to *Dawinix AI* — your intelligent WhatsApp assistant!

🤖 I can help you with:
• 💬 /ai — Ask me anything
• 💻 /code — Generate or fix code
• 🎨 /image — Create AI images
• ❓ /help — Show commands

Just type naturally or use a command. Let's go! 🚀`;
}

function getHelpMessage() {
  return `📋 *Dawinix AI — Commands*

\`/ai [question]\` — Ask anything, get smart answers
\`/code [task]\` — Generate Python, JS, Node.js, HTML/CSS code
\`/image [prompt]\` — Generate AI images with DALL·E 3
\`/start\` — Welcome message
\`/help\` — This command list

💡 You can also just type naturally without commands!
Languages supported: English, French, Haitian Creole 🌍`;
}

app.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 Dawinix AI bot running on port ${process.env.PORT || 3000}`);
});
