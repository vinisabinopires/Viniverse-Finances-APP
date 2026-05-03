import { useState, FormEvent } from "react";
import { Layout } from "@/components/Layout";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryPicker } from "@/components/CategoryPicker";
import {
  useLiveQuickTemplates, useLiveAccounts,
  addQuickTemplate, updateQuickTemplate, deleteQuickTemplate,
} from "@/hooks/use-finance";
import { formatMoney } from "@/utils";
import { Plus, Pencil, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { QuickTemplate } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const ICONS = ["☕","🛒","⛽","🍔","🍕","🛍️","🏠","🚗","💊","🎬","💰","✈️","📱","🎵","🎮","📚","💡","🔧","🌮","🍺"];

const STARTER_SUGGESTIONS: Array<Omit<QuickTemplate,"id"|"createdAt"|"updatedAt"|"sortOrder">> = [
  { name: "Coffee",    type: "EXPENSE", category: "Food",          icon: "☕", currencyCode: "USD", isActive: true },
  { name: "Groceries", type: "EXPENSE", category: "Groceries",     icon: "🛒", currencyCode: "USD", isActive: true },
  { name: "Gas",       type: "EXPENSE", category: "Transportation", icon: "⛽", currencyCode: "USD", isActive: true },
  { name: "Takeout",   type: "EXPENSE", category: "Dining",        icon: "🍔", currencyCode: "USD", isActive: true },
  { name: "Amazon",    type: "EXPENSE", category: "Shopping",      icon: "🛍️", currencyCode: "USD", isActive: true },
  { name: "Salary",    type: "INCOME",  category: "Salary",        icon: "💰", currencyCode: "USD", isActive: true },
];

// ─── Template Row ─────────────────────────────────────────────────────────────

function TemplateRow({
  template, onEdit, onDelete, onToggle, onMoveUp, onMoveDown, showUp, showDown,
}: {
  template: QuickTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  showUp: boolean;
  showDown: boolean;
}) {
  const isIn = template.type === "INCOME";
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl glass-card border ${template.isActive ? "border-white/10" : "border-white/5 opacity-60"}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${isIn ? "bg-emerald-500/15" : "bg-rose-500/15"}`}>
        {template.icon || (isIn ? "💰" : "💳")}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-semibold text-sm truncate">{template.name}</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${isIn ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" : "text-rose-400 bg-rose-500/15 border-rose-500/30"}`}>
            {isIn ? "Income" : "Expense"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {template.amountCents ? formatMoney(template.amountCents, template.currencyCode) : "Any amount"} · {template.category}
        </p>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {showUp && (
          <button onClick={onMoveUp} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
        {showDown && (
          <button onClick={onMoveDown} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
        <button onClick={onToggle} title={template.isActive ? "Hide from Dashboard" : "Show on Dashboard"} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          {template.isActive
            ? <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            : <EyeOff className="w-3.5 h-3.5 text-muted-foreground/50" />}
        </button>
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <Trash2 className="w-3.5 h-3.5 text-rose-400/70" />
        </button>
      </div>
    </div>
  );
}

// ─── Template Form Drawer ─────────────────────────────────────────────────────

function TemplateFormDrawer({
  template, open, onClose,
}: { template?: QuickTemplate; open: boolean; onClose: () => void }) {
  const accounts = useLiveAccounts();
  const { toast } = useToast();

  const [name,        setName]        = useState(template?.name ?? "");
  const [type,        setType]        = useState<"INCOME"|"EXPENSE">(template?.type ?? "EXPENSE");
  const [icon,        setIcon]        = useState(template?.icon ?? "💳");
  const [currency,    setCurrency]    = useState<"USD"|"BRL">(template?.currencyCode ?? "USD");
  const [amount,      setAmount]      = useState(template?.amountCents ? (template.amountCents / 100).toFixed(2) : "");
  const [accountId,   setAccountId]   = useState(template?.accountId ?? "");
  const [category,    setCategory]    = useState(template?.category ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [isActive,    setIsActive]    = useState(template?.isActive ?? true);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    if (!category.trim()) { setError("Category is required"); return; }
    setError(""); setSubmitting(true);
    try {
      const amountCents = amount && parseFloat(amount) > 0
        ? Math.round(parseFloat(amount) * 100) : undefined;
      const payload = {
        name: name.trim(), type, amountCents, currencyCode: currency,
        accountId: accountId || undefined, category,
        description: description.trim() || undefined,
        icon: icon || undefined, isActive,
        sortOrder: template?.sortOrder ?? Date.now(),
      };
      if (template) {
        await updateQuickTemplate(template.id, payload);
        toast({ title: "Template updated" });
      } else {
        await addQuickTemplate(payload);
        toast({ title: "Template created" });
      }
      onClose();
    } catch {
      setError("Failed to save template");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DrawerContent className="bg-background border-t border-white/10 text-foreground flex flex-col max-h-[92dvh]">
        <DrawerHeader className="px-4 pt-2 pb-2 flex-shrink-0">
          <DrawerTitle>{template ? "Edit Template" : "New Template"}</DrawerTitle>
        </DrawerHeader>
        <div
          className="flex-1 overflow-y-auto px-4"
          style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}
        >
          {open && (
            <form onSubmit={handleSubmit} className="space-y-4 pb-2">
              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                <button type="button" onClick={() => setType("EXPENSE")}
                  className={`py-2.5 rounded-lg text-sm font-medium transition-all ${type === "EXPENSE" ? "bg-rose-500/20 text-rose-400 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  Expense
                </button>
                <button type="button" onClick={() => setType("INCOME")}
                  className={`py-2.5 rounded-lg text-sm font-medium transition-all ${type === "INCOME" ? "bg-emerald-500/20 text-emerald-400 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  Income
                </button>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Template Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Morning Coffee, Amazon Order…"
                  className="bg-white/5 border-white/10" />
              </div>

              {/* Icon picker */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Icon</label>
                <div className="grid grid-cols-10 gap-1">
                  {ICONS.map((em) => (
                    <button key={em} type="button" onClick={() => setIcon(em)}
                      className={`text-xl py-1.5 rounded-lg transition-all ${icon === em ? "bg-primary/20 ring-1 ring-primary/50" : "hover:bg-white/10"}`}>
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* Currency */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Currency</label>
                <div className="flex gap-2">
                  {(["USD","BRL"] as const).map((c) => (
                    <button key={c} type="button" onClick={() => setCurrency(c)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${currency === c ? "bg-primary/20 text-primary border-primary/30" : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount (optional) */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Amount <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input type="number" step="0.01" min="0" inputMode="decimal"
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="Leave blank → user enters amount"
                  className="bg-white/5 border-white/10 text-xl font-semibold h-12" />
              </div>

              {/* Account (optional) */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Account <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Select
                  value={accountId || "__none__"}
                  onValueChange={(v) => setAccountId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue placeholder="User picks account" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-white/10">
                    <SelectItem value="__none__">User picks account</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.currencyCode})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category</label>
                <CategoryPicker value={category} onChange={setCategory} transactionType={type} />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Description <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Starbucks, Whole Foods…"
                  className="bg-white/5 border-white/10" />
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between py-1 border-t border-white/10 pt-3">
                <div>
                  <p className="text-sm font-medium">Show on Dashboard</p>
                  <p className="text-xs text-muted-foreground">Visible in Quick Templates section</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive((v) => !v)}
                  className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 ${isActive ? "bg-primary" : "bg-white/20"}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow-sm ${isActive ? "left-6" : "left-0.5"}`} />
                </button>
              </div>

              {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}

              <div className="space-y-2 pt-1">
                <Button type="submit" disabled={submitting}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl py-6 font-semibold disabled:opacity-60">
                  {submitting ? "Saving…" : template ? "Save Changes" : "Create Template"}
                </Button>
                <Button type="button" variant="outline" onClick={onClose} disabled={submitting}
                  className="w-full bg-white/5 border-white/10 hover:bg-white/10 text-foreground rounded-xl py-5 font-medium">
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuickTemplatesPage() {
  const templates    = useLiveQuickTemplates();
  const { toast }    = useToast();
  const [formOpen,    setFormOpen]   = useState(false);
  const [editTarget,  setEditTarget] = useState<QuickTemplate | undefined>();

  const startAdd  = () => { setEditTarget(undefined); setFormOpen(true); };
  const startEdit = (t: QuickTemplate) => { setEditTarget(t); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditTarget(undefined); };

  const active   = templates.filter((t) => t.isActive);
  const inactive = templates.filter((t) => !t.isActive);

  const handleToggle = async (t: QuickTemplate) => {
    await updateQuickTemplate(t.id, { isActive: !t.isActive });
    toast({ title: t.isActive ? "Hidden from Dashboard" : "Shown on Dashboard" });
  };

  const handleDelete = async (id: string, name: string) => {
    await deleteQuickTemplate(id);
    toast({ title: `"${name}" deleted` });
  };

  const handleMoveUp = async (t: QuickTemplate, idx: number) => {
    if (idx === 0) return;
    const above = active[idx - 1];
    await Promise.all([
      updateQuickTemplate(t.id,     { sortOrder: above.sortOrder }),
      updateQuickTemplate(above.id, { sortOrder: t.sortOrder }),
    ]);
  };

  const handleMoveDown = async (t: QuickTemplate, idx: number) => {
    if (idx >= active.length - 1) return;
    const below = active[idx + 1];
    await Promise.all([
      updateQuickTemplate(t.id,     { sortOrder: below.sortOrder }),
      updateQuickTemplate(below.id, { sortOrder: t.sortOrder }),
    ]);
  };

  const useStarter = async (s: typeof STARTER_SUGGESTIONS[0]) => {
    await addQuickTemplate({ ...s, sortOrder: Date.now() });
    toast({ title: `"${s.name}" template created` });
  };

  const unseenStarters = STARTER_SUGGESTIONS.filter((s) => !templates.some((t) => t.name === s.name));

  return (
    <Layout>
      <div className="p-4 space-y-5 pt-12 pb-8">

        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Layers className="w-6 h-6 text-primary" />
              Quick Templates
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">Shortcuts for frequent transactions.</p>
          </div>
          <Button
            onClick={startAdd}
            className="bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 rounded-xl px-3 py-2 h-auto text-sm font-medium"
          >
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </header>

        {/* Starter suggestions — shown when no templates at all */}
        {templates.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground px-1">
              No templates yet. Tap a suggestion to create one, or tap <strong>Add</strong> to build a custom one.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {STARTER_SUGGESTIONS.map((s) => (
                <button
                  key={s.name}
                  onClick={() => useStarter(s)}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-left hover:bg-white/10 active:scale-95 transition-all ${
                    s.type === "INCOME"
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <span className="text-xl">{s.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">{s.type === "INCOME" ? "Income" : "Expense"} · {s.category}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active templates */}
        {active.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Active ({active.length}) — shown on Dashboard
            </p>
            <div className="space-y-1.5">
              {active.map((t, idx) => (
                <TemplateRow
                  key={t.id}
                  template={t}
                  onEdit={() => startEdit(t)}
                  onDelete={() => handleDelete(t.id, t.name)}
                  onToggle={() => handleToggle(t)}
                  onMoveUp={() => handleMoveUp(t, idx)}
                  onMoveDown={() => handleMoveDown(t, idx)}
                  showUp={idx > 0}
                  showDown={idx < active.length - 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* Inactive templates */}
        {inactive.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Hidden ({inactive.length})
            </p>
            <div className="space-y-1.5">
              {inactive.map((t) => (
                <TemplateRow
                  key={t.id}
                  template={t}
                  onEdit={() => startEdit(t)}
                  onDelete={() => handleDelete(t.id, t.name)}
                  onToggle={() => handleToggle(t)}
                  showUp={false}
                  showDown={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* Partial starters suggestion (have some templates but missing classics) */}
        {templates.length > 0 && unseenStarters.length > 0 && (
          <div className="glass-card rounded-2xl p-4">
            <p className="text-xs font-semibold mb-2 text-muted-foreground">Suggested starters</p>
            <div className="space-y-0.5">
              {unseenStarters.slice(0, 4).map((s) => (
                <button
                  key={s.name}
                  onClick={() => useStarter(s)}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                >
                  <span className="text-base">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{s.category}</span>
                  </div>
                  <span className="text-xs text-primary font-medium">+ Use</span>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

      <TemplateFormDrawer template={editTarget} open={formOpen} onClose={closeForm} />
    </Layout>
  );
}
