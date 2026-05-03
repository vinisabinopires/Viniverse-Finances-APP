import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { MonthSelector } from "@/components/MonthSelector";
import {
  useLiveTransactions, useLiveBudgets, useLiveRecurringRules,
  useLiveGoals, useLiveSnapshots, useLiveTransfers, useLiveAccounts,
  calcBudgetSpent, getWeekStartDate, getWeekEndDate, toDateStr,
  getOccurrenceDatesForRange,
} from "@/hooks/use-finance";
import { formatMoney, formatMonthYear } from "@/utils";
import { motion } from "framer-motion";
import {
  TrendingUp, Target, RefreshCw, Lightbulb, ChevronRight,
  ArrowDownRight, ArrowUpRight, CalendarDays, BarChart2,
  ArrowLeftRight, ArrowRight, Plus,
} from "lucide-react";
import { GOAL_TYPE_META } from "@/constants/goals";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weekRangeLabel(start: Date, end: Date): string {
  const sm = start.toLocaleString("en-US", { month: "short" });
  const em = end.toLocaleString("en-US", { month: "short" });
  const sd = start.getDate(); const ed = end.getDate();
  return sm === em ? `${sm} ${sd}–${ed}` : `${sm} ${sd} – ${em} ${ed}`;
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-muted-foreground">{icon}</span>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function MiniBar({ used, total, color = "indigo" }: { used: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0;
  const barCls = pct >= 100 ? "bg-rose-500/80" : pct >= 80 ? "bg-amber-500/70" : `bg-${color}-500/70`;
  return (
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${barCls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Reports() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currency, setCurrency]       = useState<"USD" | "BRL">("USD");

  const transactions   = useLiveTransactions();
  const budgets        = useLiveBudgets();
  const recurringRules = useLiveRecurringRules();
  const goals          = useLiveGoals();
  const snapshots      = useLiveSnapshots();
  const transfers      = useLiveTransfers();
  const accounts       = useLiveAccounts();

  // ─── Month bounds ─────────────────────────────────────────────────────────
  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd   = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const monthLabel = formatMonthYear(currentMonth + "-01");

  // ─── Month transactions (selected currency) ───────────────────────────────
  const monthTx = transactions.filter(
    (t) => t.occurredAt.slice(0, 7) === currentMonth && t.currencyCode === currency
  );
  const incomeTx   = monthTx.filter((t) => t.type === "INCOME");
  const expenseTx  = monthTx.filter((t) => t.type === "EXPENSE");
  const income     = incomeTx.reduce((s, t) => s + t.amountCents, 0);
  const expenses   = expenseTx.reduce((s, t) => s + t.amountCents, 0);
  const net        = income - expenses;
  const savingsRate = income > 0 ? Math.round((net / income) * 100) : null;
  const avgExpense  = expenseTx.length > 0 ? Math.round(expenses / expenseTx.length) : 0;
  const sortedExpTx = [...expenseTx].sort((a, b) => b.amountCents - a.amountCents);
  const biggestExpense = sortedExpTx[0] ?? null;
  const biggestIncome  = [...incomeTx].sort((a, b) => b.amountCents - a.amountCents)[0] ?? null;
  const totalBar = income + expenses || 1;

  // ─── Category breakdowns ──────────────────────────────────────────────────
  const expenseByCat = expenseTx.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amountCents; return acc;
  }, {});
  const sortedExpCats = Object.entries(expenseByCat).sort((a, b) => b[1] - a[1]);
  const maxExpCat     = sortedExpCats[0]?.[1] || 1;

  const incomeByCat = incomeTx.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amountCents; return acc;
  }, {});
  const sortedIncCats = Object.entries(incomeByCat).sort((a, b) => b[1] - a[1]);
  const maxIncCat     = sortedIncCats[0]?.[1] || 1;

  // ─── Budget performance ───────────────────────────────────────────────────
  const monthBudgets = budgets.filter((b) => b.month === currentMonth && b.currencyCode === currency);
  const budgetData   = monthBudgets.map((b) => {
    const spent = calcBudgetSpent(transactions, b.category, b.month, b.currencyCode);
    const pct   = b.monthlyLimitCents > 0 ? Math.round((spent / b.monthlyLimitCents) * 100) : 0;
    return { budget: b, spent, pct };
  }).sort((a, b) => b.pct - a.pct);
  const totalBudgeted       = monthBudgets.reduce((s, b) => s + b.monthlyLimitCents, 0);
  const totalSpentInBudgets = budgetData.reduce((s, { spent }) => s + spent, 0);
  const overBudgets   = budgetData.filter(({ pct }) => pct >= 100).length;
  const cautionBudgets= budgetData.filter(({ pct }) => pct >= 70 && pct < 100).length;
  const safeBudgets   = budgetData.filter(({ pct }) => pct < 70).length;

  // ─── Weekly breakdown ─────────────────────────────────────────────────────
  type WeekRow = { label: string; wIncome: number; wExpenses: number; wNet: number; count: number };
  const weekRows: WeekRow[] = [];
  {
    let ptr = getWeekStartDate(monthStart);
    const monthEndStr  = toDateStr(monthEnd);
    const monthStartStr = toDateStr(monthStart);
    while (toDateStr(ptr) <= monthEndStr) {
      const wEnd     = getWeekEndDate(ptr);
      const clipS    = toDateStr(ptr) < monthStartStr ? monthStartStr : toDateStr(ptr);
      const clipE    = toDateStr(wEnd) > monthEndStr  ? monthEndStr   : toDateStr(wEnd);
      const wTx      = monthTx.filter((t) => { const d = t.occurredAt.slice(0, 10); return d >= clipS && d <= clipE; });
      const wIncome  = wTx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amountCents, 0);
      const wExpenses= wTx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amountCents, 0);
      weekRows.push({ label: weekRangeLabel(ptr, wEnd), wIncome, wExpenses, wNet: wIncome - wExpenses, count: wTx.length });
      const next = new Date(ptr); next.setDate(next.getDate() + 7); ptr = next;
    }
  }

  // ─── Recurring summary ────────────────────────────────────────────────────
  const recurringTx       = monthTx.filter((t) => t.recurringRuleId);
  const recurringIncome   = recurringTx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amountCents, 0);
  const recurringExpenses = recurringTx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amountCents, 0);
  const recurringCount    = recurringTx.length;

  const generatedKeys = new Set(monthTx.filter((t) => t.recurringOccurrenceKey).map((t) => t.recurringOccurrenceKey!));
  const pendingCount  = recurringRules
    .filter((r) => r.isActive && r.currencyCode === currency)
    .flatMap((rule) => getOccurrenceDatesForRange(rule, monthStart, monthEnd).map((d) => `${rule.id}:${d}`))
    .filter((key) => !generatedKeys.has(key)).length;

  // ─── Goals ────────────────────────────────────────────────────────────────
  const activeGoals = goals.filter((g) => !g.isArchived);
  const dashGoals   = [
    ...activeGoals.filter((g) => g.goalType === "EMERGENCY_FUND"),
    ...activeGoals.filter((g) => g.goalType !== "EMERGENCY_FUND"),
  ].slice(0, 3);

  // ─── Net Worth snapshot ───────────────────────────────────────────────────
  const monthEndStr = toDateStr(monthEnd);
  const monthSnapshot = snapshots.find((s) => s.snapshotDate <= monthEndStr) ?? null;

  // ─── Insights ─────────────────────────────────────────────────────────────
  const insights: string[] = [];
  if (income === 0 && expenses === 0) {
    insights.push(`No transactions recorded for ${monthLabel} in ${currency}. Add some transactions to see insights.`);
  } else {
    if (net < 0) {
      insights.push(`You spent ${formatMoney(Math.abs(net), currency)} more than you earned — review your variable expenses.`);
    } else if (savingsRate !== null && savingsRate > 0) {
      const quality = savingsRate >= 20 ? "Excellent" : savingsRate >= 10 ? "Good" : "Modest";
      insights.push(`${quality} work — you saved ${savingsRate}% of your income this month.`);
    } else if (net === 0) {
      insights.push(`You broke even this month — income exactly matched expenses.`);
    }
    if (sortedExpCats.length > 0) {
      const topCat = sortedExpCats[0];
      const pct = expenses > 0 ? Math.round((topCat[1] / expenses) * 100) : 0;
      insights.push(`Largest expense category: ${topCat[0]} at ${formatMoney(topCat[1], currency)} (${pct}% of expenses).`);
    }
    if (biggestExpense) {
      insights.push(`Biggest single expense: "${biggestExpense.description}" — ${formatMoney(biggestExpense.amountCents, currency)}.`);
    }
    if (overBudgets > 0) {
      insights.push(`You exceeded budget in ${overBudgets} ${overBudgets === 1 ? "category" : "categories"}.`);
    } else if (safeBudgets + cautionBudgets > 0) {
      insights.push(`You stayed under budget in all ${safeBudgets + cautionBudgets} tracked ${safeBudgets + cautionBudgets === 1 ? "category" : "categories"} — great discipline!`);
    }
    if (recurringCount > 0) {
      insights.push(`${recurringCount} recurring transaction${recurringCount !== 1 ? "s" : ""} logged, totaling ${formatMoney(recurringIncome + recurringExpenses, currency)}.`);
    }
    if (monthTx.length > 0) {
      insights.push(`You made ${monthTx.length} transaction${monthTx.length !== 1 ? "s" : ""} this month across ${currency}.`);
    }
  }
  const shownInsights = insights.slice(0, 6);

  // ─── Transfer Insights ────────────────────────────────────────────────────
  const monthTransfers = transfers.filter((t) => t.date.startsWith(currentMonth));
  const crossTransfers = monthTransfers.filter((t) => t.fromCurrencyCode !== t.toCurrencyCode);
  const sameTransfers  = monthTransfers.filter((t) => t.fromCurrencyCode === t.toCurrencyCode);

  // Totals moved and fees by currency
  const movedByCcy: Record<string, number> = {};
  const feesByCcy:  Record<string, number> = {};
  for (const t of monthTransfers) {
    movedByCcy[t.fromCurrencyCode] = (movedByCcy[t.fromCurrencyCode] ?? 0) + t.fromAmountCents;
    if (t.feeAmountCents && t.feeCurrencyCode) {
      feesByCcy[t.feeCurrencyCode] = (feesByCcy[t.feeCurrencyCode] ?? 0) + t.feeAmountCents;
    }
  }

  // Average exchange rates
  const usdToBrlTx   = crossTransfers.filter((t) => t.fromCurrencyCode === "USD" && t.toCurrencyCode === "BRL" && t.exchangeRate);
  const avgUsdToBrl  = usdToBrlTx.length > 0 ? usdToBrlTx.reduce((s, t) => s + (t.exchangeRate ?? 0), 0) / usdToBrlTx.length : null;
  const brlToUsdTx   = crossTransfers.filter((t) => t.fromCurrencyCode === "BRL" && t.toCurrencyCode === "USD" && t.exchangeRate);
  const avgBrlToUsd  = brlToUsdTx.length > 0 ? brlToUsdTx.reduce((s, t) => s + (t.exchangeRate ?? 0), 0) / brlToUsdTx.length : null;

  // Account flow map
  type AccFlow = { id: string; name: string; currencyCode: "USD" | "BRL"; outCents: number; inCents: number; feesCents: number };
  const flowMap = new Map<string, AccFlow>();
  for (const t of monthTransfers) {
    const fromAcct = accounts.find((a) => a.id === t.fromAccountId);
    const toAcct   = accounts.find((a) => a.id === t.toAccountId);
    if (!flowMap.has(t.fromAccountId)) {
      flowMap.set(t.fromAccountId, {
        id: t.fromAccountId,
        name: fromAcct?.name ?? "Unknown account",
        currencyCode: (fromAcct?.currencyCode ?? t.fromCurrencyCode) as "USD" | "BRL",
        outCents: 0, inCents: 0, feesCents: 0,
      });
    }
    const ff = flowMap.get(t.fromAccountId)!;
    ff.outCents += t.fromAmountCents;
    if (t.feeAmountCents && t.feeCurrencyCode === ff.currencyCode) ff.feesCents += t.feeAmountCents;

    if (!flowMap.has(t.toAccountId)) {
      flowMap.set(t.toAccountId, {
        id: t.toAccountId,
        name: toAcct?.name ?? "Unknown account",
        currencyCode: (toAcct?.currencyCode ?? t.toCurrencyCode) as "USD" | "BRL",
        outCents: 0, inCents: 0, feesCents: 0,
      });
    }
    flowMap.get(t.toAccountId)!.inCents += t.toAmountCents;
  }
  const accountFlows = Array.from(flowMap.values());

  // Timezone-safe date formatter for YYYY-MM-DD strings
  const fmtTxDate = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const accName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "Unknown account";

  // ─── Budget status helpers ─────────────────────────────────────────────────
  const budgetStatusCls = (pct: number) =>
    pct >= 100 ? "text-rose-400" : pct >= 70 ? "text-amber-400" : "text-emerald-400";
  const budgetBarCls    = (pct: number) =>
    pct >= 100 ? "bg-rose-500/80" : pct >= 70 ? "bg-amber-500/70" : "bg-emerald-500/70";

  return (
    <Layout>
      <div className="p-4 space-y-5 pt-12 pb-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Monthly Report</h1>
          <p className="text-muted-foreground text-sm mt-1">Deep dive into your finances.</p>
        </header>

        {/* Selectors */}
        <MonthSelector currentDate={currentDate} onChange={setCurrentDate} />
        <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
          {(["USD", "BRL"] as const).map((c) => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`py-2.5 rounded-lg text-sm font-medium transition-all ${currency === c ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {c === "USD" ? "🇺🇸 USD" : "🇧🇷 BRL"}
            </button>
          ))}
        </div>

        {/* ── Monthly overview ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 rounded-2xl space-y-4">
          <SectionHeader icon={<BarChart2 className="w-4 h-4" />} title={`${monthLabel} Overview · ${currency}`} />

          {/* Main 3 stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="glass-card p-3 rounded-xl">
              <p className="text-[10px] text-emerald-400 mb-1">Income</p>
              <p className="text-sm font-bold text-emerald-400 tabular-nums leading-tight">{formatMoney(income, currency)}</p>
            </div>
            <div className="glass-card p-3 rounded-xl">
              <p className="text-[10px] text-rose-400 mb-1">Expenses</p>
              <p className="text-sm font-bold text-rose-400 tabular-nums leading-tight">{formatMoney(expenses, currency)}</p>
            </div>
            <div className="glass-card p-3 rounded-xl">
              <p className="text-[10px] text-muted-foreground mb-1">Net</p>
              <p className={`text-sm font-bold tabular-nums leading-tight ${net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {net >= 0 ? "+" : ""}{formatMoney(net, currency)}
              </p>
            </div>
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="glass-card p-3 rounded-xl">
              <p className="text-muted-foreground mb-0.5">Savings rate</p>
              <p className={`font-bold text-base ${savingsRate == null ? "text-muted-foreground" : savingsRate > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {savingsRate == null ? "N/A" : `${savingsRate}%`}
              </p>
            </div>
            <div className="glass-card p-3 rounded-xl">
              <p className="text-muted-foreground mb-0.5">Transactions</p>
              <p className="font-bold text-base">{monthTx.length}</p>
            </div>
            <div className="glass-card p-3 rounded-xl">
              <p className="text-muted-foreground mb-0.5">Avg expense</p>
              <p className="font-bold text-base tabular-nums">{expenseTx.length > 0 ? formatMoney(avgExpense, currency) : "—"}</p>
            </div>
            <div className="glass-card p-3 rounded-xl">
              <p className="text-muted-foreground mb-0.5">Biggest expense</p>
              <p className="font-bold text-sm text-rose-400 tabular-nums truncate">{biggestExpense ? formatMoney(biggestExpense.amountCents, currency) : "—"}</p>
              {biggestExpense && <p className="text-[10px] text-muted-foreground truncate">{biggestExpense.description}</p>}
            </div>
          </div>

          {/* Income vs Expenses visual */}
          {(income > 0 || expenses > 0) && (
            <div className="pt-2 border-t border-white/10 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Income vs Expenses</p>
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-emerald-400 font-medium">Income</span>
                    <span className="tabular-nums text-muted-foreground">{Math.round((income / totalBar) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500/70 rounded-full" style={{ width: `${Math.round((income / totalBar) * 100)}%` }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-rose-400 font-medium">Expenses</span>
                    <span className="tabular-nums text-muted-foreground">{Math.round((expenses / totalBar) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500/70 rounded-full" style={{ width: `${Math.round((expenses / totalBar) * 100)}%` }} />
                  </div>
                </div>
              </div>
              <div className={`text-center text-xs font-semibold py-1.5 px-3 rounded-lg ${net > 0 ? "bg-emerald-500/10 text-emerald-400" : net < 0 ? "bg-rose-500/10 text-rose-400" : "bg-white/5 text-muted-foreground"}`}>
                {net > 0 ? `+${formatMoney(net, currency)} positive month` : net < 0 ? `${formatMoney(net, currency)} deficit` : "Breakeven month"}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Category breakdown ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-5 rounded-2xl">
          <SectionHeader icon={<ArrowUpRight className="w-4 h-4" />} title="Expense Categories" />
          {sortedExpCats.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No expense transactions this month.</p>
          ) : (
            <div className="space-y-3">
              {sortedExpCats.map(([cat, amount]) => {
                const pct = expenses > 0 ? Math.round((amount / expenses) * 100) : 0;
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium truncate">{cat}</span>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="text-rose-400 font-medium tabular-nums">{formatMoney(amount, currency)}</span>
                        <span className="text-muted-foreground text-xs ml-1.5">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500/60 rounded-full" style={{ width: `${Math.round((amount / maxExpCat) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {sortedIncCats.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} className="glass-card p-5 rounded-2xl">
            <SectionHeader icon={<ArrowDownRight className="w-4 h-4" />} title="Income Categories" />
            <div className="space-y-3">
              {sortedIncCats.map(([cat, amount]) => {
                const pct = income > 0 ? Math.round((amount / income) * 100) : 0;
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium truncate">{cat}</span>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="text-emerald-400 font-medium tabular-nums">{formatMoney(amount, currency)}</span>
                        <span className="text-muted-foreground text-xs ml-1.5">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${Math.round((amount / maxIncCat) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Budget performance ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }} className="glass-card p-5 rounded-2xl">
          <SectionHeader icon={<Target className="w-4 h-4" />} title="Budget Performance" />
          {monthBudgets.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No budgets set for {monthLabel}. <Link href="/budgets" className="text-primary hover:underline">Create budgets</Link> to track limits.
            </p>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="glass-card p-3 rounded-xl text-center">
                  <p className="text-[10px] text-emerald-400 mb-0.5">Safe</p>
                  <p className="text-xl font-bold text-emerald-400">{safeBudgets}</p>
                </div>
                <div className="glass-card p-3 rounded-xl text-center">
                  <p className="text-[10px] text-amber-400 mb-0.5">Caution</p>
                  <p className="text-xl font-bold text-amber-400">{cautionBudgets}</p>
                </div>
                <div className="glass-card p-3 rounded-xl text-center">
                  <p className="text-[10px] text-rose-400 mb-0.5">Over</p>
                  <p className="text-xl font-bold text-rose-400">{overBudgets}</p>
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mb-4 px-1">
                <span>Budgeted: <span className="text-foreground font-medium">{formatMoney(totalBudgeted, currency)}</span></span>
                <span>Spent: <span className="text-rose-400 font-medium">{formatMoney(totalSpentInBudgets, currency)}</span></span>
                <span>Left: <span className={`font-medium ${totalBudgeted - totalSpentInBudgets >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatMoney(totalBudgeted - totalSpentInBudgets, currency)}</span></span>
              </div>
              {/* Budget list */}
              <div className="space-y-3">
                {budgetData.map(({ budget, spent, pct }) => (
                  <div key={budget.id} className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium truncate">{budget.category}</span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className={`text-xs font-semibold ${budgetStatusCls(pct)}`}>{pct >= 100 ? "Over" : pct >= 70 ? "Caution" : "Safe"}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${budgetBarCls(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatMoney(spent, currency)} spent</span>
                      <span>of {formatMoney(budget.monthlyLimitCents, currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>

        {/* ── Weekly breakdown ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }} className="glass-card p-5 rounded-2xl">
          <SectionHeader icon={<CalendarDays className="w-4 h-4" />} title="Weekly Breakdown" />
          {weekRows.every((w) => w.count === 0) ? (
            <p className="text-xs text-muted-foreground text-center py-4">No transactions to break down.</p>
          ) : (
            <div className="space-y-3">
              {weekRows.map((w, i) => (
                <div key={i} className="glass-card p-3 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{w.label}</p>
                    <span className={`text-xs font-bold tabular-nums ${w.wNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {w.wNet >= 0 ? "+" : ""}{formatMoney(w.wNet, currency)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-center">
                    <div><p className="text-emerald-400 font-medium tabular-nums">{formatMoney(w.wIncome, currency)}</p><p className="text-muted-foreground">income</p></div>
                    <div><p className="text-rose-400 font-medium tabular-nums">{formatMoney(w.wExpenses, currency)}</p><p className="text-muted-foreground">expenses</p></div>
                    <div><p className="font-medium">{w.count}</p><p className="text-muted-foreground">tx</p></div>
                  </div>
                  {(w.wIncome > 0 || w.wExpenses > 0) && (
                    <div className="flex gap-1 h-1 rounded-full overflow-hidden bg-white/5">
                      {w.wIncome   > 0 && <div className="bg-emerald-500/60" style={{ width: `${Math.round((w.wIncome   / (w.wIncome + w.wExpenses)) * 100)}%` }} />}
                      {w.wExpenses > 0 && <div className="bg-rose-500/60"    style={{ width: `${Math.round((w.wExpenses / (w.wIncome + w.wExpenses)) * 100)}%` }} />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Recurring summary ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }} className="glass-card p-5 rounded-2xl">
          <SectionHeader icon={<RefreshCw className="w-4 h-4" />} title="Recurring Summary" />
          {recurringCount === 0 && pendingCount === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No recurring transactions this month.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="glass-card p-3 rounded-xl">
                  <p className="text-[10px] text-emerald-400 mb-0.5">Recurring income</p>
                  <p className="font-bold text-sm text-emerald-400 tabular-nums">{formatMoney(recurringIncome, currency)}</p>
                </div>
                <div className="glass-card p-3 rounded-xl">
                  <p className="text-[10px] text-rose-400 mb-0.5">Recurring expenses</p>
                  <p className="font-bold text-sm text-rose-400 tabular-nums">{formatMoney(recurringExpenses, currency)}</p>
                </div>
              </div>
              <div className="flex justify-between text-xs px-1">
                <span className="text-muted-foreground">{recurringCount} generated transaction{recurringCount !== 1 ? "s" : ""}</span>
                {pendingCount > 0 && (
                  <span className="text-amber-400 font-medium">{pendingCount} still pending</span>
                )}
              </div>
              {pendingCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  <Link href="/weekly-cashflow" className="text-primary hover:underline">Open Weekly Cashflow</Link> to generate pending recurring transactions.
                </p>
              )}
            </div>
          )}
        </motion.div>

        {/* ── Goals summary ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader icon={<Target className="w-4 h-4" />} title="Financial Goals" />
            <Link href="/goals" className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5 -mt-3">All <ChevronRight className="w-3 h-3" /></Link>
          </div>
          {dashGoals.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No active goals. <Link href="/goals" className="text-primary hover:underline">Create your first goal.</Link>
            </p>
          ) : (
            <div className="space-y-4">
              {dashGoals.map((goal) => {
                const pct  = goal.targetAmountCents > 0 ? Math.min(Math.round((goal.currentAmountCents / goal.targetAmountCents) * 100), 100) : 0;
                const meta = GOAL_TYPE_META[goal.goalType];
                const barColor = pct >= 100 ? "bg-yellow-400" : pct >= 70 ? "bg-emerald-500/80" : pct >= 30 ? "bg-indigo-500/80" : "bg-blue-500/80";
                return (
                  <div key={goal.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0"><span className="text-base">{meta.emoji}</span><span className="text-sm font-medium truncate">{goal.name}</span></div>
                      <span className={`text-xs font-bold flex-shrink-0 ${pct >= 100 ? "text-yellow-400" : "text-muted-foreground"}`}>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatMoney(goal.currentAmountCents, goal.currencyCode)}</span>
                      <span>{formatMoney(goal.targetAmountCents, goal.currencyCode)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── Net Worth snapshot ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }} className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader icon={<TrendingUp className="w-4 h-4" />} title="Net Worth Snapshot" />
            <Link href="/net-worth" className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5 -mt-3">View <ChevronRight className="w-3 h-3" /></Link>
          </div>
          {monthSnapshot ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Snapshot from {monthSnapshot.snapshotDate}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="glass-card p-3 rounded-xl">
                  <p className="text-[10px] text-muted-foreground mb-0.5">🇺🇸 USD total</p>
                  <p className={`font-bold tabular-nums ${monthSnapshot.totalUsdCents < 0 ? "text-rose-400" : ""}`}>{formatMoney(monthSnapshot.totalUsdCents, "USD")}</p>
                </div>
                <div className="glass-card p-3 rounded-xl">
                  <p className="text-[10px] text-muted-foreground mb-0.5">🇧🇷 BRL total</p>
                  <p className={`font-bold tabular-nums ${monthSnapshot.totalBrlCents < 0 ? "text-rose-400" : ""}`}>{formatMoney(monthSnapshot.totalBrlCents, "BRL")}</p>
                </div>
              </div>
              {monthSnapshot.totalConvertedToUsdCents != null && (
                <p className="text-xs text-muted-foreground text-center">≈ {formatMoney(monthSnapshot.totalConvertedToUsdCents, "USD")} consolidated</p>
              )}
              {monthSnapshot.notes && <p className="text-xs text-muted-foreground italic">"{monthSnapshot.notes}"</p>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              No snapshot at or before {monthLabel}. <Link href="/net-worth" className="text-primary hover:underline">Create a Net Worth snapshot.</Link>
            </p>
          )}
        </motion.div>

        {/* ── Transfer Insights ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 }} className="glass-card p-5 rounded-2xl border border-indigo-500/15">
          <div className="flex items-center gap-2 mb-1">
            <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transfer Insights</h3>
          </div>
          <p className="text-[11px] text-muted-foreground/60 mb-4 leading-relaxed">
            Transfers are excluded from income, expenses, budgets, and savings rate.
          </p>

          {monthTransfers.length === 0 ? (
            <div className="py-8 text-center">
              <ArrowLeftRight className="w-8 h-8 text-indigo-400/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-medium">No transfers recorded this month.</p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-[220px] mx-auto leading-relaxed">
                Use transfers to move money between accounts without affecting income or expenses.
              </p>
              <Link href="/transfers">
                <button className="mt-4 flex items-center gap-1.5 mx-auto text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors px-3 py-2 rounded-xl">
                  <Plus className="w-3.5 h-3.5" /> Add Transfer
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-5">

              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="glass-card p-3 rounded-xl text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Total transfers</p>
                  <p className="text-2xl font-bold">{monthTransfers.length}</p>
                </div>
                <div className="glass-card p-3 rounded-xl text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Cross-currency</p>
                  <p className="text-2xl font-bold text-indigo-400">{crossTransfers.length}</p>
                </div>
              </div>

              {/* Totals moved + fees + avg rates */}
              <div className="glass-card p-3 rounded-xl space-y-2">
                {Object.entries(movedByCcy).map(([ccy, cents]) => (
                  <div key={`moved-${ccy}`} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Moved ({ccy})</span>
                    <span className="font-semibold tabular-nums text-indigo-300">{formatMoney(cents, ccy as "USD" | "BRL")}</span>
                  </div>
                ))}
                {Object.entries(feesByCcy).map(([ccy, cents]) => (
                  <div key={`fee-${ccy}`} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Fees ({ccy})</span>
                    <span className="font-semibold tabular-nums text-amber-400/80">{formatMoney(cents, ccy as "USD" | "BRL")}</span>
                  </div>
                ))}
                {avgUsdToBrl !== null && (
                  <div className="flex justify-between items-center text-sm border-t border-white/5 pt-2 mt-1">
                    <span className="text-muted-foreground">Avg rate USD → BRL</span>
                    <span className="font-semibold tabular-nums">{avgUsdToBrl.toFixed(4)}</span>
                  </div>
                )}
                {avgBrlToUsd !== null && (
                  <div className="flex justify-between items-center text-sm border-t border-white/5 pt-2 mt-1">
                    <span className="text-muted-foreground">Avg rate BRL → USD</span>
                    <span className="font-semibold tabular-nums">{avgBrlToUsd.toFixed(6)}</span>
                  </div>
                )}
              </div>

              {/* Account flow */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Account Flow</p>
                <div className="space-y-2">
                  {accountFlows.map((flow) => {
                    const net = flow.inCents - flow.outCents;
                    return (
                      <div key={flow.id} className="glass-card p-3 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium truncate">{flow.name}</p>
                          <span className="text-[10px] text-muted-foreground ml-2 flex-shrink-0 bg-white/5 px-1.5 py-0.5 rounded-full">{flow.currencyCode}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-xs text-center">
                          <div>
                            <p className="text-muted-foreground/70 mb-0.5">Sent</p>
                            <p className="font-semibold tabular-nums text-slate-300">{flow.outCents > 0 ? formatMoney(flow.outCents, flow.currencyCode) : "—"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground/70 mb-0.5">Received</p>
                            <p className="font-semibold tabular-nums text-indigo-300">{flow.inCents > 0 ? formatMoney(flow.inCents, flow.currencyCode) : "—"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground/70 mb-0.5">Net</p>
                            <p className={`font-semibold tabular-nums ${net >= 0 ? "text-indigo-400" : "text-slate-400"}`}>
                              {net >= 0 ? "+" : ""}{formatMoney(net, flow.currencyCode)}
                            </p>
                          </div>
                        </div>
                        {flow.feesCents > 0 && (
                          <p className="text-[10px] text-amber-400/70 mt-1.5 text-right">
                            Fee: {formatMoney(flow.feesCents, flow.currencyCode)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Currency Moves (cross-currency) */}
              {crossTransfers.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Currency Moves</p>
                  <div className="space-y-2">
                    {crossTransfers.map((t) => (
                      <div key={t.id} className="glass-card p-3 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{fmtTxDate(t.date)}</span>
                          {t.description && (
                            <span className="text-[10px] text-muted-foreground truncate ml-2 max-w-[120px]">{t.description}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium truncate max-w-[100px]">{accName(t.fromAccountId)}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
                          <span className="text-xs font-medium truncate max-w-[100px]">{accName(t.toAccountId)}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-indigo-300 tabular-nums">{formatMoney(t.fromAmountCents, t.fromCurrencyCode)}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
                          <span className="text-sm font-bold text-indigo-400 tabular-nums">{formatMoney(t.toAmountCents, t.toCurrencyCode)}</span>
                          {t.exchangeRate && (
                            <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded-full">@ {t.exchangeRate}</span>
                          )}
                        </div>
                        {t.feeAmountCents && (
                          <p className="text-[10px] text-amber-400/70">
                            Fee: {formatMoney(t.feeAmountCents, (t.feeCurrencyCode ?? t.fromCurrencyCode) as "USD" | "BRL")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Account Moves (same-currency) */}
              {sameTransfers.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Account Moves</p>
                  <div className="space-y-2">
                    {sameTransfers.map((t) => (
                      <div key={t.id} className="glass-card p-3 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{fmtTxDate(t.date)}</span>
                          {t.description && (
                            <span className="text-[10px] text-muted-foreground truncate ml-2 max-w-[140px]">{t.description}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium truncate max-w-[100px]">{accName(t.fromAccountId)}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
                          <span className="text-xs font-medium truncate max-w-[100px]">{accName(t.toAccountId)}</span>
                        </div>
                        <p className="text-sm font-bold text-indigo-300 tabular-nums">{formatMoney(t.fromAmountCents, t.fromCurrencyCode)}</p>
                        {t.feeAmountCents && (
                          <p className="text-[10px] text-amber-400/70">
                            Fee: {formatMoney(t.feeAmountCents, (t.feeCurrencyCode ?? t.fromCurrencyCode) as "USD" | "BRL")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </motion.div>

        {/* ── Budget Coach link ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.20 }} className="glass-card p-4 rounded-2xl border border-indigo-500/15 bg-indigo-500/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold">Budget Coach</p>
              <p className="text-xs text-muted-foreground">See spending risks and guardrails.</p>
            </div>
          </div>
          <Link href="/coach">
            <button className="text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/15 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 flex-shrink-0 ml-3">
              Open <ChevronRight className="w-3 h-3" />
            </button>
          </Link>
        </motion.div>

        {/* ── Insights ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }} className="glass-card p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5">
          <SectionHeader icon={<Lightbulb className="w-4 h-4 text-indigo-400" />} title="Insights" />
          <div className="space-y-3">
            {shownInsights.map((insight, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="text-indigo-400 flex-shrink-0 mt-0.5 text-xs font-bold">{i + 1}.</span>
                <p className="text-sm leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
