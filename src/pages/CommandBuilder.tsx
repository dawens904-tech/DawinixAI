import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  Plus, Trash2, Edit3, Check, X, ToggleLeft, ToggleRight,
  MessageSquare, Tag, Zap, Loader2, ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";

interface CustomCommand {
  id: string;
  command: string;
  response_template: string;
  trigger_keywords: string[];
  description: string;
  is_active: boolean;
  usage_count: number;
  created_at: string;
}

const EMPTY_FORM = {
  command: "",
  response_template: "",
  trigger_keywords: "",
  description: "",
  is_active: true,
};

export default function CommandBuilder() {
  const [commands, setCommands] = useState<CustomCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchCommands = async () => {
    const { data, error } = await supabase
      .from("custom_commands")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setCommands(data as CustomCommand[]);
    setLoading(false);
  };

  useEffect(() => { fetchCommands(); }, []);

  const handleSave = async () => {
    if (!form.command.trim() || !form.response_template.trim()) {
      toast.error("Command and response are required");
      return;
    }
    if (!form.command.startsWith("/")) {
      toast.error("Command must start with /");
      return;
    }

    setSaving(true);
    const keywords = form.trigger_keywords
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    const payload = {
      command: form.command.toLowerCase().trim(),
      response_template: form.response_template.trim(),
      trigger_keywords: keywords,
      description: form.description.trim(),
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    if (editId) {
      const { error } = await supabase.from("custom_commands").update(payload).eq("id", editId);
      if (error) { toast.error(error.message); }
      else { toast.success("Command updated!"); }
    } else {
      const { error } = await supabase.from("custom_commands").insert(payload);
      if (error) {
        if (error.code === "23505") toast.error("A command with this name already exists");
        else toast.error(error.message);
      } else {
        toast.success("Command created!");
      }
    }

    setSaving(false);
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    fetchCommands();
  };

  const handleEdit = (cmd: CustomCommand) => {
    setEditId(cmd.id);
    setForm({
      command: cmd.command,
      response_template: cmd.response_template,
      trigger_keywords: cmd.trigger_keywords?.join(", ") ?? "",
      description: cmd.description ?? "",
      is_active: cmd.is_active,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string, command: string) => {
    const { error } = await supabase.from("custom_commands").delete().eq("id", id);
    if (error) { toast.error(error.message); }
    else { toast.success(`Deleted ${command}`); fetchCommands(); }
  };

  const handleToggle = async (id: string, current: boolean) => {
    const { error } = await supabase.from("custom_commands").update({ is_active: !current }).eq("id", id);
    if (!error) {
      toast.success(current ? "Command disabled" : "Command enabled");
      fetchCommands();
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  };

  const inputClass = "w-full px-3 py-2.5 rounded-xl bg-dark-900 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors";
  const labelClass = "block text-xs font-semibold text-foreground mb-1.5";

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[900px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-neon-purple/10 border border-neon-purple/20">
            <Zap className="w-5 h-5 text-neon-purple" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Command Builder</h2>
            <p className="text-xs text-muted-foreground">Create custom bot commands with response templates & trigger keywords</p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all"
        >
          <Plus className="w-4 h-4" />
          New Command
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl bg-neon-purple/5 border border-neon-purple/20 p-4 flex items-start gap-3">
        <MessageSquare className="w-4 h-4 text-neon-purple shrink-0 mt-0.5" />
        <div className="text-[11px] text-muted-foreground space-y-1">
          <p><strong className="text-foreground">Commands</strong> are triggered by exact match (e.g., <code className="text-neon-purple">/price</code>).</p>
          <p><strong className="text-foreground">Trigger keywords</strong> match plain text messages (e.g., typing "cost" triggers the <code className="text-neon-purple">/price</code> command).</p>
          <p>Both text-with-command and plain-text-without-command messages are supported.</p>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="rounded-2xl bg-card border border-primary/20 p-5 space-y-4 slide-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {editId ? "Edit Command" : "New Command"}
            </h3>
            <button onClick={handleCancel} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Command Name *</label>
              <input
                value={form.command}
                onChange={(e) => setForm((p) => ({ ...p, command: e.target.value }))}
                className={inputClass}
                placeholder="/price, /menu, /contact..."
              />
              <p className="text-[10px] text-muted-foreground mt-1">Must start with /</p>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className={inputClass}
                placeholder="What this command does..."
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Response Template *</label>
            <textarea
              value={form.response_template}
              onChange={(e) => setForm((p) => ({ ...p, response_template: e.target.value }))}
              className={cn(inputClass, "resize-none leading-relaxed")}
              rows={4}
              placeholder="The message to send when this command is triggered. Supports WhatsApp formatting: *bold*, _italic_, `code`"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Supports WhatsApp formatting: *bold*, _italic_, ~strikethrough~, `monospace`
            </p>
          </div>

          <div>
            <label className={labelClass}>Trigger Keywords</label>
            <input
              value={form.trigger_keywords}
              onChange={(e) => setForm((p) => ({ ...p, trigger_keywords: e.target.value }))}
              className={inputClass}
              placeholder="price, cost, how much, tarif (comma-separated)"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Plain text messages containing these words will trigger this command automatically
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <button onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}>
                {form.is_active
                  ? <ToggleRight className="w-6 h-6 text-primary" />
                  : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
              </button>
              <span className="text-xs text-muted-foreground">
                {form.is_active ? "Active — command will respond" : "Inactive — command is disabled"}
              </span>
            </div>

            <div className="flex gap-2">
              <button onClick={handleCancel} className="px-4 py-2 rounded-xl bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-all"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {editId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commands list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground">Loading commands...</span>
        </div>
      ) : commands.length === 0 ? (
        <div className="text-center py-12 rounded-2xl bg-card border border-border">
          <MessageSquare className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No custom commands yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Create your first command with the button above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {commands.map((cmd) => {
            const isExpanded = expandedId === cmd.id;
            return (
              <div key={cmd.id} className={cn(
                "rounded-2xl bg-card border transition-all overflow-hidden",
                cmd.is_active ? "border-border" : "border-border/50 opacity-60"
              )}>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Command name */}
                  <div className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-mono font-bold border shrink-0",
                    cmd.is_active ? "bg-primary/10 border-primary/20 text-primary" : "bg-secondary border-border text-muted-foreground"
                  )}>
                    {cmd.command}
                  </div>

                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{cmd.description || cmd.response_template.slice(0, 60) + "..."}</p>
                    {cmd.trigger_keywords?.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <Tag className="w-3 h-3 text-muted-foreground" />
                        {cmd.trigger_keywords.slice(0, 4).map((kw) => (
                          <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{kw}</span>
                        ))}
                        {cmd.trigger_keywords.length > 4 && (
                          <span className="text-[10px] text-muted-foreground">+{cmd.trigger_keywords.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Usage count */}
                  <div className="hidden sm:flex flex-col items-center text-center shrink-0">
                    <span className="text-sm font-bold text-foreground">{cmd.usage_count}</span>
                    <span className="text-[10px] text-muted-foreground">uses</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggle(cmd.id, cmd.is_active)}
                      className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                      title={cmd.is_active ? "Disable" : "Enable"}
                    >
                      {cmd.is_active
                        ? <ToggleRight className="w-4 h-4 text-primary" />
                        : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleEdit(cmd)}
                      className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cmd.id, cmd.command)}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : cmd.id)}
                      className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded response preview */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border pt-3 slide-in">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Response Template</p>
                    <div className="rounded-xl bg-dark-900 border border-border p-3">
                      <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap leading-relaxed">{cmd.response_template}</pre>
                    </div>
                    {cmd.trigger_keywords?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">All Trigger Keywords</p>
                        <div className="flex flex-wrap gap-1.5">
                          {cmd.trigger_keywords.map((kw) => (
                            <span key={kw} className="text-[11px] px-2 py-1 rounded-lg bg-secondary border border-border text-foreground font-mono">{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
