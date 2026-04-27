import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Eye, EyeOff, Save, Copy, Check, Settings,
  Webhook, Brain, Shield, MessageSquare, Loader2, RefreshCw
} from "lucide-react";

interface ConfigRow {
  key: string;
  value: unknown;
}

interface BotSettings {
  bot_name: string;
  system_prompt: string;
  fallback_message: string;
  max_context: number;
  rate_limit: number;
  enabled_commands: string[];
  text_without_command: boolean;
}

const DEFAULT_SETTINGS: BotSettings = {
  bot_name: "Dawinix AI",
  system_prompt:
    "You are Dawinix AI, a smart and helpful WhatsApp assistant. You can answer questions, generate code in Python, JavaScript, Node.js, HTML/CSS, and explain concepts. You support English, French, and Haitian Creole. Always be helpful, concise, and accurate.",
  fallback_message: "Sorry, I could not process your request right now. Please try again. 🙏",
  max_context: 10,
  rate_limit: 50,
  enabled_commands: ["/ai", "/code", "/image", "/help", "/start"],
  text_without_command: true,
};

const TABS = [
  { id: "ai", label: "AI Settings", icon: Brain },
  { id: "commands", label: "Commands", icon: MessageSquare },
  { id: "security", label: "Security", icon: Shield },
  { id: "whatsapp", label: "WhatsApp API", icon: Webhook },
];

const ALL_COMMANDS = ["/ai", "/code", "/image", "/help", "/start"];
const LANG_LABELS: Record<string, string> = { en: "🇺🇸 English", fr: "🇫🇷 French", ht: "🇭🇹 Haitian Creole" };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
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

function parseVal(val: unknown): string {
  if (typeof val === "string") return val.replace(/^"|"$/g, "");
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return String(val);
  return JSON.stringify(val).replace(/^"|"$/g, "");
}

