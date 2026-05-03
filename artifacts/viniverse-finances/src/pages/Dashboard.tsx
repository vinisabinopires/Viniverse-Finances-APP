import { useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionDrawer } from "@/components/TransactionDrawer";
import { TransactionDetailDrawer } from "@/components/TransactionDetailDrawer";
import { MonthSelector } from "@/components/MonthSelector";
import { TransactionCard } from "@/components/TransactionCard";
import {
  useLiveAccounts, useLiveTransactions, useLiveBudgets, useLiveRecurringRules,
  useLiveGoals, useLiveSnapshots, useLiveWeeklyPlans,
  calcBudgetSpent, calcNetWorth, getNextOccurrenceAfter,
  getWeekStartDate, getWeekEndDate, toDateStr, generateDueTransactions,
} from "@/hooks/use-finance";
import { formatMoney, formatDate, formatFrequency, formatMonthYear } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownRight, ArrowUpRight, TrendingUp, Target, ChevronRight, RefreshCw,
  BarChart2, Zap, FileBarChart2, Sparkles, ChevronDown, ChevronUp,
  Minus, Plus, Camera, Download, Rows3,
} from "lucide-react";
import { GOAL_TYPE_META } from "@/constants/goals";
import { useToast } from "@/hooks/use-toast";
import type { Transaction } from "@/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const FIXED_CATEGORIES = new Set([
  'rent', 'housing', 'mortgage', 'subscription', 'subscriptions',
  'phone', 'internet', 'utilities', 'electricity', 'water', 'gas',
  'insurance', 'health', 'healthcare', 'education', 'loan', 'loans', 'debt',
]);

function getBudgetStatus(pct: number) {
  if (pct >= 100) return { label: "Over Budget", color: "rose"    } as const;
  if (pct >= 70)  return { label: "Caution",     color: "amber"   } as const;
  return                 { label: "Safe",         color: "emerald" } as const;
}
const barColors  = { emerald: "bg-emerald-500/70", amber: "bg-amber-500/70", rose: "bg-rose-500/70" };
const textColors = { emerald: "text-emerald-400",  amber: "text-amber-400",  rose: "text-rose-400"  };

// ─── localStorage helpers ─────────────────────────────────────────────────────

function readCompact(): boolean {
  return localStorage.getItem('viniverse-compact') === 'true';
}
function readCollapsed(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem('viniverse-dash-collapsed') || '{}'); }
  catch { return {}; }
}

// Default expanded/collapsed state for each section key
const SECTION_DEFAULTS: Record<string, boolean> = {
  'budget-watch':    false, // expanded
  'recurring-watch': false, // expanded
  'recent-tx':       false, // expanded
  'goals-progress':  true,  // collapsed
  'net-worth':       true,  // collapsed
  'top-expenses':    true,  // collapsed
};

// ─── Section header with collapse toggle ─────────────────────────────────────

