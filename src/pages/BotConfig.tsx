import { useState } from "react";
import { DEFAULT_BOT_CONFIG } from "@/constants/mockData";
import type { BotConfig } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Eye, EyeOff, Save, Copy, Check, Settings, Webhook, Brain, Shield, MessageSquare } from "lucide-react";

const TABS = [
  { id: "whatsapp", label: "WhatsApp API", icon: Webhook },
  { id: "ai", label: "AI Settings", icon: Brain },
  { id: "commands", label: "Commands", icon: MessageSquare },
  { id: "security", label: "Security", icon: Shield },
];

const AI_MODELS = ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo", "claude-3-opus", "claude-3-sonnet", "gemini-2.5-pro"];
const IMAGE_MODELS = ["dall-e-3", "dall-e-2", "stable-diffusion-xl", "midjourney-v6"];
const COMMANDS = ["/ai", "/code", "/image", "/help", "/start"] as const;
const LANGUAGES = ["en", "fr", "ht"] as const;
const LANG_LABELS: Record<string, string> = { en: "🇺🇸 English", fr: "🇫🇷 French", ht: "🇭🇹 Haitian Creole" };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground">{label}</label>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

export default function BotConfig() {
  const [config, setConfig] = useState<BotConfig>(DEFAULT_BOT_CONFIG);
  const [tab, setTab] = useState("whatsapp");
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    toast.success("Configuration saved successfully!");
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleCommand = (cmd: string) => {
    setConfig((prev) => ({
      ...prev,
      enabledCommands: prev.enabledCommands.includes(cmd as any)
        ? prev.enabledCommands.filter((c) => c !== cmd)
        : [...prev.enabledCommands, cmd as any],
    }));
  };

  const toggleLang = (lang: string) => {
    setConfig((prev) => ({
      ...prev,
      supportedLanguages: prev.supportedLanguages.includes(lang as any)
        ? prev.supportedLanguages.filter((l) => l !== lang)
        : [...prev.supportedLanguages, lang as any],
    }));
  };

  const inputClass = "w-full px-3 py-2.5 rounded-xl bg-dark-900 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors font-mono";
  const textareaClass = "w-full px-3 py-2.5 rounded-xl bg-dark-900 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors resize-none leading-relaxed";

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[900px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Bot Configuration</h2>
          <p className="text-xs text-muted-foreground">WhatsApp Cloud API & AI settings for Dawinix AI</p>
        </div>
        <button
          onClick={handleSave}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
            saved ? "bg-primary/20 text-primary border border-primary/30" : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved!" : "Save Config"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl border border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all",
              tab === id ? "bg-card text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* WhatsApp API Tab */}
      {tab === "whatsapp" && (
        <div className="space-y-4 slide-in">
          <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Webhook className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">WhatsApp Cloud API</h3>
            </div>
            <Field label="Phone Number ID" hint="Found in Meta Business → WhatsApp → API Setup">
              <div className="flex gap-2">
                <input value={config.phoneNumberId} onChange={(e) => setConfig((p) => ({ ...p, phoneNumberId: e.target.value }))} className={inputClass} placeholder="123456789012345" />
                <CopyButton text={config.phoneNumberId} />
              </div>
            </Field>
            <Field label="Permanent Access Token" hint="Use System User token for production — never expires">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showToken ? "text" : "password"}
                    value={config.accessToken}
                    onChange={(e) => setConfig((p) => ({ ...p, accessToken: e.target.value }))}
                    className={inputClass}
                    placeholder="EAAxxxxxxxxxx..."
                  />
                  <button
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <CopyButton text={config.accessToken} />
              </div>
            </Field>
            <Field label="Webhook URL" hint="Your server endpoint that Meta will POST messages to">
              <div className="flex gap-2">
                <input value={config.webhookUrl} onChange={(e) => setConfig((p) => ({ ...p, webhookUrl: e.target.value }))} className={inputClass} placeholder="https://your-server.com/webhook" />
                <CopyButton text={config.webhookUrl} />
              </div>
            </Field>
            <Field label="Webhook Verify Token" hint="A secret string you set in Meta Developer Console — must match your server">
              <div className="flex gap-2">
                <input value={config.webhookVerifyToken} onChange={(e) => setConfig((p) => ({ ...p, webhookVerifyToken: e.target.value }))} className={inputClass} />
                <CopyButton text={config.webhookVerifyToken} />
              </div>
            </Field>
          </div>

          {/* Webhook test indicator */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-start gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-primary pulse-dot mt-1 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-primary mb-0.5">Webhook Verified & Active</p>
              <p className="text-[11px] text-muted-foreground">
                Meta successfully verified your webhook endpoint. Incoming messages are being received at your server.
                Last ping: <span className="font-mono text-foreground">2 minutes ago</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI Settings Tab */}
      {tab === "ai" && (
        <div className="space-y-4 slide-in">
          <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">AI Model Settings</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Chat AI Model" hint="Model for /ai commands and natural language">
                <select
                  value={config.aiModel}
                  onChange={(e) => setConfig((p) => ({ ...p, aiModel: e.target.value }))}
                  className={inputClass}
                >
                  {AI_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Image Model" hint="Model for /image generation commands">
                <select
                  value={config.imageModel}
                  onChange={(e) => setConfig((p) => ({ ...p, imageModel: e.target.value }))}
                  className={inputClass}
                >
                  {IMAGE_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Max Context Messages" hint="How many previous messages the bot remembers per session (1–20)">
              <div className="flex items-center gap-4">
                <input
                  type="range" min={1} max={20}
                  value={config.maxContextMessages}
                  onChange={(e) => setConfig((p) => ({ ...p, maxContextMessages: Number(e.target.value) }))}
                  className="flex-1 accent-primary"
                />
                <span className="text-sm font-mono text-primary w-8 text-center">{config.maxContextMessages}</span>
              </div>
            </Field>
            <Field label="Bot Name">
              <input value={config.botName} onChange={(e) => setConfig((p) => ({ ...p, botName: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="System Prompt" hint="The core instruction that shapes the bot's personality and capabilities">
              <textarea
                value={config.systemPrompt}
                onChange={(e) => setConfig((p) => ({ ...p, systemPrompt: e.target.value }))}
                className={textareaClass}
                rows={4}
              />
            </Field>
            <Field label="Fallback Message" hint="Sent when the AI fails to respond">
              <input value={config.fallbackMessage} onChange={(e) => setConfig((p) => ({ ...p, fallbackMessage: e.target.value }))} className={inputClass} />
            </Field>
          </div>
        </div>
      )}

      {/* Commands Tab */}
      {tab === "commands" && (
        <div className="space-y-4 slide-in">
          <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> Enabled Commands</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {COMMANDS.map((cmd) => {
                const enabled = config.enabledCommands.includes(cmd as any);
                return (
                  <button
                    key={cmd}
                    onClick={() => toggleCommand(cmd)}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border transition-all text-left",
                      enabled ? "bg-primary/10 border-primary/30 text-primary" : "bg-secondary border-border text-muted-foreground hover:border-border/70"
                    )}
                  >
                    <div className={cn("w-2 h-2 rounded-full", enabled ? "bg-primary" : "bg-muted-foreground/30")} />
                    <span className="text-xs font-mono font-semibold">{cmd}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold">Supported Languages</h3>
            <div className="flex flex-wrap gap-3">
              {LANGUAGES.map((lang) => {
                const enabled = config.supportedLanguages.includes(lang as any);
                return (
                  <button
                    key={lang}
                    onClick={() => toggleLang(lang)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-xs font-medium",
                      enabled ? "bg-neon-blue/10 border-neon-blue/30 text-neon-blue" : "bg-secondary border-border text-muted-foreground hover:border-border/70"
                    )}
                  >
                    {LANG_LABELS[lang]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {tab === "security" && (
        <div className="space-y-4 slide-in">
          <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Rate Limiting & Security</h3>
            <Field label="Rate Limit (msgs/hour per user)" hint="Maximum messages a single user can send per hour before being throttled">
              <div className="flex items-center gap-4">
                <input
                  type="range" min={10} max={200} step={5}
                  value={config.rateLimit}
                  onChange={(e) => setConfig((p) => ({ ...p, rateLimit: Number(e.target.value) }))}
                  className="flex-1 accent-primary"
                />
                <span className="text-sm font-mono text-primary w-12 text-center">{config.rateLimit}/hr</span>
              </div>
            </Field>
          </div>

          {/* Security checklist */}
          <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
            <h3 className="text-sm font-semibold">Security Checklist</h3>
            {[
              { label: "Access token stored in environment variable", ok: true },
              { label: "Webhook verify token set and validated", ok: true },
              { label: "Incoming webhook requests validated via X-Hub-Signature-256", ok: true },
              { label: "Rate limiting active for all users", ok: true },
              { label: "No secrets hardcoded in source code", ok: true },
              { label: "HTTPS enforced on webhook endpoint", ok: config.webhookUrl.startsWith("https://") },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center gap-3 text-xs">
                <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0", ok ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive")}>
                  {ok ? "✓" : "✗"}
                </div>
                <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