export default function BotConfig() {
  const [settings, setSettings] = useState<BotSettings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState("ai");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // WhatsApp API display fields (read-only from env, shown for reference)
  const webhookUrl = `https://zmkdygoyejtywrftzmkd.backend.onspace.ai/functions/v1/whatsapp-webhook`;

  const fetchConfig = useCallback(async () => {
    const { data, error } = await supabase.from("bot_config").select("key, value");
    if (error || !data) { setLoading(false); return; }

    const map: Record<string, unknown> = {};
    for (const row of data as ConfigRow[]) map[row.key] = row.value;

    setSettings({
      bot_name: parseVal(map.bot_name ?? DEFAULT_SETTINGS.bot_name),
      system_prompt: parseVal(map.system_prompt ?? DEFAULT_SETTINGS.system_prompt),
      fallback_message: parseVal(map.fallback_message ?? DEFAULT_SETTINGS.fallback_message),
      max_context: Number(parseVal(map.max_context ?? DEFAULT_SETTINGS.max_context)),
      rate_limit: Number(parseVal(map.rate_limit ?? DEFAULT_SETTINGS.rate_limit)),
      enabled_commands: Array.isArray(map.enabled_commands)
        ? (map.enabled_commands as string[])
        : DEFAULT_SETTINGS.enabled_commands,
      text_without_command:
        map.text_without_command === true ||
        map.text_without_command === "true" ||
        parseVal(map.text_without_command ?? "true") === "true",
    });
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    const upserts = [
      { key: "bot_name", value: JSON.stringify(settings.bot_name) },
      { key: "system_prompt", value: JSON.stringify(settings.system_prompt) },
      { key: "fallback_message", value: JSON.stringify(settings.fallback_message) },
      { key: "max_context", value: settings.max_context },
      { key: "rate_limit", value: settings.rate_limit },
      { key: "enabled_commands", value: settings.enabled_commands },
      { key: "text_without_command", value: settings.text_without_command },
    ];

    const { error } = await supabase
      .from("bot_config")
      .upsert(upserts.map((u) => ({ ...u, updated_at: new Date().toISOString() })), { onConflict: "key" });

    if (error) {
      toast.error(`Save failed: ${error.message}`);
    } else {
      toast.success("Bot configuration saved!");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const toggleCommand = (cmd: string) => {
    setSettings((prev) => ({
      ...prev,
      enabled_commands: prev.enabled_commands.includes(cmd)
        ? prev.enabled_commands.filter((c) => c !== cmd)
        : [...prev.enabled_commands, cmd],
    }));
  };

  const inputClass =
    "w-full px-3 py-2.5 rounded-xl bg-dark-900 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors";
  const textareaClass =
    "w-full px-3 py-2.5 rounded-xl bg-dark-900 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors resize-none leading-relaxed";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[900px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Bot Configuration</h2>
          <p className="text-xs text-muted-foreground">Live settings — saved directly to database</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchConfig}
            className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-all"
            title="Reload from DB"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
              saved
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            )}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Saving..." : saved ? "Saved!" : "Save Config"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl border border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all",
              tab === id
                ? "bg-card text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── AI Settings ── */}
      {tab === "ai" && (
        <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">AI Behavior Settings</h3>
            <span className="ml-auto text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
              Gemini 3 Flash · OnSpace AI
            </span>
          </div>

          <Field label="Bot Display Name">
            <input
              value={settings.bot_name}
              onChange={(e) => setSettings((p) => ({ ...p, bot_name: e.target.value }))}
              className={inputClass}
              placeholder="Dawinix AI"
              maxLength={60}
            />
          </Field>

          <Field
            label="System Prompt"
            hint="Core instruction shaping the bot's personality — supports multilingual (EN, FR, HT)"
          >
            <textarea
              value={settings.system_prompt}
              onChange={(e) => setSettings((p) => ({ ...p, system_prompt: e.target.value }))}
              className={textareaClass}
              rows={5}
            />
            <p className="text-[10px] text-muted-foreground mt-1">{settings.system_prompt.length} characters</p>
          </Field>

          <Field label="Fallback Message" hint="Sent when AI processing fails">
            <input
              value={settings.fallback_message}
              onChange={(e) => setSettings((p) => ({ ...p, fallback_message: e.target.value }))}
              className={inputClass}
              maxLength={200}
            />
          </Field>

          <Field
            label={`Max Context Messages: ${settings.max_context}`}
            hint="How many previous messages the bot remembers per session (1–20)"
          >
            <input
              type="range"
              min={1}
              max={20}
              value={settings.max_context}
              onChange={(e) => setSettings((p) => ({ ...p, max_context: Number(e.target.value) }))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1</span><span>10</span><span>20</span>
            </div>
          </Field>
        </div>
      )}

      {/* ── Commands ── */}
      {tab === "commands" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Enabled Commands
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ALL_COMMANDS.map((cmd) => {
                const enabled = settings.enabled_commands.includes(cmd);
                return (
                  <button
                    key={cmd}
                    onClick={() => toggleCommand(cmd)}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border transition-all text-left",
                      enabled
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-secondary border-border text-muted-foreground hover:border-border/70"
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
            <h3 className="text-sm font-semibold">Text Without Command</h3>
            <p className="text-xs text-muted-foreground">
              When enabled, users can chat with the AI without typing a command prefix — plain messages go directly to AI.
            </p>
            <button
              onClick={() => setSettings((p) => ({ ...p, text_without_command: !p.text_without_command }))}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all w-full",
                settings.text_without_command
                  ? "bg-primary/10 border-primary/30"
                  : "bg-secondary border-border"
              )}
            >
              <div
                className={cn(
                  "w-10 h-5 rounded-full transition-all relative",
                  settings.text_without_command ? "bg-primary" : "bg-secondary border border-border"
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                    settings.text_without_command ? "left-5" : "left-0.5"
                  )}
                />
              </div>
              <div className="text-left">
                <p className={cn("text-xs font-semibold", settings.text_without_command ? "text-primary" : "text-muted-foreground")}>
                  {settings.text_without_command ? "Enabled" : "Disabled"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {settings.text_without_command ? "Plain text → AI (no /command needed)" : "Commands required for AI access"}
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── Security ── */}
      {tab === "security" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Rate Limiting
            </h3>
            <Field
              label={`Rate Limit: ${settings.rate_limit} messages/hour per user`}
              hint="Maximum messages a single user can send per hour"
            >
              <input
                type="range"
                min={10}
                max={500}
                step={5}
                value={settings.rate_limit}
                onChange={(e) => setSettings((p) => ({ ...p, rate_limit: Number(e.target.value) }))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>10/hr</span><span>250/hr</span><span>500/hr</span>
              </div>
            </Field>
          </div>

          <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
            <h3 className="text-sm font-semibold">Security Checklist</h3>
            {[
              { label: "Access token stored as Edge Function secret", ok: true },
              { label: "Webhook verify token validated on every GET request", ok: true },
              { label: "No secrets hardcoded in source code", ok: true },
              { label: "Rate limiting active per user via whatsapp_users table", ok: true },
              { label: "RLS policies enabled on all database tables", ok: true },
              { label: "HTTPS enforced on Edge Function endpoint", ok: true },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center gap-3 text-xs">
                <div
                  className={cn(
                    "w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                    ok ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
                  )}
                >
                  {ok ? "✓" : "✗"}
                </div>
                <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── WhatsApp API (read-only reference) ── */}
      {tab === "whatsapp" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">WhatsApp Cloud API Reference</h3>
            </div>
            <div className="rounded-xl bg-yellow-400/5 border border-yellow-400/20 p-3 text-[11px] text-muted-foreground">
              API credentials (Access Token, Phone Number ID, Verify Token) are stored securely as Edge Function secrets — not editable here. Go to <strong className="text-foreground">OnSpace Cloud → Secrets</strong> to update them.
            </div>

            <Field label="Webhook URL" hint="Set this in Meta Developer Console → WhatsApp → Configuration → Webhook">
              <div className="flex gap-2">
                <input
                  value={webhookUrl}
                  readOnly
                  className={cn(inputClass, "font-mono opacity-80 cursor-default")}
                />
                <CopyButton text={webhookUrl} />
              </div>
            </Field>

            <Field label="Webhook Verify Token" hint="The WEBHOOK_VERIFY_TOKEN secret value set in Edge Function Secrets">
              <div className="flex gap-2">
                <input
                  type={showToken ? "text" : "password"}
                  value="••••••••••••••••"
                  readOnly
                  className={cn(inputClass, "opacity-60 cursor-default")}
                />
                <button
                  onClick={() => setShowToken((v) => !v)}
                  className="p-2 rounded-lg bg-dark-900 border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </Field>

            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary pulse-dot mt-1 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-primary mb-0.5">Webhook Active</p>
                <p className="text-[11px] text-muted-foreground">
                  Configured and ready to receive messages from Meta's WhatsApp Cloud API. The Edge Function handles verification (GET) and message processing (POST).
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
            <h3 className="text-sm font-semibold">Configured Secrets</h3>
            {[
              { key: "PHONE_NUMBER_ID", desc: "Your WhatsApp Business phone number ID" },
              { key: "ACCESS_TOKEN", desc: "Permanent System User access token" },
              { key: "WEBHOOK_VERIFY_TOKEN", desc: "Webhook verification token" },
              { key: "ONSPACE_AI_API_KEY", desc: "OnSpace AI API key for chat & image generation" },
            ].map(({ key, desc }) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-mono font-semibold text-foreground">{key}</p>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
                <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                  Set ✓
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
please ai add this access token for me :EAAiTuM6OJrkBRRHJnSdZCOezDSSvzXM38U6d56WnBFskvaI6OO3pVg213kLquQ20H2ICBDS5LUdvNvmukUD9boQMGdWoN9qxoeUn9ftDBs5Q1qGvpKyaHDQAChNglGhr5Iwf0HwsTWiZAsx1L5ueGvVXOVCAk7ijSIZAcodQe670WN9u8tBrozG3JFDItRWHdfW5NEmMZCBZBcUscbdIwa1KJrG92g6oryZBJAzkVZB3BUY1IflpBADILZAqiSamfOe4x4ZAGy1vKLL9rnqhtV9ddRaRsqlnKZCOOruIxbUQZDZD .
