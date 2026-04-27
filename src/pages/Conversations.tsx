import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { formatRelativeTime, maskPhone } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  MessageSquare, Search, Code, Image, Zap, HelpCircle,
  Play, Circle, ChevronRight, RefreshCw, Loader2, Users, Ban, CheckCircle
} from "lucide-react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  phone: string;
  user_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  message_count: number;
  is_blocked: boolean;
  language: string;
  created_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  phone: string;
  role: "user" | "bot";
  content: string;
  command: string | null;
  image_url: string | null;
  created_at: string;
}

// ── Sub-components ─────────────────────────────────────────────────────────

const COMMAND_ICONS: Record<string, React.ReactNode> = {
  "/ai": <Zap className="w-3 h-3" />,
  "/code": <Code className="w-3 h-3" />,
  "/image": <Image className="w-3 h-3" />,
  "/help": <HelpCircle className="w-3 h-3" />,
  "/start": <Play className="w-3 h-3" />,
};

function CommandBadge({ cmd }: { cmd: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-mono border border-primary/20">
      {COMMAND_ICONS[cmd] ?? <Circle className="w-2.5 h-2.5" />}
      {cmd}
    </span>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isBot = msg.role === "bot";
  const showCmd = msg.command && msg.command !== "text" && COMMAND_ICONS[msg.command];

  return (
    <div className={cn("flex gap-2", isBot ? "flex-row" : "flex-row-reverse")}>
      {isBot && (
        <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 mt-1">
          <Zap className="w-3 h-3 text-primary" />
        </div>
      )}
      <div className={cn("max-w-[78%] space-y-1", !isBot && "items-end flex flex-col")}>
        {showCmd && <CommandBadge cmd={msg.command!} />}
        <div className={cn(
          "px-3 py-2 rounded-2xl text-xs leading-relaxed",
          isBot
            ? "bg-secondary text-foreground rounded-tl-sm"
            : "bg-primary/15 text-foreground border border-primary/20 rounded-tr-sm"
        )}>
          <pre className="whitespace-pre-wrap font-sans break-words">{msg.content}</pre>
          {msg.image_url && (
            <img
              src={msg.image_url}
              alt="AI Generated"
              className="mt-2 rounded-xl w-full max-w-[260px] object-cover border border-border"
            />
          )}
        </div>
        <p className="text-[10px] text-muted-foreground font-mono px-1">
          {formatRelativeTime(msg.created_at)}
        </p>
      </div>
    </div>
  );
}

function Avatar({ name, phone }: { name: string | null; phone: string }) {
  const letter = name ? name.charAt(0).toUpperCase() : phone.slice(-2);
  const colors = ["bg-primary/20", "bg-neon-blue/20", "bg-neon-purple/20"];
  const color = colors[phone.charCodeAt(phone.length - 1) % 3];
  const textColors = ["text-primary", "text-neon-blue", "text-neon-purple"];
  const textColor = textColors[phone.charCodeAt(phone.length - 1) % 3];
  return (
    <div className={cn("w-10 h-10 rounded-full border flex items-center justify-center shrink-0", color)}>
      <span className={cn("text-sm font-bold", textColor)}>{letter}</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .order("last_message_at", { ascending: false });

    if (!error && data) {
      setConversations(data as Conversation[]);
      // Auto-select first if none selected
      setSelected((prev) => {
        if (!prev && data.length > 0) return data[0] as Conversation;
        if (prev) {
          // Update selected with fresh data
          const updated = (data as Conversation[]).find((c) => c.id === prev.id);
          return updated ?? prev;
        }
        return prev;
      });
    }
    setLoadingConvs(false);
  }, []);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (!error && data) {
      setMessages(data as Message[]);
    }
    setLoadingMsgs(false);
  }, []);

  // Initial load + 5s polling for conversations
  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Poll messages for selected conversation every 5s
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (!selected) { setMessages([]); return; }

    setLoadingMsgs(true);
    fetchMessages(selected.id);
    pollingRef.current = setInterval(() => fetchMessages(selected.id), 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selected?.id, fetchMessages]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleBlock = async (conv: Conversation) => {
    const { error } = await supabase
      .from("conversations")
      .update({ is_blocked: !conv.is_blocked })
      .eq("id", conv.id);
    if (!error) {
      toast.success(conv.is_blocked ? "User unblocked" : "User blocked");
      fetchConversations();
    }
  };

  const filtered = conversations.filter((c) =>
    (c.user_name ?? c.phone).toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const LANG_LABELS: Record<string, string> = { en: "EN", fr: "FR", ht: "HT" };

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Conversation List */}
      <div className={cn(
        "border-r border-border bg-card flex flex-col shrink-0",
        "w-full md:w-72 lg:w-80",
        selected ? "hidden md:flex" : "flex"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">
              Conversations
              <span className="ml-2 text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                {conversations.length}
              </span>
            </h2>
            <div className="flex items-center gap-1 text-[10px] font-mono text-primary">
              <Circle className="w-1.5 h-1.5 fill-primary pulse-dot" />
              Live
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-border">
          {loadingConvs ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary/50 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-secondary/50 rounded animate-pulse w-3/4" />
                    <div className="h-2.5 bg-secondary/50 rounded animate-pulse w-full" />
                  </div>
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                {search ? "No matching conversations" : "No conversations yet"}
              </p>
              {!search && (
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  Send a message to the bot on WhatsApp to start
                </p>
              )}
            </div>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelected(conv)}
                className={cn(
                  "w-full flex items-start gap-3 p-4 hover:bg-secondary/60 transition-colors text-left",
                  selected?.id === conv.id && "bg-primary/5 border-l-2 border-l-primary",
                  conv.is_blocked && "opacity-50"
                )}
              >
                <div className="relative">
                  <Avatar name={conv.user_name} phone={conv.phone} />
                  {conv.is_blocked && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive/90 border-2 border-card flex items-center justify-center">
                      <Ban className="w-2 h-2 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {conv.user_name ?? conv.phone}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono shrink-0 ml-1">
                      {conv.last_message_at ? formatRelativeTime(conv.last_message_at) : "—"}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mb-1.5">
                    {conv.last_message ?? "No messages"}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
                      {LANG_LABELS[conv.language] ?? conv.language?.toUpperCase() ?? "EN"}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{conv.message_count} msgs</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Thread */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="px-4 md:px-6 py-3.5 border-b border-border bg-card/80 flex items-center gap-3 shrink-0">
            <button
              className="md:hidden p-1.5 rounded-lg hover:bg-secondary"
              onClick={() => setSelected(null)}
            >
              <ChevronRight className="w-4 h-4 rotate-180 text-muted-foreground" />
            </button>
            <Avatar name={selected.user_name} phone={selected.phone} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {selected.user_name ?? selected.phone}
                </p>
                {selected.is_blocked && (
                  <span className="text-[10px] text-destructive font-mono bg-destructive/10 px-1.5 rounded">blocked</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-muted-foreground font-mono">{maskPhone(selected.phone)}</p>
                <span className="text-[10px] text-muted-foreground">·</span>
                <p className="text-[11px] text-muted-foreground">{selected.message_count} messages</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Poll indicator */}
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-primary bg-primary/10 px-2 py-1 rounded-full border border-primary/20">
                <RefreshCw className="w-3 h-3" style={{ animation: "spin 5s linear infinite" }} />
                5s poll
              </div>
              {/* Block toggle */}
              <button
                onClick={() => handleBlock(selected)}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  selected.is_blocked
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                )}
                title={selected.is_blocked ? "Unblock user" : "Block user"}
              >
                {selected.is_blocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-6 space-y-4 bg-dark-900/30">
            {loadingMsgs ? (
              <div className="flex items-center justify-center h-full gap-2">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="text-xs text-muted-foreground">Loading messages...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No messages yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Messages will appear here as they arrive</p>
                </div>
              </div>
            ) : (
              <>
                {/* Date separator for first message */}
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-muted-foreground font-mono px-2">
                    {new Date(messages[0]?.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {messages.map((msg, idx) => {
                  // Show date separator on day change
                  const prevMsg = messages[idx - 1];
                  const showDateSep = prevMsg &&
                    new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();
                  return (
                    <div key={msg.id}>
                      {showDateSep && (
                        <div className="flex items-center gap-2 my-4">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-[10px] text-muted-foreground font-mono px-2">
                            {new Date(msg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}
                      <MessageBubble msg={msg} />
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Read-only footer */}
          <div className="px-4 md:px-6 py-3 border-t border-border bg-card/80 shrink-0">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-secondary border border-border">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground flex-1">
                Read-only view — bot responds automatically via WhatsApp. Messages refresh every 5s.
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-primary font-mono shrink-0">
                <Circle className="w-1.5 h-1.5 fill-primary pulse-dot" />
                Live
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Select a conversation</p>
            <p className="text-xs text-muted-foreground/70 mt-1">All data is live from your database</p>
          </div>
        </div>
      )}
    </div>
  );
}
