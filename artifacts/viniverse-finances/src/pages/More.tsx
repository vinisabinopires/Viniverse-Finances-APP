import { useState, useRef } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearAllData, db } from "@/hooks/use-finance";
import { Download, Upload, Trash2, Info, Shield, AlertTriangle, RefreshCw, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function More() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteInputValue, setDeleteInputValue] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleClearData = async () => {
    if (deleteInputValue !== "DELETE") return;
    await clearAllData();
    localStorage.removeItem('viniverse-onboarded');
    setShowDeleteConfirm(false);
    setDeleteInputValue("");
    toast({ title: "Data cleared", description: "All data deleted. Reloading…" });
    setTimeout(() => { window.location.reload(); }, 1200);
  };

  const handleExport = async () => {
    try {
      const accounts = await db.accounts.toArray();
      const transactions = await db.transactions.toArray();
      const budgets = await db.budgets.toArray();
      const recurringRules = await db.recurringRules.toArray();
      const data = {
        accounts,
        transactions,
        budgets,
        recurringRules,
        exportedAt: new Date().toISOString(),
        version: 3,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `viniverse-finances-backup-${today}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export successful", description: `Saved as viniverse-finances-backup-${today}.json` });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      toast({ title: "Import failed", description: "The file is not valid JSON.", variant: "destructive" });
      return;
    }

    const p = parsed as Record<string, unknown>;
    if (typeof p !== "object" || p === null || !Array.isArray(p.accounts) || !Array.isArray(p.transactions)) {
      toast({ title: "Import failed", description: "The file doesn't look like a Viniverse backup.", variant: "destructive" });
      return;
    }

    try {
      const { accounts, transactions } = p as { accounts: unknown[]; transactions: unknown[] };
      const budgets = Array.isArray(p.budgets) ? (p.budgets as unknown[]) : [];
      const recurringRules = Array.isArray(p.recurringRules) ? (p.recurringRules as unknown[]) : [];

      await clearAllData();
      await db.accounts.bulkAdd(accounts as Parameters<typeof db.accounts.bulkAdd>[0]);
      await db.transactions.bulkAdd(transactions as Parameters<typeof db.transactions.bulkAdd>[0]);
      if (budgets.length > 0) {
        await db.budgets.bulkAdd(budgets as Parameters<typeof db.budgets.bulkAdd>[0]);
      }
      if (recurringRules.length > 0) {
        await db.recurringRules.bulkAdd(recurringRules as Parameters<typeof db.recurringRules.bulkAdd>[0]);
      }
      localStorage.setItem('viniverse-onboarded', 'true');
      toast({
        title: "Import successful",
        description: `Restored ${accounts.length} accounts, ${transactions.length} transactions, ${budgets.length} budgets, ${recurringRules.length} recurring rules.`,
      });
      setTimeout(() => { window.location.reload(); }, 1200);
    } catch {
      toast({ title: "Import failed", description: "Something went wrong while restoring your data.", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="p-4 space-y-5 pt-12 pb-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your app and data.</p>
        </header>

        <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/10 border border-white/10">
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">Viniverse – Finances</h3>
              <p className="text-xs text-muted-foreground">Version 1.3.0 · Personal finance tracker</p>
            </div>
          </div>
        </div>

        {/* Features section */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground px-1 uppercase tracking-wide">Features</h3>
          <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
            <Link href="/recurring" className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-sm">Recurring Transactions</h3>
                <p className="text-xs text-muted-foreground">Automate income and expense rules</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
            </Link>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 flex gap-3 border border-amber-500/20 bg-amber-500/5">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400">Local storage only</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
              All your data lives exclusively in this browser. Export a backup regularly to keep it safe.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground px-1 uppercase tracking-wide">Data Management</h3>

          <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/10 border border-white/10">
            <button onClick={handleExport} data-testid="btn-export" className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Download className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Export Backup</h3>
                <p className="text-xs text-muted-foreground">Accounts, transactions, budgets &amp; rules</p>
              </div>
            </button>

            <button onClick={() => fileInputRef.current?.click()} data-testid="btn-import" className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Upload className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Import Backup</h3>
                <p className="text-xs text-muted-foreground">Restore from a JSON file</p>
              </div>
            </button>
            <input type="file" accept=".json,application/json" className="hidden" ref={fileInputRef} onChange={handleImport} />

            <button onClick={() => setShowDeleteConfirm(!showDeleteConfirm)} data-testid="btn-toggle-delete" className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left text-rose-400">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Clear All Data</h3>
                <p className="text-xs text-rose-400/60">Permanently delete everything</p>
              </div>
            </button>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="glass-card rounded-2xl p-5 border border-rose-500/20 bg-rose-500/5 space-y-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-rose-400">Confirm deletion</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  This will permanently erase all accounts, transactions, budgets, and recurring rules. Type{" "}
                  <span className="font-mono font-bold text-rose-400">DELETE</span> to confirm.
                </p>
              </div>
            </div>
            <Input
              placeholder="Type DELETE to confirm"
              value={deleteInputValue}
              onChange={(e) => setDeleteInputValue(e.target.value)}
              data-testid="input-delete-confirm"
              className="bg-white/5 border-rose-500/30 font-mono placeholder:font-sans"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setDeleteInputValue(""); }} className="flex-1 bg-white/5 border-white/10 hover:bg-white/10" data-testid="btn-cancel-clear">
                Cancel
              </Button>
              <Button onClick={handleClearData} disabled={deleteInputValue !== "DELETE"} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white disabled:opacity-40" data-testid="btn-confirm-clear">
                Delete Everything
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
