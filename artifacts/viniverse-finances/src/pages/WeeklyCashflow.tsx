import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { TransactionCard } from "@/components/TransactionCard";
import { TransactionDetailDrawer } from "@/components/TransactionDetailDrawer";
import {
  useLiveAccounts, useLiveTransactions, useLiveRecurringRules, useLiveWeeklyPlans,
  addWeeklyPlan, updateWeeklyPlan, getWeekStartDate, getWeekEndDate, toDateStr,
  getOccurrenceDatesForRange, generateTransactionsUpTo,
} from "@/hooks/use-finance";
import { formatMoney, formatDate } from "@/utils";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft, ChevronRight, Zap, RefreshCw, ArrowDownRight, ArrowUpRight,
  CheckCircle2, Clock, CalendarDays, PenLine,
} from "lucide-react";
import type { Transaction } from "@/types";

// ─── Constants ─────────────────────────────────────────────────────────────

const FIXED_CATEGORIES = new Set([
  'rent', 'housing', 'mortgage', 'subscription', 'subscriptions',
  'phone', 'internet', 'utilities', 'electricity', 'water', 'gas',
  'insurance', 'health', 'healthcare', 'education', 'loan', 'loans', 'debt',
]);

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatWeekLabel(start: Date, end: Date): string {
  const sm = start.toLocaleString('en-US', { month: 'short' });
  const em = end.toLocaleString('en-US', { month: 'short' });
  const sd = start.getDate(); const ed = end.getDate();
  const yr = end.getFullYear();
  if (sm === em) return `${sm} ${sd}–${ed}, ${yr}`;
  return `${sm} ${sd} – ${em} ${ed}, ${yr}`;
}

// ─── Mini progress bar ─────────────────────────────────────────────────────

