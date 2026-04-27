import { useState } from "react";
import { cn } from "@/lib/utils";
import { Copy, Check, ExternalLink, BookOpen, Server, Webhook, Bot, Rocket, Terminal } from "lucide-react";

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-xl bg-dark-900 border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-dark-800">
        <span className="text-[10px] font-mono text-muted-foreground">{lang}</span>
        <button onClick={handleCopy} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="p-4 text-[11px] font-mono text-foreground overflow-x-auto leading-relaxed scrollbar-thin">
        {code}
      </pre>
    </div>
  );
}

function Step({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(num === 1);
  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-secondary/30 transition-colors"
      >
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0", open ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
          {num}
        </div>
        <span className={cn("text-sm font-semibold", open ? "text-foreground" : "text-muted-foreground")}>{title}</span>
        <div className={cn("ml-auto w-5 h-5 rounded-full border flex items-center justify-center text-xs transition-all", open ? "border-primary text-primary rotate-180" : "border-border text-muted-foreground")}>
          ▾
        </div>
      </button>
      {open && <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">{children}</div>}
    </div>
  );
}

export default function SetupGuide() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[860px] mx-auto">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Setup & Deployment Guide</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Complete step-by-step guide to deploy Dawinix AI WhatsApp chatbot from scratch</p>
        </div>
      </div>

      {/* Overview */}
      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-5">
        <div className="flex items-start gap-3">
          <Bot className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-primary">Architecture Overview</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Dawinix AI uses the <strong className="text-foreground">WhatsApp Cloud API (Meta)</strong> to receive and send messages via a webhook server.
              Incoming messages are processed by an AI model (GPT-4o or similar), and responses — including code and images — are sent back to the user's WhatsApp.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { label: "WhatsApp Cloud API", icon: <Webhook className="w-3 h-3" /> },
                { label: "Node.js Server", icon: <Server className="w-3 h-3" /> },
                { label: "OpenAI GPT-4o", icon: <Bot className="w-3 h-3" /> },
                { label: "DALL·E 3", icon: <Rocket className="w-3 h-3" /> },
              ].map(({ label, icon }) => (
                <span key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-[11px] text-muted-foreground border border-border">
                  {icon}{label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        <Step num={1} title="Set up Meta Developer App & WhatsApp Business">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Go to <a href="https://developers.facebook.com" target="_blank" rel="noopener" className="text-primary underline">developers.facebook.com</a>, create a new App,
            add the <strong className="text-foreground">WhatsApp</strong> product, and complete the Business verification.
            Note your <strong className="text-foreground">Phone Number ID</strong> and generate a <strong className="text-foreground">Permanent System User Token</strong>.
          </p>
          <div className="flex gap-2 flex-wrap">
            <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener"
              className="flex items-center gap-1.5 text-[11px] text-primary px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors">
              <ExternalLink className="w-3 h-3" />Meta Cloud API Docs
            </a>
          </div>
        </Step>

        <Step num={2} title="Create the Node.js Webhook Server">
          <p className="text-xs text-muted-foreground">Initialize a Node.js project and install dependencies:</p>
          <CodeBlock lang="bash" code={`mkdir dawinix-bot && cd dawinix-bot
npm init -y
npm install express axios openai dotenv`} />
          <p className="text-xs text-muted-foreground mt-2">Create <span className="font-mono text-foreground">.env</span> file:</p>
          <CodeBlock lang=".env" code={`PHONE_NUMBER_ID=your_phone_number_id
ACCESS_TOKEN=your_whatsapp_access_token
WEBHOOK_VERIFY_TOKEN=dawinix_verify_2025
OPENAI_API_KEY=sk-your-openai-key
PORT=3000`} />
        </Step>

        <Step num={3} title="Implement the Webhook Handler (index.js)">
          <CodeBlock lang="javascript" code={`require("dotenv").config();
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

  console.log(\`📩 Message from \${from}: \${text}\`);

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
  return "💻 *Code Generated:*\\n\\n" + response.choices[0].message.content;
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
  return \`🎨 *Image Generated!*\\n\\nPrompt: "\${prompt}"\\n🖼️ \${imageUrl}\`;
}

// ── WhatsApp Message Sender ───────────────────────────────────────────────────
async function sendMessage(to, text) {
  await axios.post(
    \`https://graph.facebook.com/v19.0/\${process.env.PHONE_NUMBER_ID}/messages\`,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text.slice(0, 4096) }, // WhatsApp text limit
    },
    {
      headers: {
        Authorization: \`Bearer \${process.env.ACCESS_TOKEN}\`,
        "Content-Type": "application/json",
      },
    }
  );
}

// ── Welcome & Help Messages ───────────────────────────────────────────────────
function getWelcomeMessage() {
  return \`👋 Welcome to *Dawinix AI* — your intelligent WhatsApp assistant!

🤖 I can help you with:
• 💬 /ai — Ask me anything
• 💻 /code — Generate or fix code
• 🎨 /image — Create AI images
• ❓ /help — Show commands

Just type naturally or use a command. Let's go! 🚀\`;
}

function getHelpMessage() {
  return \`📋 *Dawinix AI — Commands*

\\\`/ai [question]\\\` — Ask anything, get smart answers
\\\`/code [task]\\\` — Generate Python, JS, Node.js, HTML/CSS code
\\\`/image [prompt]\\\` — Generate AI images with DALL·E 3
\\\`/start\\\` — Welcome message
\\\`/help\\\` — This command list

💡 You can also just type naturally without commands!
Languages supported: English, French, Haitian Creole 🌍\`;
}

app.listen(process.env.PORT || 3000, () => {
  console.log(\`🚀 Dawinix AI bot running on port \${process.env.PORT || 3000}\`);
});`} />
        </Step>

        <Step num={4} title="Register Webhook with Meta">
          <p className="text-xs text-muted-foreground leading-relaxed">
            In Meta Developer Console → WhatsApp → Configuration → set your Webhook URL and Verify Token:
          </p>
          <CodeBlock lang="text" code={`Webhook URL: https://your-server.com/webhook
Verify Token: dawinix_verify_2025
Subscribed Fields: ✅ messages`} />
          <p className="text-xs text-muted-foreground">Test locally with ngrok before deploying:</p>
          <CodeBlock lang="bash" code={`# Install ngrok
npm install -g ngrok

# Expose your local server
ngrok http 3000
# → Use the https://xxxx.ngrok.io URL as your webhook`} />
        </Step>

        <Step num={5} title="Deploy to Render (Free)">
          <p className="text-xs text-muted-foreground">Add a <span className="font-mono text-foreground">start</span> script to package.json, then:</p>
          <CodeBlock lang="bash" code={`# 1. Push code to GitHub
git init && git add . && git commit -m "Dawinix AI bot"
git remote add origin https://github.com/yourusername/dawinix-bot.git
git push -u origin main

# 2. Go to render.com → New → Web Service → Connect GitHub repo
# 3. Set environment variables in Render dashboard:
#    PHONE_NUMBER_ID, ACCESS_TOKEN, WEBHOOK_VERIFY_TOKEN, OPENAI_API_KEY
# 4. Deploy! Render gives you a free HTTPS URL`} />
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
            <p className="text-[11px] text-primary font-semibold mb-1">✅ Production Tips</p>
            <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
              <li>Use Redis for persistent user memory (instead of in-memory object)</li>
              <li>Add request signature validation using X-Hub-Signature-256</li>
              <li>Set up a rate limiter middleware (express-rate-limit)</li>
              <li>Use a System User token — never expires unlike Page tokens</li>
            </ul>
          </div>
        </Step>

        <Step num={6} title="Test Your Bot">
          <p className="text-xs text-muted-foreground">Send these messages from your WhatsApp to test:</p>
          <div className="space-y-2">
            {[
              { cmd: "/start", resp: "Welcome message with command list" },
              { cmd: "/ai What is machine learning?", resp: "AI explanation from GPT-4o" },
              { cmd: "/code Write a Python web scraper", resp: "Full Python code with comments" },
              { cmd: "/image A robot reading a book at sunset", resp: "DALL·E 3 generated image URL" },
              { cmd: "Bonjou, kijan ou rele?", resp: "Haitian Creole response" },
            ].map(({ cmd, resp }) => (
              <div key={cmd} className="flex gap-3 items-start p-3 rounded-xl bg-secondary/40">
                <div className="shrink-0 px-2 py-1 rounded-lg bg-dark-900 border border-border">
                  <Terminal className="w-3 h-3 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] font-mono text-foreground">{cmd}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">→ {resp}</p>
                </div>
              </div>
            ))}
          </div>
        </Step>
      </div>

      {/* CTA */}
      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-6 text-center">
        <Rocket className="w-8 h-8 text-primary mx-auto mb-3" />
        <h3 className="text-base font-bold text-gradient mb-2">Dawinix AI is ready to deploy!</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Follow the steps above to get your WhatsApp AI chatbot live. Configure your API keys in Bot Config → WhatsApp API.
        </p>
        <a
          href="https://developers.facebook.com/docs/whatsapp/cloud-api"
          target="_blank" rel="noopener"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Open Meta WhatsApp Docs
        </a>
      </div>
    </div>
  );
}
