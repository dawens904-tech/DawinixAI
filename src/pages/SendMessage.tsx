import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  Send, Phone, MessageSquare, CheckCircle, XCircle,
  Loader2, History, User, Settings, RefreshCw, Bot, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";

interface SentLog {
  phone: string;
  message: string;
  status: "success" | "error";
  error?: string;
  timestamp: Date;
}

interface RecentUser {
  phone: string;
  user_name: string | null;
}

export default function SendMessage() {
  const [tab, setTab] = useState<"send" | "profile">("send");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState<SentLog[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [charCount, setCharCount] = useState(0);

  // Profile state
  const [profileName, setProfileName] = useState("");
  const [profileAbout, setProfileAbout] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    supabase
      .from("conversations")
      .select("phone, user_name")
      .order("last_message_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setRecentUsers(data ?? []));

    supabase
      .from("bot_config")
      .select("key, value")
      .in("key", ["bot_name", "bot_about"])
      .then(({ data }) => {
        if (data) {
          const nameRow = data.find((r) => r.key === "bot_name");
          const aboutRow = data.find((r) => r.key === "bot_about");
          if (nameRow) setProfileName(typeof nameRow.value === "string" ? nameRow.value.replace(/^"|"$/g, "") : String(nameRow.value));
          if (aboutRow) setProfileAbout(typeof aboutRow.value === "string" ? aboutRow.value.replace(/^"|"$/g, "") : String(aboutRow.value));
        }
      });
  }, []);

  const handleSend = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 7) {
      toast.error("Enter a valid phone number with country code");
      return;
    }
    if (!message.trim()) {
      toast.error("Message cannot be empty");
      return;
    }

    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-whatsapp-message", {
      body: { action: "send", to: cleanPhone, message: message.trim() },
    });

    if (error) {
      let errMsg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { errMsg = await error.context?.text() || errMsg; } catch { /* noop */ }
      }
      toast.error(`Failed: ${errMsg}`);
      setLog((prev) => [{ phone: cleanPhone, message, status: "error", error: errMsg, timestamp: new Date() }, ...prev]);
    } else if (data?.error) {
      toast.error(`WhatsApp error: ${data.error}`);
      setLog((prev) => [{ phone: cleanPhone, message, status: "error", error: data.error, timestamp: new Date() }, ...prev]);
    } else {
      toast.success(`Message sent to +${cleanPhone}`);
      setLog((prev) => [{ phone: cleanPhone, message, status: "success", timestamp: new Date() }, ...prev]);
      setMessage("");
      setCharCount(0);
    }
    setSending(false);
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim() && !profileAbout.trim()) {
      toast.error("Enter at least a name or about text");
      return;
    }
    setSavingProfile(true);
    const { data, error } = await supabase.functions.invoke("send-whatsapp-message", {
      body: {
        action: "update_profile",
        profile_name: profileName.trim() || undefined,
        profile_about: profileAbout.trim() || undefined,
      },
    });

    if (error) {
      let errMsg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { errMsg = await error.context?.text() || errMsg; } catch { /* noop */ }
      }
      toast.error(`Profile update failed: ${errMsg}`);
    } else if (data?.error) {
      toast.error(`API error: ${data.error}`);
    } else {
      toast.success("Bot profile updated successfully!");
    }
    setSavingProfile(false);
  };

  const inputClass = "w-full px-3 py-2.5 rounded-xl bg-dark-900 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors";

  return (
    <div className="p-4 md:p-6 max-w-[900px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
          <Send className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Send Message</h2>
          <p className="text-xs text-muted-foreground">Send real WhatsApp messages directly & manage bot profile</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary w-fit border border-border">
        {[
          { id: "send", label: "Send Message", icon: Send },
          { id: "profile", label: "Bot Profile", icon: Bot },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as typeof tab)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all",
              tab === id
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "send" && (
        <div className="space-y-4">
          {/* #131030 Test-mode warning banner */}
          <div className="rounded-xl bg-yellow-400/5 border border-yellow-400/30 p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <div className="text-[11px] space-y-1.5">
              <p className="font-semibold text-yellow-400 text-xs">
                Error #131030 — WhatsApp Test Mode: Recipient Not in Allowed List
              </p>
              <p className="text-muted-foreground">
                Your Meta app is in <strong className="text-foreground">Development mode</strong>. Only pre-verified numbers can receive messages. To send to{" "}
                <code className="font-mono bg-black/30 px-1 rounded text-primary">+18573917861</code>:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-1">
                <li>
                  Go to <strong className="text-foreground">Meta Developer Console</strong> → your app →{" "}
                  <strong className="text-foreground">WhatsApp → API Setup</strong>
                </li>
                <li>
                  Under the <strong className="text-foreground">"To"</strong> field, click{" "}
                  <strong className="text-foreground">"Manage phone number list"</strong>
                </li>
                <li>
                  Add <code className="font-mono bg-black/30 px-1 rounded text-primary">+18573917861</code> and verify it with the OTP sent by WhatsApp
                </li>
                <li>
                  <strong className="text-foreground">Or go live:</strong> complete{" "}
                  <strong className="text-foreground">Meta Business Verification</strong> to remove all number restrictions permanently
                </li>
              </ol>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Compose panel */}
            <div className="lg:col-span-3 space-y-4">
              <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  Compose Message
                </h3>

                {/* Phone number */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Recipient Phone Number *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-dark-900 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
                      placeholder="15551234567 (with country code, no +)"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Include country code, no spaces or + symbol. E.g. 18573917861
                  </p>
                </div>

                {/* Recent users */}
                {recentUsers.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-2">
                      Recent Users
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {recentUsers.slice(0, 6).map((u) => (
                        <button
                          key={u.phone}
                          onClick={() => setPhone(u.phone)}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border transition-all",
                            phone === u.phone
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-primary/20"
                          )}
                        >
                          <User className="w-3 h-3" />
                          {u.user_name ?? u.phone}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-foreground">
                      Message *
                    </label>
                    <span className={cn("text-[10px] font-mono", charCount > 4000 ? "text-destructive" : "text-muted-foreground")}>
                      {charCount}/4096
                    </span>
                  </div>
                  <textarea
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); setCharCount(e.target.value.length); }}
                    rows={5}
                    className={cn(inputClass, "resize-none leading-relaxed")}
                    placeholder={"Type your message here...\n\nSupports WhatsApp formatting:\n*bold*, _italic_, ~strikethrough~, `code`"}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Supports WhatsApp formatting: *bold*, _italic_, ~strikethrough~, {"`"}monospace{"`"}
                  </p>
                </div>

                {/* Quick templates */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-2">Quick Templates</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Welcome", text: "👋 Welcome to *Dawinix AI*! Type /start to begin or just ask me anything. 🚀" },
                      { label: "Reminder", text: "🔔 *Reminder from Dawinix AI*\n\nDon't forget — I'm here 24/7 to help! Just send a message anytime. 💬" },
                      { label: "Update", text: "🆕 *Bot Update*\n\nWe've added new features! Type /help to see all available commands. 🎉" },
                    ].map(({ label, text }) => (
                      <button
                        key={label}
                        onClick={() => { setMessage(text); setCharCount(text.length); }}
                        className="px-2.5 py-1 rounded-lg bg-secondary border border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/20 transition-all"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSend}
                  disabled={sending || !phone.trim() || !message.trim()}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-all"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? "Sending..." : "Send WhatsApp Message"}
                </button>
              </div>
            </div>

            {/* History panel */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl bg-card border border-border overflow-hidden h-full">
                <div className="px-4 py-3 border-b border-border bg-dark-800">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <History className="w-4 h-4 text-muted-foreground" />
                    Send History
                  </h3>
                </div>
                <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
                  {log.length === 0 ? (
                    <div className="text-center py-10">
                      <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No messages sent yet</p>
                    </div>
                  ) : (
                    log.map((entry, i) => (
                      <div
                        key={i}
                        className={cn(
                          "p-3 rounded-xl border text-xs",
                          entry.status === "success"
                            ? "bg-primary/5 border-primary/20"
                            : "bg-destructive/5 border-destructive/20"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {entry.status === "success"
                            ? <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                            : <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                          <span className="font-mono text-muted-foreground">+{entry.phone}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                            {entry.timestamp.toLocaleTimeString("en-US", { hour12: false })}
                          </span>
                        </div>
                        <p className="text-muted-foreground line-clamp-2 leading-relaxed">
                          {entry.message}
                        </p>
                        {entry.error && (
                          <p className="text-destructive text-[10px] mt-1 font-mono">{entry.error}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "profile" && (
        <div className="max-w-lg">
          <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                <Bot className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{profileName || "Dawinix AI"}</p>
                <p className="text-xs text-muted-foreground">WhatsApp Business Profile</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Bot Display Name
              </label>
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className={inputClass}
                placeholder="Dawinix AI"
                maxLength={60}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Max 60 characters. Displayed in WhatsApp chats.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                About / Status
              </label>
              <textarea
                value={profileAbout}
                onChange={(e) => setProfileAbout(e.target.value)}
                className={cn(inputClass, "resize-none")}
                rows={3}
                placeholder="Your intelligent AI assistant — chat, code, and image generation in WhatsApp!"
                maxLength={139}
              />
              <p className="text-[10px] text-muted-foreground mt-1">{profileAbout.length}/139 characters</p>
            </div>

            <div className="rounded-xl bg-yellow-400/5 border border-yellow-400/20 p-3">
              <div className="flex items-start gap-2">
                <Settings className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground">
                  Profile changes are applied to your WhatsApp Business account via the Cloud API. The name shown in WhatsApp chats depends on your Business account display name and may require Meta approval.
                </p>
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-all"
            >
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {savingProfile ? "Updating..." : "Update Bot Profile"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