function MiniBar({ used, total, color = "indigo" }: { used: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0;
  const barClass = pct >= 100 ? "bg-rose-500/80" : pct >= 80 ? "bg-amber-500/70" : `bg-${color}-500/70`;
  return (
    <div className="space-y-1">
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground text-right">{pct}%</p>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function WeeklyCashflow() {
  const accounts       = useLiveAccounts();
  const transactions   = useLiveTransactions();
  const recurringRules = useLiveRecurringRules();
  const weeklyPlans    = useLiveWeeklyPlans();
  const { toast }      = useToast();

  const [anchorDate, setAnchorDate]     = useState(new Date());
  const [currency, setCurrency]         = useState<'USD' | 'BRL'>('USD');
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTx, setSelectedTx]     = useState<Transaction | null>(null);
  const [planForm, setPlanForm] = useState({
    expectedIncome: '', plannedFixed: '', plannedVariable: '', plannedSavings: '', notes: '',
  });

  // ─── Week bounds ──────────────────────────────────────────────────────────
  const weekStart    = getWeekStartDate(anchorDate);
  const weekEnd      = getWeekEndDate(anchorDate);
  const weekStartStr = toDateStr(weekStart);
  const weekEndStr   = toDateStr(weekEnd);
  const todayStr     = toDateStr(new Date());
  const isCurrentWeek = todayStr >= weekStartStr && todayStr <= weekEndStr;

  // ─── Current plan ─────────────────────────────────────────────────────────
  const currentPlan = weeklyPlans.find((p) => p.weekStartDate === weekStartStr && p.currencyCode === currency);

  // Sync form when plan or week changes
  useEffect(() => {
    if (currentPlan) {
      setPlanForm({
        expectedIncome: (currentPlan.expectedIncomeCents / 100).toFixed(2),
        plannedFixed:    (currentPlan.plannedFixedExpensesCents / 100).toFixed(2),
        plannedVariable: (currentPlan.plannedVariableSpendingCents / 100).toFixed(2),
        plannedSavings:  (currentPlan.plannedSavingsCents / 100).toFixed(2),
        notes:           currentPlan.notes ?? '',
      });
    } else {
      setPlanForm({ expectedIncome: '', plannedFixed: '', plannedVariable: '', plannedSavings: '', notes: '' });
    }
  }, [currentPlan?.id, weekStartStr, currency]);

  // ─── Actuals ──────────────────────────────────────────────────────────────
  const weekTx = transactions.filter((t) => {
    const d = t.occurredAt.slice(0, 10);
    return d >= weekStartStr && d <= weekEndStr && t.currencyCode === currency;
  });
  const actualIncome   = weekTx.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amountCents, 0);
  const actualExpenses = weekTx.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amountCents, 0);
  const actualNet      = actualIncome - actualExpenses;

  const variableExpensesCents = weekTx
    .filter((t) => t.type === 'EXPENSE' && !FIXED_CATEGORIES.has(t.category.toLowerCase()))
    .reduce((s, t) => s + t.amountCents, 0);

  // ─── Planned totals ───────────────────────────────────────────────────────
  const expectedIncome   = currentPlan?.expectedIncomeCents ?? 0;
  const plannedFixed     = currentPlan?.plannedFixedExpensesCents ?? 0;
  const plannedVariable  = currentPlan?.plannedVariableSpendingCents ?? 0;
  const plannedSavings   = currentPlan?.plannedSavingsCents ?? 0;
  const plannedTotalOut  = plannedFixed + plannedVariable + plannedSavings;
  const projectedRemaining = expectedIncome - plannedTotalOut;

  // ─── Safe-to-spend ────────────────────────────────────────────────────────
  const variableRemaining = Math.max(plannedVariable - variableExpensesCents, 0);
  const daysRemaining = isCurrentWeek
    ? Math.max(Math.ceil((weekEnd.getTime() - new Date().getTime()) / 86400000), 1)
    : 7;
  const safeDaily = daysRemaining > 0 ? Math.floor(variableRemaining / daysRemaining) : 0;

  // ─── Recurring this week ──────────────────────────────────────────────────
  const accountsMap = new Map(accounts.map((a) => [a.id, a]));
  const generatedKeys = new Set(
    transactions.filter((t) => t.recurringOccurrenceKey).map((t) => t.recurringOccurrenceKey!)
  );

  const weekRecurring = recurringRules
    .filter((r) => r.currencyCode === currency)
    .flatMap((rule) =>
      getOccurrenceDatesForRange(rule, weekStart, weekEnd).map((dateStr) => ({
        rule, dateStr, key: `${rule.id}:${dateStr}`,
        account: accountsMap.get(rule.accountId),
      }))
    )
    .sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  // ─── Navigation ───────────────────────────────────────────────────────────
  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setAnchorDate(d); };
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setAnchorDate(d); };

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const parseCents = (v: string) => Math.round(parseFloat(v || '0') * 100);

  const handleSavePlan = async () => {
    const payload = {
      weekStartDate: weekStartStr, weekEndDate: weekEndStr, currencyCode: currency,
      expectedIncomeCents:          parseCents(planForm.expectedIncome),
      plannedFixedExpensesCents:    parseCents(planForm.plannedFixed),
      plannedVariableSpendingCents: parseCents(planForm.plannedVariable),
      plannedSavingsCents:          parseCents(planForm.plannedSavings),
      notes: planForm.notes.trim() || undefined,
    };
    if (currentPlan) { await updateWeeklyPlan(currentPlan.id, payload); toast({ title: 'Plan updated' }); }
    else             { await addWeeklyPlan(payload);                    toast({ title: 'Plan saved' }); }
    setShowPlanForm(false);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const active = recurringRules.filter((r) => r.isActive && r.currencyCode === currency);
      const result = await generateTransactionsUpTo(active, weekEnd);
      toast({
        title: `${result.created} transaction${result.created !== 1 ? 's' : ''} generated`,
        description: result.skipped > 0 ? `${result.skipped} already existed.` : result.created === 0 ? 'Nothing to generate for this week.' : undefined,
      });
    } finally { setIsGenerating(false); }
  };

  return (
    <Layout>
      <div className="p-4 space-y-5 pt-12 pb-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Weekly Cashflow</h1>
          <p className="text-muted-foreground text-sm mt-1">Plan and track your money week by week.</p>
        </header>

        {/* Week selector */}
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold">{formatWeekLabel(weekStart, weekEnd)}</p>
            {isCurrentWeek && <p className="text-[10px] text-primary mt-0.5">Current week</p>}
          </div>
          <button onClick={nextWeek} className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Currency toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
          {(['USD', 'BRL'] as const).map((c) => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`py-2.5 rounded-lg text-sm font-medium transition-all ${currency === c ? "bg-primary/20 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {c === 'USD' ? '🇺🇸 USD' : '🇧🇷 BRL'}
            </button>
          ))}
        </div>

        {/* Actuals summary */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 rounded-2xl space-y-4" data-testid="card-weekly-actuals">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Actual This Week</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card p-3 rounded-xl">
              <p className="text-[10px] text-emerald-400 mb-1">Income</p>
              <p className="text-base font-bold text-emerald-400 tabular-nums">{formatMoney(actualIncome, currency)}</p>
            </div>
            <div className="glass-card p-3 rounded-xl">
              <p className="text-[10px] text-rose-400 mb-1">Expenses</p>
              <p className="text-base font-bold text-rose-400 tabular-nums">{formatMoney(actualExpenses, currency)}</p>
            </div>
            <div className="glass-card p-3 rounded-xl">
              <p className="text-[10px] text-muted-foreground mb-1">Net</p>
              <p className={`text-base font-bold tabular-nums ${actualNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {actualNet >= 0 ? "+" : ""}{formatMoney(actualNet, currency)}
              </p>
            </div>
          </div>

          {/* vs Plan */}
          {currentPlan && (
            <div className="pt-2 border-t border-white/10 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">vs Plan</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected income</span>
                  <span className="font-medium">{formatMoney(expectedIncome, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Planned out</span>
                  <span className="font-medium">{formatMoney(plannedTotalOut, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fixed</span>
                  <span className="font-medium">{formatMoney(plannedFixed, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Savings</span>
                  <span className="font-medium">{formatMoney(plannedSavings, currency)}</span>
                </div>
              </div>
              <div className="flex justify-between text-sm font-semibold pt-1">
                <span className="text-muted-foreground">Projected remaining</span>
                <span className={projectedRemaining >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {formatMoney(projectedRemaining, currency)}
                </span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Safe-to-spend */}
        {currentPlan && plannedVariable > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
            className="glass-card p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5" data-testid="card-safe-to-spend">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-indigo-400">Safe-to-Spend</h3>
              <span className="text-[10px] text-muted-foreground ml-auto">Variable budget only · est.</span>
            </div>
            <div className="text-center mb-4">
              <p className="text-4xl font-bold text-indigo-300 tabular-nums">{formatMoney(variableRemaining, currency)}</p>
              <p className="text-xs text-muted-foreground mt-1">remaining of {formatMoney(plannedVariable, currency)} variable budget</p>
            </div>
            <MiniBar used={variableExpensesCents} total={plannedVariable} color="indigo" />
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div className="text-center">
                <p className="text-muted-foreground text-xs mb-0.5">Days remaining</p>
                <p className="font-bold text-xl">{daysRemaining}</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground text-xs mb-0.5">Safe daily spend</p>
                <p className="font-bold text-xl text-indigo-300">{formatMoney(safeDaily, currency)}</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-3 leading-relaxed">
              Excludes fixed categories (rent, subscriptions, insurance, etc.)
            </p>
          </motion.div>
        )}

        {/* Plan form */}
        <div className="space-y-3">
          <button
            onClick={() => setShowPlanForm((x) => !x)}
            className="w-full flex items-center gap-3 p-4 glass-card rounded-2xl hover:bg-white/10 transition-colors text-left"
            data-testid="btn-toggle-plan-form"
          >
            <PenLine className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">{currentPlan ? 'Edit Weekly Plan' : 'Set Up Weekly Plan'}</p>
              <p className="text-xs text-muted-foreground">{currentPlan ? 'Update your income and spending targets' : 'Define income and spending targets for this week'}</p>
            </div>
            <ChevronRight className={`w-4 h-4 text-muted-foreground/50 transition-transform ${showPlanForm ? 'rotate-90' : ''}`} />
          </button>

          <AnimatePresence>
            {showPlanForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="glass-card p-5 rounded-2xl space-y-4 border border-white/10">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Expected Income', key: 'expectedIncome', color: 'text-emerald-400' },
                      { label: 'Planned Fixed', key: 'plannedFixed', color: 'text-rose-400' },
                      { label: 'Variable Spending', key: 'plannedVariable', color: 'text-indigo-400' },
                      { label: 'Planned Savings', key: 'plannedSavings', color: 'text-cyan-400' },
                    ].map(({ label, key, color }) => (
                      <div key={key}>
                        <p className={`text-xs font-medium mb-1.5 ${color}`}>{label}</p>
                        <Input
                          type="number" step="0.01" min="0" placeholder="0.00" inputMode="decimal"
                          value={planForm[key as keyof typeof planForm]}
                          onChange={(e) => setPlanForm((f) => ({ ...f, [key]: e.target.value }))}
                          className="bg-white/5 border-white/10 text-sm"
                          data-testid={`input-plan-${key}`}
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Notes (optional)</p>
                    <Textarea
                      placeholder="e.g. Paycheck on Wednesday…"
                      value={planForm.notes}
                      onChange={(e) => setPlanForm((f) => ({ ...f, notes: e.target.value }))}
                      className="bg-white/5 border-white/10 resize-none text-sm" rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowPlanForm(false)} className="flex-1 bg-white/5 border-white/10 hover:bg-white/10">Cancel</Button>
                    <Button onClick={handleSavePlan} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="btn-save-plan">
                      Save Plan
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Upcoming recurring */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Recurring This Week ({weekRecurring.length})
              </h3>
            </div>
          </div>

          {weekRecurring.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="text-sm text-muted-foreground">No recurring transactions this week.</p>
            </div>
          ) : (
            <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/10 border border-white/10 mb-3">
              {weekRecurring.map(({ rule, dateStr, key, account }) => {
                const isGenerated = generatedKeys.has(key);
                const isIncome    = rule.type === 'INCOME';
                return (
                  <div key={key} className="flex items-center gap-3 p-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {isIncome ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(dateStr)} · {rule.category}
                        {account && ` · ${account.name}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <p className={`text-sm font-semibold tabular-nums ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isIncome ? '+' : '-'}{formatMoney(rule.amountCents, rule.currencyCode)}
                      </p>
                      {isGenerated ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Generated
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            variant="outline"
            className="w-full border-dashed border-white/20 bg-white/5 hover:bg-white/10 rounded-xl py-5 text-sm text-muted-foreground hover:text-foreground"
            data-testid="btn-generate-recurring"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Generating…' : 'Generate Due Transactions for This Week'}
          </Button>
        </div>

        {/* Weekly transactions */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-3">
            Transactions This Week ({weekTx.length})
          </h3>
          {weekTx.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="text-sm text-muted-foreground">No transactions in this week.</p>
              <p className="text-xs text-muted-foreground mt-1">Add transactions or generate recurring ones above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...weekTx].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).map((t) => (
                <TransactionCard key={t.id} transaction={t} onClick={() => setSelectedTx(t)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <TransactionDetailDrawer transaction={selectedTx} accounts={accounts} onClose={() => setSelectedTx(null)} />
    </Layout>
  );
}
