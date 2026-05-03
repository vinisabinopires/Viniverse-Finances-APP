import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { useLiveAccounts, useLiveTransactions, useLiveQuickTemplates } from "@/hooks/use-finance";
import { TransactionCard } from "@/components/TransactionCard";
import { TransactionDetailDrawer } from "@/components/TransactionDetailDrawer";
import { TransactionForm } from "@/components/TransactionForm";
import { MonthSelector } from "@/components/MonthSelector";
import { motion, AnimatePresence } from "framer-motion";
import { TransactionDrawer } from "@/components/TransactionDrawer";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Search, X, Layers } from "lucide-react";
import { formatMoney } from "@/utils";
import { useToast } from "@/hooks/use-toast";
import type { Transaction, QuickTemplate } from "@/types";

type FilterType = "ALL" | "INCOME" | "EXPENSE";

export default function Transactions() {
  const [currentDate,   setCurrentDate]   = useState(new Date());
  const [filterType,    setFilterType]    = useState<FilterType>("ALL");
  const [search,        setSearch]        = useState("");
  const [selectedTx,    setSelectedTx]    = useState<Transaction | null>(null);
  const [tplDrawerOpen, setTplDrawerOpen] = useState(false);
  const [activeTpl,     setActiveTpl]     = useState<QuickTemplate | null>(null);

  const transactions    = useLiveTransactions();
  const accounts        = useLiveAccounts();
  const quickTemplates  = useLiveQuickTemplates();
  const { toast }       = useToast();

  const activeTemplates = quickTemplates.filter((t) => t.isActive);

  const openTemplate = (t: QuickTemplate) => {
    setActiveTpl(t);
    setTplDrawerOpen(true);
  };

  const closeTplDrawer = () => {
    setTplDrawerOpen(false);
    setActiveTpl(null);
  };

  const currentMonthTransactions = transactions.filter((t) => {
    const tDate = new Date(t.occurredAt);
    return (
      tDate.getMonth() === currentDate.getMonth() &&
      tDate.getFullYear() === currentDate.getFullYear()
    );
  });

  const filteredTransactions = useMemo(() => {
    let list = currentMonthTransactions;
    if (filterType !== "ALL") {
      list = list.filter((t) => t.type === filterType);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.description?.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [currentMonthTransactions, filterType, search]);

  const hasActiveFilters = filterType !== "ALL" || search.trim() !== "";

  const clearFilters = () => {
    setFilterType("ALL");
    setSearch("");
  };

  return (
    <Layout>
      <div className="p-4 space-y-4 pt-12">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground text-sm mt-1">Review your income and expenses.</p>
        </header>

        <MonthSelector currentDate={currentDate} onChange={setCurrentDate} />

        {/* ── Quick Templates row ──────────────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-3">
          <div className="flex items-center justify-between mb-2 px-0.5">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Quick Templates</p>
            </div>
            <Link href="/quick-templates" className="text-xs text-primary hover:text-primary/80">Manage</Link>
          </div>

          {activeTemplates.length === 0 ? (
            <div className="flex items-center justify-between py-0.5">
              <p className="text-xs text-muted-foreground">Create shortcuts for frequent transactions</p>
              <Link href="/quick-templates">
                <button className="text-xs text-primary font-medium bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors">
                  Create
                </button>
              </Link>
            </div>
          ) : (
            <div
              className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {activeTemplates.slice(0, 6).map((t) => (
                <button
                  key={t.id}
                  onClick={() => openTemplate(t)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border flex-shrink-0 transition-all hover:brightness-110 active:scale-95 ${
                    t.type === "INCOME"
                      ? "bg-emerald-500/8 border-emerald-500/20"
                      : "bg-rose-500/8 border-rose-500/20"
                  }`}
                >
                  <span className="text-base leading-none">{t.icon || (t.type === "INCOME" ? "💰" : "💳")}</span>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-semibold whitespace-nowrap">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {t.amountCents ? formatMoney(t.amountCents, t.currencyCode) : "any amount"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search description, category, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-transactions"
            className="bg-white/5 border-white/10 pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              data-testid="btn-clear-search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Type filter ─────────────────────────────────────────────────── */}
        <div className="flex gap-2">
          <div className="flex flex-1 bg-white/5 p-1 rounded-xl border border-white/10">
            {(["ALL", "INCOME", "EXPENSE"] as FilterType[]).map((type) => (
              <button
                key={type}
                data-testid={`filter-${type.toLowerCase()}`}
                onClick={() => setFilterType(type)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterType === type
                    ? type === "INCOME"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : type === "EXPENSE"
                      ? "bg-rose-500/20 text-rose-400"
                      : "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {type === "ALL" ? "All" : type === "INCOME" ? "Income" : "Expense"}
              </button>
            ))}
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              data-testid="btn-clear-filters"
              className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        <div className="text-xs text-muted-foreground px-1">
          {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""}
        </div>

        {/* ── Transaction list ─────────────────────────────────────────────── */}
        <div className="space-y-2 pb-8">
          <AnimatePresence mode="popLayout">
            {filteredTransactions.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-14 glass-card rounded-2xl"
              >
                <p className="text-muted-foreground text-sm">No transactions found.</p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </motion.div>
            ) : (
              filteredTransactions.map((t, i) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                >
                  <TransactionCard transaction={t} onClick={() => setSelectedTx(t)} />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── FAB + regular add transaction drawer ─────────────────────────── */}
      <TransactionDrawer />

      {/* ── Template-prefilled drawer ────────────────────────────────────── */}
      <Drawer open={tplDrawerOpen} onOpenChange={(o) => { if (!o) closeTplDrawer(); }}>
        <DrawerContent className="bg-background border-t border-white/10 text-foreground flex flex-col max-h-[92dvh]">
          <DrawerHeader className="px-4 pt-2 pb-2 flex-shrink-0">
            <DrawerTitle>{activeTpl?.name ?? "Quick Add"}</DrawerTitle>
          </DrawerHeader>
          <div
            className="flex-1 overflow-y-auto px-4"
            style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}
          >
            {tplDrawerOpen && activeTpl && (
              <TransactionForm
                defaultType={activeTpl.type}
                initialValues={{
                  type:        activeTpl.type,
                  amount:      activeTpl.amountCents ? (activeTpl.amountCents / 100).toFixed(2) : undefined,
                  accountId:   activeTpl.accountId,
                  category:    activeTpl.category,
                  description: activeTpl.description,
                  notes:       activeTpl.notes,
                }}
                onSuccess={() => {
                  closeTplDrawer();
                  toast({ title: `${activeTpl.name} saved` });
                }}
                onCancel={closeTplDrawer}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Detail drawer (edit/delete existing tx) ──────────────────────── */}
      <TransactionDetailDrawer
        transaction={selectedTx}
        accounts={accounts}
        onClose={() => setSelectedTx(null)}
      />
    </Layout>
  );
}
