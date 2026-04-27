import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  Send, Phone, MessageSquare, CheckCircle, XCircle,
  Loader2, History, User, Settings, RefreshCw, Bot,
  AlertTriangle, Upload, Camera, X, Image
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
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      .in("key", ["bot_name", "bot_about", "bot_photo_url"])
      .then(({ data }) => {
        if (data) {
          const nameRow = data.find((r) => r.key === "bot_name");
          const aboutRow = data.find((r) => r.key === "bot_about");
          const photoRow = data.find((r) => r.key === "bot_photo_url");
          if (nameRow)
            setProfileName(
              typeof nameRow.value === "string"
                ? nameRow.value.replace(/^"|"$/g, "")
                : String(nameRow.value)
            );
          if (aboutRow)
            setProfileAbout(
              typeof aboutRow.value === "string"
                ? aboutRow.value.replace(/^"|"$/g, "")
                : String(aboutRow.value)
            );
          if (photoRow) {
            const url =
              typeof photoRow.value === "string"
                ? photoRow.value.replace(/^"|"$/g, "")
                : String(photoRow.value);
            setProfilePhotoUrl(url);
            setPhotoPreview(url);
          }
        }
      });
  }, []);

  // ── Upload photo to Supabase Storage ─────────────────────────────────────
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPG, PNG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) return profilePhotoUrl;
    setUploadingPhoto(true);
    const ext = photoFile.name.split(".").pop() ?? "jpg";
    const fileName = `bot-profile/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("generated-images")
      .upload(fileName, photoFile, {
        contentType: photoFile.type,
        upsert: true,
      });

    if (upErr) {
      toast.error(`Photo upload failed: ${upErr.message}`);
      setUploadingPhoto(false);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("generated-images")
      .getPublicUrl(fileName);

    // Persist URL in bot_config
    await supabase.from("bot_config").upsert(
      { key: "bot_photo_url", value: JSON.stringify(publicUrl), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

    setProfilePhotoUrl(publicUrl);
    setUploadingPhoto(false);
    return publicUrl;
  };

  // ── Send message ──────────────────────────────────────────────────────────
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
    const { data, error } = await supabase.functions.invoke(
      "send-whatsapp-message",
      { body: { action: "send", to: cleanPhone, message: message.trim() } }
    );

    if (error) {
      let errMsg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { errMsg = (await error.context?.text()) || errMsg; } catch { /* noop */ }
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

  // ── Save profile (name + about + photo) ──────────────────────────────────
  const handleSaveProfile = async () => {
    if (!profileName.trim() && !profileAbout.trim() && !photoFile) {
      toast.error("Enter at least a name, about text, or select a photo");
      return;
    }
    setSavingProfile(true);

    // 1. Upload photo first if selected
    const photoUrl = await handleUploadPhoto();

    // 2. Call edge function to update WhatsApp profile
    const { data, error } = await supabase.functions.invoke("send-whatsapp-message", {
      body: {
        action: "update_profile",
        profile_name: profileName.trim() || undefined,
        profile_about: profileAbout.trim() || undefined,
        profile_photo_url: photoUrl || undefined,
      },
    });

    if (error) {
      let errMsg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { errMsg = (await error.context?.text()) || errMsg; } catch { /* noop */ }
      }
      toast.error(`Profile update failed: ${errMsg}`);
    } else if (data?.error) {
      toast.error(`API error: ${data.error}`);
    } else {
      toast.success("Bot profile updated successfully!");
      setPhotoFile(null);
    }
    setSavingProfile(false);
  };

  const inputClass =
    "w-full px-3 py-2.5 rounded-xl bg-dark-900 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors";

  return (
    <div className="p-4 md:p-6 max-w-[900px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
          <Send className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Send Message</h2>
          <p className="text-xs text-muted-foreground">
            Send real WhatsApp messages &amp; manage bot profile
          </p>
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

      {/* ── SEND TAB ── */}
      {tab === "send" && (
        <div className="space-y-4">
          {/* #131030 Test-mode warning */}
          <div className="rounded-xl bg-yellow-400/5 border border-yellow-400/30 p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <div className="text-[11px] space-y-1.5">
              <p className="font-semibold text-yellow-400 text-xs">
                Error #131030 — WhatsApp Test Mode: Recipient Not in Allowed List
              </p>
              <p className="text-muted-foreground">
                Your Meta app is in{" "}
                <strong className="text-foreground">Development mode</strong>. Only pre-verified
                numbers can receive messages. To fix:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-1">
                <li>
                  Go to <strong className="text-foreground">Meta Developer Console</strong> → your
                  app → <strong className="text-foreground">WhatsApp → API Setup</strong>
                </li>
                <li>
                  Under <strong className="text-foreground">"To"</strong>, click{" "}
                  <strong className="text-foreground">"Manage phone number list"</strong>
                </li>
                <li>Add the recipient number and verify with OTP sent by WhatsApp</li>
                <li>
                  <strong className="text-foreground">Or go live:</strong> complete{" "}
                  <strong className="text-foreground">Meta Business Verification</strong> to remove
                  all restrictions
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
                    <span
                      className={cn(
                        "text-[10px] font-mono",
                        charCount > 4000 ? "text-destructive" : "text-muted-foreground"
                      )}
                    >
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
                  <label className="block text-xs font-semibold text-muted-foreground mb-2">
                    Quick Templates
                  </label>
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
                          {entry.status === "success" ? (
                            <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                          )}
                          <span className="font-mono text-muted-foreground">+{entry.phone}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                            {entry.timestamp.toLocaleTimeString("en-US", { hour12: false })}
                          </span>
                        </div>
                        <p className="text-muted-foreground line-clamp-2 leading-relaxed">
                          {entry.message}
                        </p>
                        {entry.error && (
                          <p className="text-destructive text-[10px] mt-1 font-mono break-all">
                            {entry.error}
                          </p>
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

      {/* ── PROFILE TAB ── */}
      {tab === "profile" && (
        <div className="max-w-lg space-y-4">
          <div className="rounded-2xl bg-card border border-border p-5 space-y-5">
            {/* Photo upload */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Bot profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Bot className="w-10 h-10 text-primary" />
                  )}
                </div>
                {/* Camera overlay button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-all border-2 border-card"
                  title="Change profile photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
                {/* Clear photo button */}
                {photoPreview && (
                  <button
                    onClick={() => { setPhotoPreview(null); setPhotoFile(null); }}
                    className="absolute top-0 right-0 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center shadow-lg hover:bg-destructive/80 transition-all"
                    title="Remove photo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoSelect}
              />

              <div className="text-center">
                <p className="text-sm font-bold text-foreground">{profileName || "Dawinix AI"}</p>
                <p className="text-xs text-muted-foreground">WhatsApp Business Profile</p>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                {photoFile ? `Selected: ${photoFile.name}` : "Upload Profile Photo"}
              </button>

              {photoFile && (
                <div className="flex items-center gap-2 text-[10px] text-primary bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                  <Image className="w-3 h-3" />
                  {photoFile.name} · {(photoFile.size / 1024).toFixed(0)} KB
                </div>
              )}

              <p className="text-[10px] text-muted-foreground text-center">
                JPG, PNG, or WebP · Max 5 MB · Square image recommended
              </p>
            </div>

            {/* Bot name */}
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
              <p className="text-[10px] text-muted-foreground mt-1">
                Max 60 characters. Displayed in WhatsApp chats.
              </p>
            </div>

            {/* About */}
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
              <p className="text-[10px] text-muted-foreground mt-1">
                {profileAbout.length}/139 characters
              </p>
            </div>

            {/* Info */}
            <div className="rounded-xl bg-yellow-400/5 border border-yellow-400/20 p-3">
              <div className="flex items-start gap-2">
                <Settings className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-muted-foreground space-y-1.5">
                  <p>Profile photo is uploaded to storage and sent to WhatsApp via the Media API.</p>
                  <p className="font-semibold text-yellow-400">OAuthException (code 1) fix:</p>
                  <ol className="list-decimal list-inside space-y-1 pl-1">
                    <li>Your <strong className="text-foreground">System User token</strong> must have <strong className="text-foreground">whatsapp_business_management</strong> permission</li>
                    <li>Go to <strong className="text-foreground">Meta Business Suite → Settings → System Users</strong>, edit the user and add that permission</li>
                    <li>Regenerate the access token and update <strong className="text-foreground">ACCESS_TOKEN</strong> in OnSpace Cloud → Secrets</li>
                    <li>Display name changes require Meta Business Verification (24–48 hrs)</li>
                  </ol>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={savingProfile || uploadingPhoto}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-all"
            >
              {(savingProfile || uploadingPhoto) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {uploadingPhoto
                ? "Uploading photo..."
                : savingProfile
                ? "Updating profile..."
                : "Save & Apply to WhatsApp"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
fix Profile update failed: {"error":"WhatsApp Profile API: An unknown error occurred — {\"error\":{\"message\":\"An unknown error occurred\",\"type\":\"OAuthException\",\"code\":1,\"error_subcode\":3441012,\"is_transient\":false,\"error_user_title\":\"Image type not supported\",\"error_user_msg\":\"Please upload JPG image.\",\"fbtrace_id\":\"AxCxx9s602Uzmm1UJZnzilC\"}}"}.
