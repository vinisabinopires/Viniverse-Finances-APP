import { useState, useMemo, useCallback } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { TransactionDetailDrawer } from "@/components/TransactionDetailDrawer";
import {
  useLiveAccounts, useLiveTransactions, useLiveRecurringRules,
  generateDueTransactions, generateTransactionsUpTo, generateForDate,
  getOccurrenceDatesForRange, toDateStr,
} from "@/hooks/use-finance";
import { formatMoney, formatDate, formatFrequency, formatMonthYear } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, RefreshCw, ArrowDownRight, ArrowUpRight,
  CalendarDays, Zap, Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Transaction, RecurringRule } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Currency = "USD" | "BRL";
type OccurrenceStatus = "generated" | "pending" | "future" | "inactive";

interface OccurrenceItem {
  rule: RecurringRule;
  dateStr: string;
  key: string;
  generatedTx: Transaction | undefined;
  status: OccurrenceStatus;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtShort(cents: number, currency: Currency): string {
  const sign = cents < 0 ? "-" : "+";
  const abs  = Math.abs(cents);
  const sym  = currency === "USD" ? "$" : "R$";
  if (abs >= 1000000) return `${sign}${sym}${(abs / 100000).toFixed(0)}k`;
  if (abs >= 100000)  return `${sign}${sym}${(abs / 100000).toFixed(1)}k`;
  if (abs >= 10000)   return `${sign}${sym}${Math.round(abs / 100)}`;
  return `${sign}${sym}${(abs / 100).toFixed(0)}`;
}

const STATUS_COLOR: Record<OccurrenceStatus, string> = {
  generated: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  pending:   "text-amber-400  bg-amber-500/15  border-amber-500/30",
  future:    "text-indigo-400 bg-indigo-500/15 border-indigo-500/30",
  inactive:  "text-muted-foreground bg-white/5 border-white/10",
};

const STATUS_LABEL: Record<OccurrenceStatus, string> = {
  generated: "Generated",
  pending:   "Pending",
  future:    "Upcoming",
  inactive:  "Inactive",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { toast } = useToast();

  // Stable "today" reference (does not change mid-session)
  const [todayRef] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const todayStr = toDateStr(todayRef);

  // State
  const [calDate, setCalDate] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [currency, setCurrency]     = useState<Currency>("USD");
  const [selectedDay, setSelectedDay] = useState<string | null>(todayStr);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Data
  const accounts       = useLiveAccounts();
  const transactions   = useLiveTransactions();
  const recurringRules = useLiveRecurringRules();

  // Derived calendar values
  const year        = calDate.getFullYear();
  const month       = calDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad    = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0

  const calCells = useMemo<(number | null)[]>(() => {
    const cells: (number | null)[] = [
      ...Array(startPad).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [startPad, daysInMonth]);

  // Transactions by date for selected currency
  const txByDate = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    for (const t of transactions) {
      if (t.currencyCode !== currency) continue;
      const d = t.occurredAt.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(t);
    }
    return map;
  }, [transactions, currency]);

  // All recurring occurrences for selected month + currency
  const occurrencesByDate = useMemo(() => {
    const map: Record<string, OccurrenceItem[]> = {};
    const monthStart = new Date(year, month, 1);
    const monthEnd   = new Date(year, month + 1, 0);
    for (const rule of recurringRules) {
      if (rule.currencyCode !== currency) continue;
      const dates = getOccurrenceDatesForRange(rule, monthStart, monthEnd);
      for (const dateStr of dates) {
        const key         = `${rule.id}:${dateStr}`;
        const generatedTx = transactions.find((t) => t.recurringOccurrenceKey === key);
        const status: OccurrenceStatus =
          !rule.isActive ? "inactive"  :
          generatedTx    ? "generated" :
          dateStr > todayStr ? "future" :
                              "pending";
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push({ rule, dateStr, key, generatedTx, status });
      }
    }
    return map;
  }, [recurringRules, transactions, currency, year, month, todayStr]);

  // Monthly cashflow summary
  const summary = useMemo(() => {
    const mm        = `${year}-${String(month + 1).padStart(2, "0")}`;
    const monthTxs  = transactions.filter((t) => t.currencyCode === currency && t.occurredAt.slice(0, 7) === mm);
    const actualIn  = monthTxs.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amountCents, 0);
    const actualOut = monthTxs.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amountCents, 0);
    let expIn = 0; let expOut = 0; let pendIn = 0; let pendOut = 0;
    for (const occs of Object.values(occurrencesByDate)) {
      for (const occ of occs) {
        const amt = occ.rule.amountCents;
        if (occ.rule.type === "INCOME")  { expIn  += amt; if (occ.status === "pending") pendIn  += amt; }
        else                             { expOut += amt; if (occ.status === "pending") pendOut += amt; }
      }
    }
    return { actualIn, actualOut, expIn, expOut, pendIn, pendOut };
  }, [transactions, currency, year, month, occurrencesByDate]);

  // Bills timeline: all occurrences for month sorted by date, grouped
  const billsGrouped = useMemo(() => {
    const flat = Object.values(occurrencesByDate).flat()
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    const map = new Map<string, OccurrenceItem[]>();
    for (const item of flat) {
      if (!map.has(item.dateStr)) map.set(item.dateStr, []);
      map.get(item.dateStr)!.push(item);
    }
    return Array.from(map.entries());
  }, [occurrencesByDate]);

  // Month nav
  const prevMonth = () => setCalDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; });
  const nextMonth = () => setCalDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; });
  const goToday   = () => {
    setCalDate(new Date(todayRef.getFullYear(), todayRef.getMonth(), 1));
    setSelectedDay(todayStr);
  };

  // Generate
  const runGenerate = useCallback(async (action: "day" | "today" | "month") => {
    if (isGenerating) return;
    const activeRules = recurringRules.filter((r) => r.isActive && r.currencyCode === currency);
    if (activeRules.length === 0) {
      toast({ title: "No active rules", description: `Set up recurring rules for ${currency} first.` });
      return;
    }
    setIsGenerating(true);
    try {
      let result;
      if (action === "day" && selectedDay) {
        result = await generateForDate(activeRules, new Date(selectedDay + "T12:00:00"));
      } else if (action === "today") {
        result = await generateDueTransactions(activeRules);
      } else {
        const monthEnd = new Date(year, month + 1, 0);
        const cutoff   = todayRef <= monthEnd ? todayRef : monthEnd;
        result = await generateTransactionsUpTo(activeRules, cutoff);
      }
      toast({
        title: result.created > 0
          ? `Generated ${result.created} transaction${result.created !== 1 ? "s" : ""}`
          : "Already up to date",
        description: result.skipped > 0 ? `${result.skipped} duplicate${result.skipped !== 1 ? "s" : ""} skipped.` : undefined,
      });
    } catch {
      toast({ title: "Generation failed", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [recurringRules, currency, isGenerating, selectedDay, year, month, todayRef, toast]);

  // Selected day derived
  const selTxs    = selectedDay ? (txByDate[selectedDay]          ?? []) : [];
  const selOccs   = selectedDay ? (occurrencesByDate[selectedDay] ?? []) : [];
  const selDate   = selectedDay ? new Date(selectedDay + "T12:00:00")    : null;
  const isFuture  = selectedDay ? selectedDay > todayStr                  : false;
  const selIn     = selTxs.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amountCents, 0);
  const selOut    = selTxs.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amountCents, 0);
  const selNet    = selIn - selOut;

  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  return (
    <Layout>
      <div className="p-4 space-y-5 pt-12 pb-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <header>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            Cashflow Calendar
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Upcoming income, bills, and daily money flow.</p>
        </header>

        {/* ── Month nav + currency ─────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-0.5">
            <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={goToday} className="text-sm font-semibold px-2 hover:text-primary transition-colors">
              {formatMonthYear(`${monthStr}-01`)}
            </button>
            <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex bg-white/5 border border-white/10 rounded-xl p-0.5">
            {(["USD", "BRL"] as Currency[]).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currency === c ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* ── Monthly Summary ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          <div className="glass-card p-3 rounded-xl">
            <p className="text-[10px] text-muted-foreground mb-0.5">Actual Income</p>
            <p className="text-sm font-bold text-emerald-400 tabular-nums">{formatMoney(summary.actualIn, currency)}</p>
          </div>
          <div className="glass-card p-3 rounded-xl">
            <p className="text-[10px] text-muted-foreground mb-0.5">Actual Expenses</p>
            <p className="text-sm font-bold text-rose-400 tabular-nums">{formatMoney(summary.actualOut, currency)}</p>
          </div>
          <div className="glass-card p-3 rounded-xl">
            <p className="text-[10px] text-muted-foreground mb-0.5">Expected Recurring In</p>
            <p className="text-sm font-bold text-emerald-400/70 tabular-nums">{formatMoney(summary.expIn, currency)}</p>
          </div>
          <div className="glass-card p-3 rounded-xl">
            <p className="text-[10px] text-muted-foreground mb-0.5">Expected Recurring Out</p>
            <p className="text-sm font-bold text-rose-400/70 tabular-nums">{formatMoney(summary.expOut, currency)}</p>
          </div>
        </div>

        {(summary.pendIn > 0 || summary.pendOut > 0) && (
          <div className="flex items-start gap-2 glass-card px-3 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400 leading-relaxed">
              {summary.pendOut > 0 && <span>{formatMoney(summary.pendOut, currency)} in pending bills</span>}
              {summary.pendOut > 0 && summary.pendIn > 0 && " · "}
              {summary.pendIn > 0 && <span>{formatMoney(summary.pendIn, currency)} in pending income</span>}
            </p>
          </div>
        )}

        {/* ── Calendar Grid ─────────────────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-3">
          {/* DOW headers */}
          <div className="grid grid-cols-7 mb-1">
            {DOW_LABELS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground/50 py-1">{d}</div>
            ))}
          </div>
          {/* Cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {calCells.map((day, idx) => {
              if (day === null) return <div key={`pad-${idx}`} />;
              const ds      = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayTxs  = txByDate[ds]           ?? [];
              const dayOccs = occurrencesByDate[ds]  ?? [];
              const inc     = dayTxs.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amountCents, 0);
              const exp     = dayTxs.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amountCents, 0);
              const net     = inc - exp;
              const hasInc  = inc > 0;
              const hasExp  = exp > 0;
              const hasPend = dayOccs.some((o) => o.status === "pending");
              const hasFut  = dayOccs.some((o) => o.status === "future");
              const isToday = ds === todayStr;
              const isSel   = ds === selectedDay;

              return (
                <button
                  key={ds}
                  onClick={() => setSelectedDay(isSel ? null : ds)}
                  className={`
                    relative flex flex-col items-center pt-1 pb-1.5 rounded-xl transition-all min-h-[48px]
                    ${isSel   ? "bg-indigo-500/25 ring-1 ring-indigo-500/50" :
                      isToday ? "bg-primary/10" :
                                "hover:bg-white/5"}
                  `}
                >
                  <span className={`text-xs font-semibold leading-none mb-1 ${
                    isToday ? "text-primary" : isSel ? "text-indigo-300" : "text-foreground/80"
                  }`}>
                    {day}
                  </span>
                  {/* Dot indicators */}
                  {(hasInc || hasExp || hasPend || hasFut) && (
                    <div className="flex gap-0.5 items-center justify-center">
                      {hasInc  && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
                      {hasExp  && <div className="w-1.5 h-1.5 rounded-full bg-rose-400   flex-shrink-0" />}
                      {hasPend && <div className="w-1.5 h-1.5 rounded-full bg-amber-400  flex-shrink-0" />}
                      {hasFut && !hasPend && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/70 flex-shrink-0" />}
                    </div>
                  )}
                  {/* Net amount */}
                  {(hasInc || hasExp) && (
                    <span className={`text-[8px] leading-none mt-0.5 font-medium tabular-nums ${net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {fmtShort(net, currency)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 px-1 flex-wrap">
          {[
            { color: "bg-emerald-400", label: "Income" },
            { color: "bg-rose-400",    label: "Expense" },
            { color: "bg-amber-400",   label: "Pending" },
            { color: "bg-indigo-400/70", label: "Upcoming" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${color}`} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* ── Selected Day Panel ────────────────────────────────────────── */}
        <AnimatePresence>
          {selectedDay && (
            <motion.div
              key={selectedDay}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="glass-card rounded-2xl overflow-hidden"
              data-testid="selected-day-panel"
            >
              {/* Day header */}
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">
                    {selDate ? formatDate(selDate.toISOString()) : ""}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selTxs.length} transaction{selTxs.length !== 1 ? "s" : ""}
                    {selOccs.length > 0 && ` · ${selOccs.length} recurring`}
                  </p>
                </div>
                <button onClick={() => setSelectedDay(null)} className="text-muted-foreground/50 hover:text-foreground text-xl leading-none w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10">×</button>
              </div>

              {/* Summary row */}
              {(selTxs.length > 0 || selOccs.length > 0) && (
                <div className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/10">
                  <div className="px-3 py-2 text-center">
                    <p className="text-[10px] text-emerald-400">Income</p>
                    <p className="text-xs font-bold text-emerald-400 tabular-nums">{formatMoney(selIn, currency)}</p>
                  </div>
                  <div className="px-3 py-2 text-center">
                    <p className="text-[10px] text-rose-400">Expenses</p>
                    <p className="text-xs font-bold text-rose-400 tabular-nums">{formatMoney(selOut, currency)}</p>
                  </div>
                  <div className="px-3 py-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Net</p>
                    <p className={`text-xs font-bold tabular-nums ${selNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {selNet >= 0 ? "+" : ""}{formatMoney(selNet, currency)}
                    </p>
                  </div>
                </div>
              )}

              <div className="p-4 space-y-4">
                {/* Actual transactions */}
                {selTxs.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Transactions</p>
                    <div className="space-y-0.5">
                      {selTxs.map((t) => {
                        const acct = accounts.find((a) => a.id === t.accountId);
                        const isIn = t.type === "INCOME";
                        return (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTx(t)}
                            className="w-full flex items-center gap-2.5 py-2 px-2 rounded-xl hover:bg-white/5 transition-colors text-left"
                          >
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isIn ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
                              {isIn ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{t.description || t.category}</p>
                              <p className="text-[11px] text-muted-foreground">{t.category}{acct ? ` · ${acct.name}` : ""}</p>
                            </div>
                            <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${isIn ? "text-emerald-400" : "text-rose-400"}`}>
                              {isIn ? "+" : "-"}{formatMoney(t.amountCents, t.currencyCode)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recurring occurrences */}
                {selOccs.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recurring</p>
                    <div className="space-y-0.5">
                      {selOccs.map((occ) => {
                        const isIn = occ.rule.type === "INCOME";
                        const acct = accounts.find((a) => a.id === occ.rule.accountId);
                        return (
                          <div key={occ.key} className="flex items-center gap-2.5 py-2 px-2 rounded-xl bg-white/5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isIn ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                              {isIn ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{occ.rule.name}</p>
                              <p className="text-[11px] text-muted-foreground">{occ.rule.category} · {formatFrequency(occ.rule.frequency)}{acct ? ` · ${acct.name}` : ""}</p>
                            </div>
                            <div className="flex-shrink-0 text-right space-y-0.5">
                              <p className={`text-sm font-semibold tabular-nums ${isIn ? "text-emerald-400" : "text-rose-400"}`}>
                                {isIn ? "+" : "-"}{formatMoney(occ.rule.amountCents, occ.rule.currencyCode)}
                              </p>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border inline-block ${STATUS_COLOR[occ.status]}`}>
                                {STATUS_LABEL[occ.status]}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selTxs.length === 0 && selOccs.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No transactions or recurring items for this day.</p>
                )}

                {/* Generate for this day */}
                {!isFuture && (
                  <div className="pt-1 border-t border-white/10">
                    <button
                      onClick={() => runGenerate("day")}
                      disabled={isGenerating}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/20 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                      Generate for {selDate ? formatDate(selDate.toISOString()) : "this day"}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Generation Actions ───────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">Generation Actions</p>
          {[
            { label: "Generate all due up to today", action: "today" as const, icon: Zap },
            { label: `Generate ${formatMonthYear(`${monthStr}-01`)} up to today`, action: "month" as const, icon: RefreshCw },
          ].map(({ label, action, icon: Icon }) => (
            <button
              key={action}
              onClick={() => runGenerate(action)}
              disabled={isGenerating}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl glass-card border border-white/10 hover:bg-white/10 disabled:opacity-50 transition-colors text-left"
            >
              <Icon className={`w-4 h-4 text-indigo-400 flex-shrink-0 ${isGenerating ? "animate-spin" : ""}`} />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>

        {/* ── Bills Timeline ────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Bills Timeline</h3>
            <Link href="/recurring" className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5">
              Manage <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {billsGrouped.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="text-xs text-muted-foreground mb-1">No recurring items this month for {currency}.</p>
              <Link href="/recurring" className="text-xs text-primary hover:underline">
                Set up recurring income and bills →
              </Link>
            </div>
          ) : (
            <div className="space-y-0.5">
              {billsGrouped.map(([dateStr, items]) => {
                const isDateToday = dateStr === todayStr;
                const isPast      = dateStr < todayStr;
                const isFut       = dateStr > todayStr;
                const allDone     = items.every((i) => i.status === "generated" || i.status === "inactive");
                const dateLabel   = isDateToday ? "Today" : formatDate(dateStr + "T12:00:00");

                return (
                  <div key={dateStr} className={isPast && allDone ? "opacity-50" : ""}>
                    {/* Date row */}
                    <button
                      onClick={() => setSelectedDay(dateStr === selectedDay ? null : dateStr)}
                      className="flex items-center gap-2 py-2 px-1 w-full text-left hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDateToday ? "bg-primary" : isFut ? "bg-indigo-400/50" : "bg-white/20"}`} />
                      <p className={`text-xs font-semibold ${isDateToday ? "text-primary" : "text-muted-foreground"}`}>{dateLabel}</p>
                    </button>

                    {/* Items */}
                    {items.map((occ) => {
                      const isIn = occ.rule.type === "INCOME";
                      return (
                        <div key={occ.key} className="flex items-center gap-2.5 py-1.5 px-3 rounded-xl hover:bg-white/5 ml-3 transition-colors">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isIn ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                            {isIn ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{occ.rule.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{occ.rule.category}</p>
                          </div>
                          <div className="flex-shrink-0 text-right space-y-0.5">
                            <p className={`text-sm font-semibold tabular-nums ${isIn ? "text-emerald-400" : "text-rose-400"}`}>
                              {isIn ? "+" : "-"}{formatMoney(occ.rule.amountCents, occ.rule.currencyCode)}
                            </p>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border inline-block ${STATUS_COLOR[occ.status]}`}>
                              {STATUS_LABEL[occ.status]}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Transaction Detail Drawer */}
      <TransactionDetailDrawer
        transaction={selectedTx}
        accounts={accounts}
        onClose={() => setSelectedTx(null)}
      />
    </Layout>
  );
}
