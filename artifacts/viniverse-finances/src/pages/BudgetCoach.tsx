import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { MonthSelector } from "@/components/MonthSelector";
import {
  useLiveTransactions, useLiveBudgets, useLiveRecurringRules, useLiveAccounts,
  useLiveTransfers, useLiveGoals,
  calcBudgetSpent, calcAccountBalance, getOccurrenceDatesForRange, toDateStr,
} from "@/hooks/use-finance";
import { formatMoney, formatMonthYear } from "@/utils";
import { motion } from "framer-motion";
import {
  Lightbulb, Target, TrendingUp, Receipt, CalendarDays,
  AlertCircle, ChevronRight, Zap, Plus, ShieldCheck,
} from "lucide-react";
import type { RecurringRule } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMonthlyCents(rule: RecurringRule): number {
  switch (rule.frequency) {
    case "WEEKLY":   return Math.round(rule.amountCents * 52 / 12);
    case "BIWEEKLY": return Math.round(rule.amountCents * 26 / 12);
    case "MONTHLY":  return rule.amountCents;
    case "YEARLY":   return Math.round(rule.amountCents / 12);
  }
}

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const riskMeta = {
  over:  { label: "Over",  bg: "bg-rose-500/15",    text: "text-rose-400",    border: "border-rose-500/25",    bar: "bg-rose-500" },
  risk:  { label: "Risk",  bg: "bg-amber-500/15",   text: "text-amber-400",   border: "border-amber-500/25",   bar: "bg-amber-500" },
  watch: { label: "Watch", bg: "bg-amber-500/10",   text: "text-amber-400/80",border: "border-amber-500/15",   bar: "bg-amber-400" },
  safe:  { label: "Safe",  bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", bar: "bg-emerald-500" },
} as const;

const pressureMeta = {
  comfortable: { label: "Comfortable", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", bar: "bg-emerald-500" },
  tight:       { label: "Tight",       color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20", bar: "bg-amber-400" },
  heavy:       { label: "Heavy",       color: "text-amber-300",   bg: "bg-amber-500/15",   border: "border-amber-500/25", bar: "bg-amber-500" },
  critical:    { label: "Critical",    color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/20", bar: "bg-rose-500" },
  unknown:     { label: "—",           color: "text-muted-foreground", bg: "bg-white/5", border: "border-white/10",   bar: "bg-white/20" },
} as const;

const resilienceMeta = {
  critical: { label: "Critical", color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/20",    bar: "bg-rose-500" },
  fragile:  { label: "Fragile",  color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20",   bar: "bg-amber-400" },
  building: { label: "Building", color: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/20",  bar: "bg-indigo-400" },
  strong:   { label: "Strong",   color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", bar: "bg-emerald-500" },
  fortress: { label: "Fortress", color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/20",  bar: "bg-purple-400" },
  unknown:  { label: "—",        color: "text-muted-foreground", bg: "bg-white/5",   border: "border-white/10",       bar: "bg-white/20" },
} as const;

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BudgetCoach() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currency, setCurrency] = useState<"USD" | "BRL">("USD");

  const transactions = useLiveTransactions();
  const budgets      = useLiveBudgets();
  const rules        = useLiveRecurringRules();
  const accounts     = useLiveAccounts();
  const transfers    = useLiveTransfers();
  const goals        = useLiveGoals();

  // ── Date math ───────────────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed
  const currentMonth   = `${year}-${String(month + 1).padStart(2, "0")}`;
  const todayMonth     = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const daysInMonth    = new Date(year, month + 1, 0).getDate();
  const isCurrentMonth = currentMonth === todayMonth;
  const isPastMonth    = currentMonth < todayMonth;
  // For future month: no projection (dayOfMonth = 0)
  const dayOfMonth  = isCurrentMonth ? today.getDate() : isPastMonth ? daysInMonth : 0;
  const daysRemaining  = Math.max(daysInMonth - dayOfMonth, 0);
  const monthProgressPct = daysInMonth > 0 ? dayOfMonth / daysInMonth : 0;

  // ── Budget risk calculation ──────────────────────────────────────────────
  const monthBudgets = budgets.filter((b) => b.month === currentMonth && b.currencyCode === currency);

  const budgetRisks = monthBudgets.map((budget) => {
    const spent    = calcBudgetSpent(transactions, budget.category, currentMonth, currency);
    const remaining = budget.monthlyLimitCents - spent;
    const pctUsed   = budget.monthlyLimitCents > 0 ? spent / budget.monthlyLimitCents : 0;
    const projectedMonthEnd = dayOfMonth > 0 && spent > 0
      ? Math.round(spent / dayOfMonth * daysInMonth)
      : spent;
    const projectedOverUnder = projectedMonthEnd - budget.monthlyLimitCents;
    const dailyRemaining = daysRemaining > 0 && remaining > 0
      ? Math.round(remaining / daysRemaining)
      : 0;

    let risk: "safe" | "watch" | "risk" | "over";
    if (spent >= budget.monthlyLimitCents) {
      risk = "over";
    } else if (dayOfMonth > 0 && projectedMonthEnd > budget.monthlyLimitCents) {
      risk = "risk";
    } else if (dayOfMonth > 0 && pctUsed > monthProgressPct + 0.05) {
      risk = "watch";
    } else {
      risk = "safe";
    }

    const cat = budget.category;
    const overAmt = Math.abs(remaining);
    let insight: string;
    if (risk === "over") {
      insight = `${cat} is over budget — ${formatMoney(overAmt, currency)} over.`;
    } else if (risk === "risk") {
      insight = `${cat} is projected to exceed budget by ${formatMoney(projectedOverUnder, currency)}.`;
    } else if (risk === "watch") {
      insight = `${cat} is slightly ahead of pace. ${formatMoney(Math.max(dailyRemaining, 0), currency)}/day remaining.`;
    } else {
      insight = `${cat} has ${formatMoney(Math.max(remaining, 0), currency)} left — about ${formatMoney(Math.max(dailyRemaining, 0), currency)}/day.`;
    }

    return { budget, spent, remaining, pctUsed, projectedMonthEnd, projectedOverUnder, dailyRemaining, risk, insight };
  }).sort((a, b) => {
    const order = { over: 0, risk: 1, watch: 2, safe: 3 } as const;
    return order[a.risk] - order[b.risk];
  });

  const overCount  = budgetRisks.filter((r) => r.risk === "over").length;
  const riskCount  = budgetRisks.filter((r) => r.risk === "risk").length;
  const watchCount = budgetRisks.filter((r) => r.risk === "watch").length;
  const safeCount  = budgetRisks.filter((r) => r.risk === "safe").length;

  // ── Spending pace totals ─────────────────────────────────────────────────
  const totalBudgeted  = monthBudgets.reduce((s, b) => s + b.monthlyLimitCents, 0);
  const totalSpent     = budgetRisks.reduce((s, r) => s + r.spent, 0);
  const totalRemaining = totalBudgeted - totalSpent;
  const totalProjected = budgetRisks.reduce((s, r) => s + r.projectedMonthEnd, 0);

  // ── Fixed commitment pressure ────────────────────────────────────────────
  const activeRules       = rules.filter((r) => r.isActive && r.currencyCode === currency);
  const fixedExpenses     = activeRules.filter((r) => r.type === "EXPENSE");
  const recurringIncome   = activeRules.filter((r) => r.type === "INCOME");
  const fixedExpMonthlyCents   = fixedExpenses.reduce((s, r) => s + toMonthlyCents(r), 0);
  const recurringIncMonthlyCents = recurringIncome.reduce((s, r) => s + toMonthlyCents(r), 0);
  const flexibleIncome    = recurringIncMonthlyCents - fixedExpMonthlyCents;
  const commitmentRatio   = recurringIncMonthlyCents > 0 ? fixedExpMonthlyCents / recurringIncMonthlyCents : null;

  let pressureLevel: keyof typeof pressureMeta = "unknown";
  if (commitmentRatio !== null) {
    if (commitmentRatio >= 0.70)      pressureLevel = "critical";
    else if (commitmentRatio >= 0.50) pressureLevel = "heavy";
    else if (commitmentRatio >= 0.35) pressureLevel = "tight";
    else                              pressureLevel = "comfortable";
  }
  const pm = pressureMeta[pressureLevel];

  // ── Savings Runway ───────────────────────────────────────────────────────
  const currAccounts   = accounts.filter((a) => a.currencyCode === currency);
  const liquidAccts    = currAccounts.filter((a) => a.type === "CHECKING" || a.type === "SAVINGS" || a.type === "CASH");
  const liquidBalCents = liquidAccts.reduce((s, a) => s + calcAccountBalance(a, transactions, transfers), 0);
  const totalBalCents  = currAccounts.reduce((s, a) => s + calcAccountBalance(a, transactions, transfers), 0);

  // Baseline A: fixed commitments (already computed)
  const fixedBaselineCents = fixedExpMonthlyCents;

  // Baseline B: average actual expenses — last 3 completed months
  const last3Months: string[] = [];
  for (let i = 3; i >= 1; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    last3Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const monthlySpends = last3Months
    .map((m) =>
      transactions
        .filter((t) => {
          const d = new Date(t.occurredAt);
          return t.type === "EXPENSE" && t.currencyCode === currency &&
                 `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === m;
        })
        .reduce((s, t) => s + t.amountCents, 0)
    )
    .filter((v) => v > 0);
  const hasActualHistory       = monthlySpends.length >= 2;
  const avgActualBaselineCents = monthlySpends.length >= 1
    ? Math.round(monthlySpends.reduce((s, v) => s + v, 0) / monthlySpends.length)
    : 0;

  // Baseline C: budgeted spending (selected month + currency)
  const budgetedBaselineCents = monthBudgets.reduce((s, b) => s + b.monthlyLimitCents, 0);

  // Runway helpers
  const calcRunwayMonths = (balance: number, baseline: number): number | null =>
    baseline > 0 && balance > 0 ? balance / baseline : null;
  const fmtRunway = (m: number | null): string => {
    if (m === null) return "—";
    if (m >= 12) return "12+ mo";
    if (m >= 6)  return "6+ mo";
    return `${m.toFixed(1)} mo`;
  };
  const liquidRunwayFixed  = calcRunwayMonths(liquidBalCents, fixedBaselineCents);
  const totalRunwayFixed   = calcRunwayMonths(totalBalCents,  fixedBaselineCents);
  const liquidRunwayActual = calcRunwayMonths(liquidBalCents, avgActualBaselineCents);
  const totalRunwayActual  = calcRunwayMonths(totalBalCents,  avgActualBaselineCents);
  const liquidRunwayBudget = calcRunwayMonths(liquidBalCents, budgetedBaselineCents);
  const totalRunwayBudget  = calcRunwayMonths(totalBalCents,  budgetedBaselineCents);

  // Resilience level
  type ResilienceLevel = "critical" | "fragile" | "building" | "strong" | "fortress" | "unknown";
  let resilienceLevel: ResilienceLevel = "unknown";
  if (liquidRunwayFixed !== null) {
    if      (liquidRunwayFixed < 1)  resilienceLevel = "critical";
    else if (liquidRunwayFixed < 3)  resilienceLevel = "fragile";
    else if (liquidRunwayFixed < 6)  resilienceLevel = "building";
    else if (liquidRunwayFixed < 12) resilienceLevel = "strong";
    else                             resilienceLevel = "fortress";
  }
  const rm = resilienceMeta[resilienceLevel];

  // Emergency fund targets
  const emgBaseline = fixedBaselineCents > 0 ? fixedBaselineCents : budgetedBaselineCents;
  const emgTargets = emgBaseline > 0
    ? ([1, 3, 6, 12] as const).map((mos) => {
        const target   = Math.round(emgBaseline * mos);
        const progress = target > 0 ? Math.min(liquidBalCents / target, 1) : 0;
        return { mos, target, progress, gap: Math.max(target - liquidBalCents, 0) };
      })
    : [];

  // Emergency Fund goal link
  const emergencyGoal = goals.find((g) => g.goalType === "EMERGENCY_FUND" && g.currencyCode === currency && !g.isArchived);

  // ── Upcoming pressure (next 7 days, always relative to today) ───────────
  const in7 = new Date(today);
  in7.setDate(today.getDate() + 7);
  const upcomingItems: Array<{ rule: RecurringRule; dateStr: string; isGenerated: boolean }> = [];
  for (const rule of fixedExpenses) {
    for (const dateStr of getOccurrenceDatesForRange(rule, today, in7)) {
      const key = `${rule.id}:${dateStr}`;
      const isGenerated = transactions.some((t) => t.recurringOccurrenceKey === key);
      upcomingItems.push({ rule, dateStr, isGenerated });
    }
  }
  upcomingItems.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  const upcomingTotal = upcomingItems.reduce((s, i) => s + i.rule.amountCents, 0);

  // ── Missing budget detection ─────────────────────────────────────────────
  const budgetedCatSet  = new Set(monthBudgets.map((b) => b.category.toLowerCase()));
  const monthExpenseTx  = transactions.filter((t) => {
    const d = new Date(t.occurredAt);
    return t.type === "EXPENSE" && t.currencyCode === currency &&
           d.getMonth() === month && d.getFullYear() === year;
  });
  const catSpend: Record<string, number> = {};
  for (const tx of monthExpenseTx) {
    if (!budgetedCatSet.has(tx.category.toLowerCase())) {
      catSpend[tx.category] = (catSpend[tx.category] ?? 0) + tx.amountCents;
    }
  }
  const missingBudgets = Object.entries(catSpend)
    .map(([cat, spentCents]) => {
      const projected = dayOfMonth > 0 ? Math.round(spentCents / dayOfMonth * daysInMonth) : spentCents;
      const suggested = Math.ceil(Math.max(spentCents, projected) / 1000) * 1000;
      return { cat, spentCents, suggested };
    })
    .sort((a, b) => b.spentCents - a.spentCents);

  const accName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "Unknown account";

  // ── Section header helper ────────────────────────────────────────────────
  function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground flex-shrink-0">{icon}</span>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
      </div>
    );
  }

  return (
    <Layout>
      <div className="p-4 space-y-5 pt-12 pb-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Budget Coach</h1>
          <p className="text-muted-foreground text-sm mt-1">Spending risks, budget pace, and guardrails.</p>
        </header>

        {/* Controls */}
        <div className="space-y-3">
          <MonthSelector currentDate={currentDate} onChange={setCurrentDate} />
          <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
            {(["USD", "BRL"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
                  currency === c ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c === "USD" ? "🇺🇸 USD" : "🇧🇷 BRL"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Coach summary strip ── */}
        {monthBudgets.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-2">
            {[
              { label: "Over",  count: overCount,  cls: "text-rose-400" },
              { label: "Risk",  count: riskCount,  cls: "text-amber-400" },
              { label: "Watch", count: watchCount, cls: "text-amber-400/70" },
              { label: "Safe",  count: safeCount,  cls: "text-emerald-400" },
            ].map(({ label, count, cls }) => (
              <div key={label} className="glass-card p-3 rounded-xl text-center">
                <p className={`text-2xl font-bold ${cls}`}>{count}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── A: Budget Risk Cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
          className="glass-card p-5 rounded-2xl space-y-4"
        >
          <div className="flex items-center justify-between">
            <SectionHeader icon={<Target className="w-4 h-4" />} title="Budget Risk" />
            <Link href="/budgets" className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5">
              Manage <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {monthBudgets.length === 0 ? (
            <div className="py-6 text-center space-y-3">
              <Target className="w-8 h-8 text-muted-foreground/25 mx-auto" />
              <p className="text-sm text-muted-foreground">
                No budgets for {formatMonthYear(currentMonth + "-01")} in {currency}.
              </p>
              <Link href="/budgets">
                <button className="flex items-center gap-1.5 mx-auto text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors px-3 py-2 rounded-xl">
                  <Plus className="w-3.5 h-3.5" /> Create Budget
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {budgetRisks.map(({ budget, spent, remaining, pctUsed, projectedMonthEnd, projectedOverUnder, dailyRemaining, risk, insight }) => {
                const meta      = riskMeta[risk];
                const pctDisplay = Math.round(pctUsed * 100);
                const barWidth   = Math.min(pctDisplay, 100);
                return (
                  <div key={budget.id} className={`glass-card p-4 rounded-xl border ${meta.border}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{budget.category}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${meta.bg} ${meta.text}`}>
                          {meta.label}
                        </span>
                      </div>
                      <span className={`text-sm font-bold tabular-nums flex-shrink-0 ml-2 ${meta.text}`}>{pctDisplay}%</span>
                    </div>

                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
                      <div className={`h-full rounded-full transition-all ${meta.bar}`} style={{ width: `${barWidth}%` }} />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">Spent</p>
                        <p className="text-xs font-semibold tabular-nums">{formatMoney(spent, currency)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">Limit</p>
                        <p className="text-xs font-semibold tabular-nums">{formatMoney(budget.monthlyLimitCents, currency)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">{remaining >= 0 ? "Left" : "Over"}</p>
                        <p className={`text-xs font-semibold tabular-nums ${remaining < 0 ? "text-rose-400" : ""}`}>
                          {formatMoney(Math.abs(remaining), currency)}
                        </p>
                      </div>
                    </div>

                    {dayOfMonth > 1 && (
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 mb-2">
                        <span>Projected: {formatMoney(projectedMonthEnd, currency)}</span>
                        {projectedOverUnder > 0
                          ? <span className="text-amber-400">+{formatMoney(projectedOverUnder, currency)} over</span>
                          : <span className="text-emerald-400/70">{formatMoney(Math.abs(projectedOverUnder), currency)} under</span>
                        }
                      </div>
                    )}

                    <p className={`text-xs leading-relaxed ${meta.text}`}>{insight}</p>

                    {dailyRemaining > 0 && risk !== "over" && daysRemaining > 0 && (
                      <p className="text-[10px] text-muted-foreground/50 mt-1">{daysRemaining}d remaining in month.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── B: Spending Pace ── */}
        {monthBudgets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
            className="glass-card p-5 rounded-2xl space-y-4"
          >
            <SectionHeader icon={<TrendingUp className="w-4 h-4 text-indigo-400" />} title={`Spending Pace · ${currency}`} />

            <div className="grid grid-cols-2 gap-2">
              <div className="glass-card p-3 rounded-xl">
                <p className="text-[10px] text-muted-foreground mb-0.5">Budgeted</p>
                <p className="text-base font-bold tabular-nums">{formatMoney(totalBudgeted, currency)}</p>
              </div>
              <div className="glass-card p-3 rounded-xl">
                <p className="text-[10px] text-muted-foreground mb-0.5">Spent</p>
                <p className="text-base font-bold tabular-nums">{formatMoney(totalSpent, currency)}</p>
              </div>
              <div className="glass-card p-3 rounded-xl">
                <p className="text-[10px] text-muted-foreground mb-0.5">Remaining</p>
                <p className={`text-base font-bold tabular-nums ${totalRemaining < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {formatMoney(Math.abs(totalRemaining), currency)}
                  {totalRemaining < 0 && <span className="text-[10px] text-rose-400/70 ml-1">over</span>}
                </p>
              </div>
              <div className="glass-card p-3 rounded-xl">
                <p className="text-[10px] text-muted-foreground mb-0.5">Projected</p>
                <p className={`text-base font-bold tabular-nums ${totalProjected > totalBudgeted ? "text-amber-400" : "text-emerald-400"}`}>
                  {formatMoney(totalProjected, currency)}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {budgetRisks.filter((r) => r.risk !== "safe").slice(0, 4).map(({ budget, risk, insight }) => (
                <div key={budget.id} className="flex items-start gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${risk === "over" ? "bg-rose-400" : "bg-amber-400"}`} />
                  <p className="text-xs text-muted-foreground leading-relaxed">{insight}</p>
                </div>
              ))}
              {budgetRisks.filter((r) => r.risk === "safe").slice(0, 2).map(({ budget, insight }) => (
                <div key={budget.id} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 bg-emerald-400/50" />
                  <p className="text-xs text-muted-foreground/60 leading-relaxed">{insight}</p>
                </div>
              ))}
              {overCount === 0 && riskCount === 0 && watchCount === 0 && (
                <div className="flex items-center gap-2 text-emerald-400">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <p className="text-xs font-medium">All categories are on track. Keep it up!</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1 text-[10px] text-muted-foreground/60 border-t border-white/5">
              <span>{overCount} over</span><span>·</span>
              <span>{riskCount} at risk</span><span>·</span>
              <span>{watchCount} watch</span><span>·</span>
              <span>{safeCount} safe</span>
            </div>
          </motion.div>
        )}

        {/* ── C: Fixed Commitment Pressure ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className={`glass-card p-5 rounded-2xl border ${pm.border} space-y-4`}
        >
          <SectionHeader icon={<Receipt className="w-4 h-4 text-amber-400" />} title="Fixed Commitment Pressure" />

          {recurringIncMonthlyCents === 0 && fixedExpMonthlyCents === 0 ? (
            <div className="py-4 text-center space-y-2">
              <p className="text-sm text-muted-foreground">No recurring rules in {currency}.</p>
              <Link href="/recurring">
                <button className="text-xs text-primary hover:underline">Set up recurring rules →</button>
              </Link>
            </div>
          ) : recurringIncMonthlyCents === 0 ? (
            <div className="space-y-3">
              <div className="glass-card p-3 rounded-xl">
                <p className="text-[10px] text-muted-foreground mb-0.5">Est. fixed commitments/mo</p>
                <p className="text-lg font-bold text-amber-400 tabular-nums">{formatMoney(fixedExpMonthlyCents, currency)}</p>
              </div>
              <div className="flex items-center gap-2 text-amber-400 bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-xs leading-relaxed">Add recurring income to calculate commitment pressure.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`flex items-center justify-between p-3 rounded-xl ${pm.bg} border ${pm.border}`}>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Commitment pressure</p>
                  <p className={`text-xl font-bold ${pm.color}`}>{pm.label}</p>
                </div>
                {commitmentRatio !== null && (
                  <div className="text-right">
                    <p className={`text-3xl font-bold tabular-nums ${pm.color}`}>{Math.round(commitmentRatio * 100)}%</p>
                    <p className="text-[10px] text-muted-foreground">of recurring income</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="glass-card p-3 rounded-xl">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Recurring income/mo</p>
                  <p className="text-sm font-bold text-emerald-400 tabular-nums">{formatMoney(recurringIncMonthlyCents, currency)}</p>
                </div>
                <div className="glass-card p-3 rounded-xl">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Fixed commitments/mo</p>
                  <p className="text-sm font-bold text-amber-400 tabular-nums">{formatMoney(fixedExpMonthlyCents, currency)}</p>
                </div>
                <div className="glass-card p-3 rounded-xl col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Flexible income est./mo</p>
                  <p className={`text-sm font-bold tabular-nums ${flexibleIncome < 0 ? "text-rose-400" : "text-indigo-300"}`}>
                    {formatMoney(Math.abs(flexibleIncome), currency)}
                    {flexibleIncome < 0 && <span className="text-[10px] text-rose-400/70 ml-1">deficit</span>}
                  </p>
                </div>
              </div>

              {commitmentRatio !== null && (
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pm.bar}`} style={{ width: `${Math.min(commitmentRatio * 100, 100)}%` }} />
                </div>
              )}

              <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
                Comfortable &lt;35% · Tight 35–50% · Heavy 50–70% · Critical &gt;70%
              </p>
            </div>
          )}
        </motion.div>

        {/* ── D: Savings Runway ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}
          className={`glass-card p-5 rounded-2xl border ${rm.border} space-y-4`}
        >
          <div className="flex items-center justify-between">
            <SectionHeader icon={<ShieldCheck className={`w-4 h-4 ${rm.color}`} />} title="Savings Runway" />
            {resilienceLevel !== "unknown" && (
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg ${rm.bg} ${rm.color}`}>
                {rm.label}
              </span>
            )}
          </div>

          {/* Account balances */}
          <div className="grid grid-cols-2 gap-2">
            <div className="glass-card p-3 rounded-xl">
              <p className="text-[10px] text-muted-foreground mb-0.5">Liquid balance</p>
              <p className={`text-sm font-bold tabular-nums ${liquidBalCents < 0 ? "text-rose-400" : ""}`}>
                {formatMoney(Math.abs(liquidBalCents), currency)}
                {liquidBalCents < 0 && <span className="text-[10px] text-rose-400/70 ml-1">neg</span>}
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Cash · Checking · Savings</p>
            </div>
            <div className="glass-card p-3 rounded-xl">
              <p className="text-[10px] text-muted-foreground mb-0.5">Total balance</p>
              <p className={`text-sm font-bold tabular-nums ${totalBalCents < 0 ? "text-rose-400" : ""}`}>
                {formatMoney(Math.abs(totalBalCents), currency)}
                {totalBalCents < 0 && <span className="text-[10px] text-rose-400/70 ml-1">neg</span>}
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">All {currency} accounts</p>
            </div>
          </div>

          {/* Runway table */}
          {currAccounts.length === 0 ? (
            <div className="py-3 text-center space-y-1">
              <p className="text-sm text-muted-foreground">No {currency} accounts yet.</p>
              <Link href="/accounts">
                <button className="text-xs text-primary hover:underline">Add account →</button>
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-medium">Runway by baseline</p>
              <div className="rounded-xl overflow-hidden border border-white/5 divide-y divide-white/5">
                <div className="grid grid-cols-3 px-3 py-1.5 bg-white/5">
                  <p className="text-[10px] text-muted-foreground/60">Baseline</p>
                  <p className="text-[10px] text-muted-foreground/60 text-center">Liquid</p>
                  <p className="text-[10px] text-muted-foreground/60 text-right">Total</p>
                </div>
                <div className="grid grid-cols-3 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Fixed bills</p>
                  <p className={`text-xs font-semibold text-center tabular-nums ${liquidRunwayFixed !== null ? rm.color : "text-muted-foreground/40"}`}>
                    {fixedBaselineCents > 0 ? fmtRunway(liquidRunwayFixed) : "—"}
                  </p>
                  <p className={`text-xs font-semibold text-right tabular-nums ${totalRunwayFixed !== null ? "text-indigo-300" : "text-muted-foreground/40"}`}>
                    {fixedBaselineCents > 0 ? fmtRunway(totalRunwayFixed) : "—"}
                  </p>
                </div>
                <div className="grid grid-cols-3 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Avg actual</p>
                  <p className={`text-xs font-semibold text-center tabular-nums ${liquidRunwayActual !== null ? "text-indigo-300" : "text-muted-foreground/40"}`}>
                    {hasActualHistory ? fmtRunway(liquidRunwayActual) : <span className="text-[10px] text-muted-foreground/40">Need history</span>}
                  </p>
                  <p className={`text-xs font-semibold text-right tabular-nums ${totalRunwayActual !== null ? "text-indigo-300" : "text-muted-foreground/40"}`}>
                    {hasActualHistory ? fmtRunway(totalRunwayActual) : "—"}
                  </p>
                </div>
                <div className="grid grid-cols-3 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Budgeted</p>
                  <p className={`text-xs font-semibold text-center tabular-nums ${liquidRunwayBudget !== null ? "text-indigo-300" : "text-muted-foreground/40"}`}>
                    {budgetedBaselineCents > 0 ? fmtRunway(liquidRunwayBudget) : "—"}
                  </p>
                  <p className={`text-xs font-semibold text-right tabular-nums ${totalRunwayBudget !== null ? "text-indigo-300" : "text-muted-foreground/40"}`}>
                    {budgetedBaselineCents > 0 ? fmtRunway(totalRunwayBudget) : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Emergency fund targets */}
          {emgTargets.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-medium">Emergency fund targets</p>
              <div className="space-y-2">
                {emgTargets.map(({ mos, target, progress, gap }) => (
                  <div key={mos} className="glass-card p-3 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium">{mos}-month fund</p>
                      <p className="text-xs font-bold tabular-nums">{formatMoney(target, currency)}</p>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          progress >= 1 ? "bg-emerald-500" : progress >= 0.5 ? "bg-indigo-400" : progress >= 0.25 ? "bg-amber-400" : "bg-rose-400"
                        }`}
                        style={{ width: `${Math.round(Math.max(progress, 0) * 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground/60">{Math.round(Math.max(progress, 0) * 100)}% funded</p>
                      {gap > 0 ? (
                        <p className="text-[10px] text-muted-foreground/60">{formatMoney(gap, currency)} gap</p>
                      ) : (
                        <p className="text-[10px] text-emerald-400">✓ Met</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-2 text-center">
              <p className="text-xs text-muted-foreground">Add fixed bills or budgets to calculate emergency targets.</p>
            </div>
          )}

          {/* Emergency Fund goal link */}
          {emergencyGoal && (
            <Link href="/goals">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15 hover:bg-emerald-500/10 transition-colors">
                <p className="text-xs text-emerald-400">
                  Emergency Fund goal: {Math.round(Math.min(emergencyGoal.currentAmountCents / Math.max(emergencyGoal.targetAmountCents, 1), 1) * 100)}% complete
                </p>
                <ChevronRight className="w-3.5 h-3.5 text-emerald-400/60" />
              </div>
            </Link>
          )}

          <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
            Liquid runway uses cash, checking, and savings. Total runway includes all {currency} accounts.
          </p>
        </motion.div>

        {/* ── E: Upcoming Pressure (next 7 days) ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}
          className="glass-card p-5 rounded-2xl space-y-3"
        >
          <div className="flex items-center justify-between">
            <SectionHeader icon={<CalendarDays className="w-4 h-4 text-indigo-400" />} title={`Upcoming in 7 Days · ${currency}`} />
          </div>

          {fixedExpenses.length === 0 ? (
            <div className="py-4 text-center space-y-1">
              <p className="text-sm text-muted-foreground">No active recurring expenses in {currency}.</p>
              <Link href="/recurring">
                <button className="text-xs text-primary hover:underline">Set up rules →</button>
              </Link>
            </div>
          ) : upcomingItems.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-400/80 py-1">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <p className="text-xs">No bills due in the next 7 days.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2 glass-card rounded-xl">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-xs text-muted-foreground">
                    {upcomingItems.length} bill{upcomingItems.length !== 1 ? "s" : ""} due
                  </span>
                </div>
                <span className="text-sm font-bold text-indigo-300 tabular-nums">{formatMoney(upcomingTotal, currency)}</span>
              </div>

              <div className="space-y-1">
                {upcomingItems.map((item, i) => {
                  const isToday = item.dateStr === toDateStr(today);
                  return (
                    <div key={`${item.rule.id}-${item.dateStr}-${i}`} className="flex items-center gap-3 py-2 px-3 glass-card rounded-xl">
                      <div className="w-12 flex-shrink-0">
                        <p className="text-[10px] font-bold text-muted-foreground">{fmtDate(item.dateStr)}</p>
                        <p className={`text-[10px] ${isToday ? "text-amber-400" : "text-muted-foreground/50"}`}>
                          {isToday ? "Today" : "Upcoming"}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.rule.name}</p>
                        <p className="text-[10px] text-muted-foreground/50 truncate">{accName(item.rule.accountId)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                        <p className="text-sm font-semibold text-rose-400/80 tabular-nums">
                          {formatMoney(item.rule.amountCents, currency)}
                        </p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                          item.isGenerated
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                        }`}>
                          {item.isGenerated ? "Generated" : "Pending"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-1">
                <Link href="/calendar" className="flex-1">
                  <button className="w-full text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/15 transition-colors py-2 rounded-xl flex items-center justify-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" /> View Calendar
                  </button>
                </Link>
                <Link href="/subscriptions" className="flex-1">
                  <button className="w-full text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-colors py-2 rounded-xl flex items-center justify-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5" /> Subscriptions
                  </button>
                </Link>
              </div>
            </>
          )}
        </motion.div>

        {/* ── E: Missing Budget Detection ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="glass-card p-5 rounded-2xl space-y-3"
        >
          <div className="flex items-center justify-between">
            <SectionHeader icon={<AlertCircle className="w-4 h-4 text-indigo-400/70" />} title="Unbudgeted Categories" />
            {missingBudgets.length > 0 && (
              <Link href="/budgets" className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5">
                Create <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          {missingBudgets.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-400 py-1">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <p className="text-xs">All expense categories have budgets this month.</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] text-muted-foreground/50">
                Spending without a budget in {formatMonthYear(currentMonth + "-01")} · {currency}.
              </p>
              <div className="space-y-1.5">
                {missingBudgets.map(({ cat, spentCents, suggested }) => (
                  <div key={cat} className="flex items-center gap-3 py-2.5 px-3 glass-card rounded-xl border border-indigo-500/10">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cat}</p>
                      <p className="text-[10px] text-muted-foreground">{formatMoney(spentCents, currency)} spent this month</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-muted-foreground/50">Suggested</p>
                      <p className="text-xs font-semibold text-indigo-300 tabular-nums">{formatMoney(suggested, currency)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/budgets">
                <button className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-500/5 border border-indigo-500/15 hover:bg-indigo-500/10 transition-colors text-xs font-medium text-indigo-400">
                  <Plus className="w-3.5 h-3.5" /> Create Budgets
                </button>
              </Link>
            </>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
