import { useState } from "react";
import { MOCK_CONVERSATIONS } from "@/constants/mockData";
import type { Conversation, ChatMessage } from "@/types";
import { formatRelativeTime, maskPhone } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { MessageSquare, Search, Code, Image, Zap, HelpCircle, Play, Circle, ChevronRight } from "lucide-react";

const COMMAND_ICONS: Record<string, React.ReactNode> = {
  "/ai": <Zap className="w-3 h-3" />,
  "/code": <Code className="w-3 h-3" />,
  "/image": <Image className="w-3 h-3" />,
  "/help": <HelpCircle className="w-3 h-3" />,
  "/start": <Play className="w-3 h-3" />,
};

const LANG_LABELS: Record<string, string> = { en: "EN", fr: "FR", ht: "HT" };

function CommandBadge({ cmd }: { cmd: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-mono border border-primary/20">
      {COMMAND_ICONS[cmd]}
      {cmd}
    </span>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isBot = msg.role === "bot";
  return (
    <div className={cn("flex gap-2", isBot ? "flex-row" : "flex-row-reverse")}>
      {isBot && (
        <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 mt-1">
          <Zap className="w-3 h-3 text-primary" />
        </div>
      )}
      <div className={cn("max-w-[75%] space-y-1", isBot ? "" : "items-end flex flex-col")}>
        {msg.command && msg.command !== "text" && <CommandBadge cmd={msg.command} />}
        <div className={cn(
          "px-3 py-2 rounded-2xl text-xs leading-relaxed",
          isBot
            ? "bg-secondary text-foreground rounded-tl-sm"
            : "bg-primary/15 text-foreground border border-primary/20 rounded-tr-sm"
        )}>
          <pre className="whitespace-pre-wrap font-sans break-words">{msg.content}</pre>
          {msg.imageUrl && (
            <img
              src={msg.imageUrl}
              alt="Generated"
              className="mt-2 rounded-xl w-full max-w-[260px] object-cover"
            />
          )}
        </div>
        <p className="text-[10px] text-muted-foreground font-mono px-1">
          {formatRelativeTime(msg.timestamp)}
        </p>
      </div>
    </div>
  );
}

export default function Conversations() {
  const [selected, setSelected] = useState<Conversation | null>(MOCK_CONVERSATIONS[0]);
  const [search, setSearch] = useState("");

  const filtered = MOCK_CONVERSATIONS.filter((c) =>
    c.userName.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Conversation List */}
      <div className={cn(
        "border-r border-border bg-card flex flex-col",
        "w-full md:w-72 lg:w-80 shrink-0",
        selected ? "hidden md:flex" : "flex"
      )}>
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground mb-3">Conversations</h2>
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
        <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-border">
          {filtered.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelected(conv)}
              className={cn(
                "w-full flex items-start gap-3 p-4 hover:bg-secondary/60 transition-colors text-left",
                selected?.id === conv.id && "bg-primary/5 border-l-2 border-l-primary"
              )}
            >
              <div className="relative shrink-0">
                <img src={conv.avatar} alt={conv.userName} className="w-10 h-10 rounded-full object-cover" />
                {conv.isOnline && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-card" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-xs font-semibold text-foreground truncate">{conv.userName}</p>
                  <p className="text-[10px] text-muted-foreground font-mono shrink-0 ml-1">
                    {formatRelativeTime(conv.lastMessageTime)}
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mb-1.5">{conv.lastMessage}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
                    {LANG_LABELS[conv.language]}
                  </span>
                  <span className="text-[9px] text-muted-foreground">{conv.messageCount} msgs</span>
                </div>
              </div>
            </button>
          ))}
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
            <div className="relative">
              <img src={selected.avatar} alt={selected.userName} className="w-9 h-9 rounded-full object-cover" />
              {selected.isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{selected.userName}</p>
                {selected.isOnline && (
                  <span className="text-[10px] text-primary font-mono bg-primary/10 px-1.5 rounded">online</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">{maskPhone(selected.phone)}</p>
            </div>
            <div className="flex items-center gap-2">
              {selected.commandsUsed.map((cmd) => (
                <CommandBadge key={cmd} cmd={cmd} />
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-6 space-y-4">
            {selected.messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </div>

          {/* Input area (read-only indicator) */}
          <div className="px-4 md:px-6 py-3 border-t border-border bg-card/80 shrink-0">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-secondary border border-border">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground flex-1">
                Conversations are read-only in dashboard. Bot responds automatically via WhatsApp.
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-primary font-mono">
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
          </div>
        </div>
      )}
    </div>
  );
}