function SectionHeader({
  icon: Icon, title, link, linkLabel, count, isCollapsed, onToggle, compact,
}: {
  icon: React.ElementType;
  title: string;
  link?: string;
  linkLabel?: string;
  count?: number;
  isCollapsed: boolean;
  onToggle: () => void;
  compact: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between ${compact ? 'mb-2' : 'mb-3'}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
        {count !== undefined && count > 0 && (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">({count})</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {link && !isCollapsed && (
          <Link
            href={link}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {linkLabel ?? "All"} <ChevronRight className="w-3 h-3" />
          </Link>
        )}
        {isCollapsed
          ? <ChevronDown className="w-4 h-4 text-muted-foreground/40" />
          : <ChevronUp   className="w-4 h-4 text-muted-foreground/40" />}
      </div>
    </button>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // UI state
  const [currentDate, setCurrentDate]   = useState(new Date());
  const [selectedTx, setSelectedTx]     = useState<Transaction | null>(null);
  const [qaOpen, setQaOpen]             = useState(false);
  const [qaType, setQaType]             = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [isGenerating, setIsGenerating] = useState(false);

  // Compact mode (localStorage)
  const [compact, setCompact] = useState<boolean>(readCompact);
  const toggleCompact = useCallback(() => {
    setCompact((prev) => {
      const next = !prev;
      localStorage.setItem('viniverse-compact', String(next));
      return next;
    });
  }, []);

  // Collapsible sections (localStorage)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsed);
  const toggleSection = useCallback((key: string) => {
    setCollapsed((prev) => {
      const defaultVal = SECTION_DEFAULTS[key] ?? false;
      const current    = key in prev ? prev[key] : defaultVal;
      const next       = { ...prev, [key]: !current };
      localStorage.setItem('viniverse-dash-collapsed', JSON.stringify(next));
      return next;
    });
  }, []);
  const isSectionCollapsed = (key: string) =>
    key in collapsed ? collapsed[key] : (SECTION_DEFAULTS[key] ?? false);

  // Data
  const accounts       = useLiveAccounts();
  const transactions   = useLiveTransactions();
  const budgets        = useLiveBudgets();
  const recurringRules = useLiveRecurringRules();
  const goals          = useLiveGoals();
  const snapshots      = useLiveSnapshots();
  const weeklyPlans    = useLiveWeeklyPlans();

  // ─── Month calculations ──────────────────────────────────────────────────
  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthTx = transactions.filter((t) => {
    const d = new Date(t.occurredAt);
    return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
  });
  const monthTxUsd      = currentMonthTx.filter((t) => t.currencyCode === "USD");
  const monthIncomeUsd  = monthTxUsd.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amountCents, 0);
  const monthExpenseUsd = monthTxUsd.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amountCents, 0);
  const monthNetUsd     = monthIncomeUsd - monthExpenseUsd;
  const savingsRateUsd  = monthIncomeUsd > 0 ? Math.round((monthNetUsd / monthIncomeUsd) * 100) : null;

  // ─── Net worth ──────────────────────────────────────────────────────────
  const { totalUsdCents, totalBrlCents } = calcNetWorth(accounts, transactions);
  const latestSnapshot = snapshots[0] ?? null;

  // ─── This week (USD) ────────────────────────────────────────────────────
  const today        = new Date();
  const weekStart    = getWeekStartDate(today);
  const weekEnd      = getWeekEndDate(today);
  const weekStartStr = toDateStr(weekStart);
  const weekEndStr   = toDateStr(weekEnd);
  const weekTxUsd    = transactions.filter((t) => {
    const d = t.occurredAt.slice(0, 10);
    return d >= weekStartStr && d <= weekEndStr && t.currencyCode === 'USD';
  });
  const weekIncome       = weekTxUsd.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amountCents, 0);
  const weekExpenses     = weekTxUsd.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amountCents, 0);
  const weekNet          = weekIncome - weekExpenses;
  const weekPlan         = weeklyPlans.find((p) => p.weekStartDate === weekStartStr && p.currencyCode === 'USD');
  const weekVarUsed      = weekTxUsd.filter((t) => t.type === 'EXPENSE' && !FIXED_CATEGORIES.has(t.category.toLowerCase())).reduce((s, t) => s + t.amountCents, 0);
  const weekVarRemaining = weekPlan ? Math.max(weekPlan.plannedVariableSpendingCents - weekVarUsed, 0) : null;
  const weekDaysLeft     = Math.max(Math.ceil((weekEnd.getTime() - today.getTime()) / 86400000), 1);
  const weekSafeDaily    = weekVarRemaining != null && weekDaysLeft > 0 ? Math.floor(weekVarRemaining / weekDaysLeft) : null;

  // ─── Goals ──────────────────────────────────────────────────────────────
  const activeGoals = goals.filter((g) => !g.isArchived);
  const dashGoals   = [
    ...activeGoals.filter((g) => g.goalType === "EMERGENCY_FUND"),
    ...activeGoals.filter((g) => g.goalType !== "EMERGENCY_FUND")
      .map((g) => ({ g, pct: g.targetAmountCents > 0 ? g.currentAmountCents / g.targetAmountCents : 0 }))
      .sort((a, b) => b.pct - a.pct).map((x) => x.g),
  ].slice(0, 3);

  // ─── Upcoming recurring ─────────────────────────────────────────────────
  const in14 = new Date(today); in14.setDate(today.getDate() + 14);
  const upcomingRecurring = recurringRules
    .filter((r) => r.isActive)
    .map((r) => ({ rule: r, nextDue: getNextOccurrenceAfter(r, today) }))
    .filter((x): x is { rule: typeof x.rule; nextDue: Date } => x.nextDue !== null && x.nextDue <= in14)
    .sort((a, b) => a.nextDue.getTime() - b.nextDue.getTime())
    .slice(0, 5);

  // ─── Budgets ─────────────────────────────────────────────────────────────
  const monthBudgets = budgets
    .filter((b) => b.month === currentMonth)
    .map((b) => ({ budget: b, spent: calcBudgetSpent(transactions, b.category, b.month, b.currencyCode), pct: 0 }))
    .map((x) => ({ ...x, pct: Math.round((x.spent / x.budget.monthlyLimitCents) * 100) }))
    .sort((a, b) => b.pct - a.pct).slice(0, 5);

  // ─── Top categories ──────────────────────────────────────────────────────
  const categoryTotals    = currentMonthTx.filter((t) => t.type === "EXPENSE" && t.currencyCode === "USD").reduce<Record<string, number>>((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amountCents; return acc; }, {});
  const topCategories     = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCategoryAmount = topCategories[0]?.[1] || 1;
  const recentTransactions = currentMonthTx.slice(0, 5);

  // ─── Generate Due ────────────────────────────────────────────────────────
  const handleGenerateDue = useCallback(async () => {
    if (isGenerating) return;
    const activeRules = recurringRules.filter((r) => r.isActive);
    if (activeRules.length === 0) {
      toast({ title: "No active recurring rules", description: "Set up recurring rules first." });
      return;
    }
    setIsGenerating(true);
    try {
      const { created, skipped } = await generateDueTransactions(activeRules);
      toast({
        title: created > 0 ? `Generated ${created} transaction${created !== 1 ? 's' : ''}` : "Already up to date",
        description: skipped > 0 ? `${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped.` : undefined,
      });
    } catch {
      toast({ title: "Generate failed", description: "Check recurring rules and try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [recurringRules, isGenerating, toast]);

  // ─── Quick action helpers ────────────────────────────────────────────────
  const openQa = (type: "EXPENSE" | "INCOME") => { setQaType(type); setQaOpen(true); };

  // ─── Layout spacing ──────────────────────────────────────────────────────
  const cardPad  = compact ? "p-4" : "p-5";
  const gap      = compact ? "space-y-3" : "space-y-5";
  const innerGap = compact ? "space-y-3" : "space-y-4";

  return (
    <Layout>
      <div className={`p-4 ${gap} pb-6`}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="pt-8 pb-1 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
              Viniverse
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">Your finances, under control.</p>
          </div>
          <button
            onClick={toggleCompact}
            title={compact ? "Switch to Comfort mode" : "Switch to Compact mode"}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl"
          >
            <Rows3 className="w-3.5 h-3.5" />
            {compact ? "Comfort" : "Compact"}
          </button>
        </header>

        <MonthSelector currentDate={currentDate} onChange={setCurrentDate} />

        {/* ── Setup prompt ────────────────────────────────────────────── */}
        {accounts.length === 0 && recurringRules.length === 0 && (
          <Link href="/setup">
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-2xl border border-indigo-500/25 bg-indigo-500/5 p-4 flex items-center gap-3 cursor-pointer hover:bg-indigo-500/10 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-indigo-300">Set up your real financial profile</p>
                <p className="text-xs text-muted-foreground mt-0.5">Add accounts, income, bills, budgets and goals.</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
            </motion.div>
          </Link>
        )}

        {/* ── Quick Actions ────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-3" data-testid="card-quick-actions">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 px-1">Quick Actions</p>
          <div className="grid grid-cols-5 gap-1">
            {[
              { label: "Expense",  icon: Minus,      color: "text-rose-400",    bg: "bg-rose-500/10",    action: () => openQa("EXPENSE") },
              { label: "Income",   icon: Plus,       color: "text-emerald-400", bg: "bg-emerald-500/10", action: () => openQa("INCOME") },
              { label: "Generate", icon: RefreshCw,  color: "text-indigo-400",  bg: "bg-indigo-500/10",  action: handleGenerateDue },
              { label: "Snapshot", icon: Camera,     color: "text-cyan-400",    bg: "bg-cyan-500/10",    action: () => navigate('/net-worth') },
              { label: "Backup",   icon: Download,   color: "text-amber-400",   bg: "bg-amber-500/10",   action: () => navigate('/more') },
            ].map(({ label, icon: Icon, color, bg, action }) => (
              <button
                key={label}
                onClick={action}
                disabled={label === "Generate" && isGenerating}
                className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl hover:bg-white/5 active:scale-95 transition-all disabled:opacity-50`}
                data-testid={`qa-${label.toLowerCase()}`}
              >
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color} ${label === "Generate" && isGenerating ? "animate-spin" : ""}`} />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground leading-tight text-center">{label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── This Week ───────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className={`glass-card ${cardPad} rounded-2xl`} data-testid="card-this-week">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">This Week · USD</h3>
            </div>
            <Link href="/weekly-cashflow" className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5">
              Plan <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div><p className="text-[10px] text-emerald-400 mb-0.5">Income</p><p className="text-sm font-bold text-emerald-400 tabular-nums">{formatMoney(weekIncome, "USD")}</p></div>
            <div><p className="text-[10px] text-rose-400 mb-0.5">Expenses</p><p className="text-sm font-bold text-rose-400 tabular-nums">{formatMoney(weekExpenses, "USD")}</p></div>
            <div><p className="text-[10px] text-muted-foreground mb-0.5">Net</p><p className={`text-sm font-bold tabular-nums ${weekNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{weekNet >= 0 ? "+" : ""}{formatMoney(weekNet, "USD")}</p></div>
          </div>
          {weekSafeDaily != null ? (
            <div className="flex items-center gap-2 text-xs">
              <Zap className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
              <span className="text-muted-foreground">Safe daily:</span>
              <span className="font-semibold text-indigo-400">{formatMoney(weekSafeDaily, "USD")}/day</span>
              <span className="text-muted-foreground">· {weekDaysLeft}d left</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              <Link href="/weekly-cashflow" className="text-primary hover:underline">Set up a weekly plan</Link> to track safe-to-spend.
            </p>
          )}
        </motion.div>

        {/* ── Monthly Snapshot ─────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className={`glass-card ${cardPad} rounded-2xl`} data-testid="card-monthly-snapshot">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileBarChart2 className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{formatMonthYear(currentMonth + "-01")} · USD</h3>
            </div>
            <Link href="/reports" className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5">
              Report <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div><p className="text-[10px] text-emerald-400 mb-0.5">Income</p><p className="text-sm font-bold text-emerald-400 tabular-nums">{formatMoney(monthIncomeUsd, "USD")}</p></div>
            <div><p className="text-[10px] text-rose-400 mb-0.5">Expenses</p><p className="text-sm font-bold text-rose-400 tabular-nums">{formatMoney(monthExpenseUsd, "USD")}</p></div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Net</p>
              <p className={`text-sm font-bold tabular-nums ${monthNetUsd >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {monthNetUsd >= 0 ? "+" : ""}{formatMoney(monthNetUsd, "USD")}
              </p>
            </div>
          </div>
          {savingsRateUsd != null ? (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Savings rate:</span>
              <span className={`font-semibold ${savingsRateUsd >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{savingsRateUsd}%</span>
              <span className="text-muted-foreground ml-auto">{monthTxUsd.length} tx</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No income recorded. <Link href="/reports" className="text-primary hover:underline">View full report.</Link>
            </p>
          )}
        </motion.div>

        {/* ── Balances ─────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="glass-card p-6 rounded-3xl relative overflow-hidden" data-testid="card-total-balance">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="relative z-10">
            <p className="text-sm font-medium text-muted-foreground mb-1">Net Balance</p>
            <div className="flex flex-col gap-0.5 mb-4">
              <h2 className="text-4xl font-bold tracking-tight">{formatMoney(totalUsdCents, "USD")}</h2>
              {totalBrlCents !== 0 && (
                <p className="text-sm text-muted-foreground font-medium">+ {formatMoney(totalBrlCents, "BRL")}</p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground mb-0.5">🇺🇸 USD</p>
                <p className={`text-sm font-bold tabular-nums ${totalUsdCents < 0 ? "text-rose-400" : ""}`}>{formatMoney(totalUsdCents, "USD")}</p>
              </div>
              {totalBrlCents !== 0 && (
                <div>
                  <p className="text-muted-foreground mb-0.5">🇧🇷 BRL</p>
                  <p className={`text-sm font-bold tabular-nums ${totalBrlCents < 0 ? "text-rose-400" : ""}`}>{formatMoney(totalBrlCents, "BRL")}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground mb-0.5">Accounts</p>
                <p className="text-sm font-bold">{accounts.length}</p>
              </div>
            </div>
            <Link href="/accounts" className="mt-4 flex items-center gap-1 text-xs text-primary hover:text-primary/80 w-fit">
              View Accounts <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </motion.div>

        {/* ── Budget Watch (collapsible, default expanded) ─────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }} className={`glass-card ${cardPad} rounded-2xl`} data-testid="card-budget-watch">
          <SectionHeader
            icon={Target}
            title="Budget Watch"
            link="/budgets"
            linkLabel="All"
            count={monthBudgets.length}
            isCollapsed={isSectionCollapsed('budget-watch')}
            onToggle={() => toggleSection('budget-watch')}
            compact={compact}
          />
          <AnimatePresence>
            {!isSectionCollapsed('budget-watch') && (
              <motion.div key="budget-content" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                {monthBudgets.length === 0 ? (
                  <div className="py-3 text-center">
                    <p className="text-xs text-muted-foreground">No budgets for {formatMonthYear(currentMonth + "-01")}.</p>
                    <Link href="/budgets" className="text-xs text-primary hover:underline mt-1 block">Create your first budget →</Link>
                  </div>
                ) : (
                  <div className={innerGap}>
                    {monthBudgets.map(({ budget, spent, pct }, i) => {
                      const status = getBudgetStatus(pct);
                      return (
                        <motion.div key={budget.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium truncate">{budget.category}</span>
                              <span className={`text-[10px] font-semibold shrink-0 ${textColors[status.color]}`}>{status.label}</span>
                            </div>
                            <span className={`text-xs font-medium tabular-nums shrink-0 ${textColors[status.color]}`}>{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColors[status.color]}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{formatMoney(spent, budget.currencyCode)} spent</span>
                            <span>of {formatMoney(budget.monthlyLimitCents, budget.currencyCode)}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Upcoming Recurring (collapsible, default expanded) ───────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className={`glass-card ${cardPad} rounded-2xl`} data-testid="card-recurring-watch">
          <SectionHeader
            icon={RefreshCw}
            title="Upcoming Recurring"
            link="/recurring"
            linkLabel="All"
            count={upcomingRecurring.length}
            isCollapsed={isSectionCollapsed('recurring-watch')}
            onToggle={() => toggleSection('recurring-watch')}
            compact={compact}
          />
          <AnimatePresence>
            {!isSectionCollapsed('recurring-watch') && (
              <motion.div key="rec-content" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                {upcomingRecurring.length === 0 ? (
                  <div className="py-3 text-center">
                    {recurringRules.filter((r) => r.isActive).length === 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground">No recurring rules yet.</p>
                        <Link href="/recurring" className="text-xs text-primary hover:underline mt-1 block">Set up recurring income & bills →</Link>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nothing due in the next 14 days.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {upcomingRecurring.map(({ rule, nextDue }) => {
                      const isIncome  = rule.type === "INCOME";
                      const daysUntil = Math.ceil((nextDue.getTime() - today.getTime()) / 86400000);
                      return (
                        <div key={rule.id} className="flex items-center gap-3 py-2 px-1">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isIncome ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                            {isIncome ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{rule.name}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(nextDue.toISOString())} · {formatFrequency(rule.frequency)}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-sm font-semibold ${isIncome ? "text-emerald-400" : "text-rose-400"}`}>
                              {isIncome ? "+" : "-"}{formatMoney(rule.amountCents, rule.currencyCode)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{daysUntil <= 0 ? "Today" : `in ${daysUntil}d`}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Goals Progress (collapsible, default collapsed) ──────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className={`glass-card ${cardPad} rounded-2xl`} data-testid="card-goals-progress">
          <SectionHeader
            icon={Target}
            title="Goals Progress"
            link="/goals"
            linkLabel="All"
            count={activeGoals.length}
            isCollapsed={isSectionCollapsed('goals-progress')}
            onToggle={() => toggleSection('goals-progress')}
            compact={compact}
          />
          <AnimatePresence>
            {!isSectionCollapsed('goals-progress') && (
              <motion.div key="goals-content" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                {dashGoals.length === 0 ? (
                  <div className="py-3 text-center">
                    <p className="text-xs text-muted-foreground">No goals yet.</p>
                    <Link href="/goals" className="text-xs text-primary hover:underline mt-1 block">Create your first financial goal →</Link>
                  </div>
                ) : (
                  <div className={innerGap}>
                    {dashGoals.map((goal, i) => {
                      const pct      = goal.targetAmountCents > 0 ? Math.min(Math.round((goal.currentAmountCents / goal.targetAmountCents) * 100), 100) : 0;
                      const meta     = GOAL_TYPE_META[goal.goalType];
                      const barColor = pct >= 100 ? "bg-yellow-400" : pct >= 70 ? "bg-emerald-500/80" : pct >= 30 ? "bg-indigo-500/80" : "bg-blue-500/80";
                      return (
                        <motion.div key={goal.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base leading-none flex-shrink-0">{meta.emoji}</span>
                              <span className="text-sm font-medium truncate">{goal.name}</span>
                            </div>
                            <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${pct >= 100 ? "text-yellow-400" : "text-muted-foreground"}`}>{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{formatMoney(goal.currentAmountCents, goal.currencyCode)}</span>
                            <span>{formatMoney(goal.targetAmountCents, goal.currencyCode)}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Net Worth (collapsible, default collapsed) ───────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className={`glass-card ${cardPad} rounded-2xl`} data-testid="card-net-worth">
          <SectionHeader
            icon={TrendingUp}
            title="Net Worth"
            link="/net-worth"
            linkLabel="View"
            isCollapsed={isSectionCollapsed('net-worth')}
            onToggle={() => toggleSection('net-worth')}
            compact={compact}
          />
          <AnimatePresence>
            {!isSectionCollapsed('net-worth') && (
              <motion.div key="nw-content" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">🇺🇸 USD</p>
                    <p className={`text-lg font-bold tabular-nums ${totalUsdCents < 0 ? "text-rose-400" : ""}`}>{formatMoney(totalUsdCents, "USD")}</p>
                  </div>
                  {totalBrlCents !== 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">🇧🇷 BRL</p>
                      <p className={`text-lg font-bold tabular-nums ${totalBrlCents < 0 ? "text-rose-400" : ""}`}>{formatMoney(totalBrlCents, "BRL")}</p>
                    </div>
                  )}
                </div>
                {latestSnapshot ? (
                  <p className="text-xs text-muted-foreground">
                    {latestSnapshot.totalConvertedToUsdCents != null && (
                      <span className="text-indigo-400 font-medium">≈ {formatMoney(latestSnapshot.totalConvertedToUsdCents, "USD")} consolidated · </span>
                    )}
                    Snapshot {formatDate(latestSnapshot.snapshotDate)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    <Link href="/net-worth" className="text-primary hover:underline">Create a snapshot</Link> to track growth over time.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Top Expenses (collapsible, default collapsed) ────────────── */}
        {topCategories.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className={`glass-card ${cardPad} rounded-2xl`} data-testid="card-top-categories">
            <SectionHeader
              icon={TrendingUp}
              title="Top Expenses"
              isCollapsed={isSectionCollapsed('top-expenses')}
              onToggle={() => toggleSection('top-expenses')}
              compact={compact}
            />
            <AnimatePresence>
              {!isSectionCollapsed('top-expenses') && (
                <motion.div key="top-content" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                  <div className="space-y-3">
                    {topCategories.map(([category, amount], i) => (
                      <motion.div key={category} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="space-y-1">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-foreground font-medium">{category}</span>
                          <span className="text-rose-400 font-medium tabular-nums">-{formatMoney(amount, "USD")}</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-rose-500/60 to-rose-400/80 rounded-full" style={{ width: `${Math.round((amount / maxCategoryAmount) * 100)}%` }} />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Recent Transactions (collapsible, default expanded) ──────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.20 }}>
          <button
            onClick={() => toggleSection('recent-tx')}
            className="w-full flex items-center justify-between mb-3"
          >
            <h3 className="font-semibold text-lg">Recent Transactions</h3>
            <div className="flex items-center gap-2">
              {!isSectionCollapsed('recent-tx') && (
                <Link href="/transactions" className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  All <ChevronRight className="w-3 h-3" />
                </Link>
              )}
              {isSectionCollapsed('recent-tx')
                ? <ChevronDown className="w-4 h-4 text-muted-foreground/40" />
                : <ChevronUp   className="w-4 h-4 text-muted-foreground/40" />}
            </div>
          </button>
          <AnimatePresence>
            {!isSectionCollapsed('recent-tx') && (
              <motion.div key="recent-content" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                <div className="space-y-2">
                  {recentTransactions.length === 0 ? (
                    <div className="text-center py-10 glass-card rounded-2xl">
                      <p className="text-muted-foreground text-sm">No transactions this month.</p>
                      <button
                        onClick={() => openQa("EXPENSE")}
                        className="text-xs text-primary hover:underline mt-1"
                      >
                        Add your first transaction →
                      </button>
                    </div>
                  ) : (
                    recentTransactions.map((t, i) => (
                      <motion.div key={t.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
                        <TransactionCard transaction={t} onClick={() => setSelectedTx(t)} />
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </div>

      {/* ── Quick Add Drawer (controlled, type-aware) ────────────────────── */}
      <Drawer open={qaOpen} onOpenChange={(o) => { if (!o) setQaOpen(false); }}>
        <DrawerContent className="bg-background border-t border-white/10 text-foreground flex flex-col max-h-[92dvh]">
          <DrawerHeader className="px-4 pt-2 pb-2 flex-shrink-0">
            <DrawerTitle>{qaType === "INCOME" ? "Add Income" : "Add Expense"}</DrawerTitle>
          </DrawerHeader>
          <div
            className="flex-1 overflow-y-auto px-4"
            style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}
          >
            {qaOpen && (
              <TransactionForm
                defaultType={qaType}
                onSuccess={() => {
                  setQaOpen(false);
                  toast({ title: qaType === "INCOME" ? "Income added" : "Expense added" });
                }}
                onCancel={() => setQaOpen(false)}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* FAB + regular transaction drawer */}
      <TransactionDrawer />

      {/* Detail drawer */}
      <TransactionDetailDrawer
        transaction={selectedTx}
        accounts={accounts}
        onClose={() => setSelectedTx(null)}
      />
    </Layout>
  );
}
