import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { RecurringDetailDrawer } from "@/components/RecurringDetailDrawer";
import {
  useLiveRecurringRules, useLiveAccounts,
  getNextOccurrenceAfter, getOccurrenceDatesForRange, toDateStr,
} from "@/hooks/use-finance";
import { formatMoney, formatFrequency } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, ChevronRight, ChevronDown, ChevronUp,
  Plus, Calendar, Zap, AlertCircle, Receipt, Target,
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

const CATEGORY_GROUPS: Record<string, string[]> = {
  Housing:        ["rent", "housing", "mortgage", "hoa"],
  Utilities:      ["utilities", "electricity", "electric", "water", "gas", "energy"],
  Subscriptions:  ["subscription", "subscriptions", "streaming", "software", "saas"],
  Transportation: ["transportation", "car", "auto", "parking", "transit", "fuel"],
  Insurance:      ["insurance", "healthcare", "health", "dental", "vision"],
  Food:           ["food", "groceries", "grocery", "dining"],
};

const SUBSCRIPTION_KEYWORDS = [
  "apple", "icloud", "netflix", "spotify", "youtube", "music",
  "subscription", "streaming", "software", "app", "phone", "internet",
  "hulu", "disney", "prime", "dropbox", "microsoft",
];

const GROUP_ORDER = ["Housing", "Utilities", "Subscriptions", "Transportation", "Insurance", "Food", "Other"];

function getCategoryGroup(category: string): string {
  const lower = category.toLowerCase();
  for (const [group, keywords] of Object.entries(CATEGORY_GROUPS)) {
    if (keywords.some((k) => lower.includes(k))) return group;
  }
  return "Other";
}

function isSubscriptionLike(rule: RecurringRule): boolean {
  const text = `${rule.name} ${rule.description ?? ""} ${rule.category}`.toLowerCase();
  return SUBSCRIPTION_KEYWORDS.some((k) => text.includes(k));
}

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-muted-foreground">{icon}</span>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Subscriptions() {
  const [currency, setCurrency]     = useState<"USD" | "BRL">("USD");
  const [selectedRule, setSelectedRule] = useState<RecurringRule | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const rules    = useLiveRecurringRules();
  const accounts = useLiveAccounts();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMinus1ms = new Date(today.getTime() - 1);

  // Filter to expense rules for the selected currency
  const expenseRules  = rules.filter((r) => r.type === "EXPENSE" && r.currencyCode === currency);
  const activeRules   = expenseRules.filter((r) => r.isActive);
  const inactiveRules = expenseRules.filter((r) => !r.isActive);

  // ── Summary calculations ──────────────────────────────────────────────────
  const totalMonthlyCents = activeRules.reduce((s, r) => s + toMonthlyCents(r), 0);
  const avgWeeklyCents    = Math.round(totalMonthlyCents * 12 / 52);

  const largestRule = [...activeRules].sort((a, b) => toMonthlyCents(b) - toMonthlyCents(a))[0] ?? null;

  const nextDueItem = activeRules
    .map((r) => ({ rule: r, next: getNextOccurrenceAfter(r, todayMinus1ms) }))
    .filter((x): x is { rule: RecurringRule; next: Date } => x.next !== null)
    .sort((a, b) => a.next.getTime() - b.next.getTime())[0] ?? null;

  // ── Category grouping ─────────────────────────────────────────────────────
  const grouped: Record<string, RecurringRule[]> = {};
  for (const rule of activeRules) {
    const group = getCategoryGroup(rule.category);
    grouped[group] = [...(grouped[group] ?? []), rule];
  }
  const sortedGroups = GROUP_ORDER.filter((g) => (grouped[g]?.length ?? 0) > 0);

  // ── Subscription detection ────────────────────────────────────────────────
  const subscriptionRules = activeRules.filter(isSubscriptionLike);

  // ── Upcoming 30 days ──────────────────────────────────────────────────────
  const in30 = new Date(today);
  in30.setDate(today.getDate() + 30);
  const upcoming: Array<{ rule: RecurringRule; dateStr: string }> = [];
  for (const rule of activeRules) {
    for (const dateStr of getOccurrenceDatesForRange(rule, today, in30)) {
      upcoming.push({ rule, dateStr });
    }
  }
  upcoming.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  const accName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "Unknown account";

  return (
    <Layout>
      <div className="p-4 space-y-5 pt-12 pb-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Subscription Center</h1>
          <p className="text-muted-foreground text-sm mt-1">Fixed bills, commitments, and subscriptions.</p>
        </header>

        {/* Currency toggle */}
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

        {/* ── Empty state ── */}
        {activeRules.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card p-10 rounded-2xl text-center space-y-4"
          >
            <Receipt className="w-10 h-10 text-amber-400/30 mx-auto" />
            <div>
              <p className="text-sm font-semibold text-muted-foreground">No fixed bills or subscriptions yet.</p>
              <p className="text-xs text-muted-foreground/60 mt-1.5 max-w-[250px] mx-auto leading-relaxed">
                Create recurring expense rules for rent, internet, phone, subscriptions, and insurance.
              </p>
            </div>
            <Link href="/recurring">
              <button className="flex items-center gap-1.5 mx-auto text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors px-3 py-2 rounded-xl">
                <Plus className="w-3.5 h-3.5" /> Add Fixed Bill
              </button>
            </Link>
          </motion.div>
        ) : (
          <>
            {/* ── A: Monthly Commitment Summary ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5 rounded-2xl border border-amber-500/15 space-y-4"
            >
              <SectionHeader title={`Monthly Commitments · ${currency}`} icon={<Zap className="w-4 h-4 text-amber-400" />} />

              <div className="grid grid-cols-2 gap-2">
                <div className="glass-card p-3 rounded-xl col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Estimated monthly total</p>
                  <p className="text-2xl font-bold text-amber-400 tabular-nums">{formatMoney(totalMonthlyCents, currency)}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">~{formatMoney(avgWeeklyCents, currency)} per week estimate</p>
                </div>
                <div className="glass-card p-3 rounded-xl">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Active rules</p>
                  <p className="text-2xl font-bold">{activeRules.length}</p>
                </div>
                {nextDueItem ? (
                  <div className="glass-card p-3 rounded-xl">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Next due</p>
                    <p className="text-base font-bold">{fmtDate(toDateStr(nextDueItem.next))}</p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{nextDueItem.rule.name}</p>
                  </div>
                ) : (
                  <div className="glass-card p-3 rounded-xl">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Next due</p>
                    <p className="text-sm text-muted-foreground">—</p>
                  </div>
                )}
              </div>

              {largestRule && (
                <div className="flex items-center justify-between px-1 pt-3 border-t border-white/5">
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground">Largest commitment</p>
                    <p className="text-sm font-semibold truncate">{largestRule.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatFrequency(largestRule.frequency)}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-bold text-amber-400 tabular-nums">{formatMoney(toMonthlyCents(largestRule), currency)}</p>
                    <p className="text-[10px] text-muted-foreground">/mo est.</p>
                  </div>
                </div>
              )}

              {inactiveRules.length > 0 && (
                <p className="text-[10px] text-muted-foreground/50 px-1">
                  {inactiveRules.length} inactive rule{inactiveRules.length !== 1 ? "s" : ""} not included in totals.
                </p>
              )}
            </motion.div>

            {/* ── B: Fixed Bills List ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
              className="glass-card p-5 rounded-2xl space-y-4"
            >
              <div className="flex items-center justify-between -mb-1">
                <SectionHeader title="Fixed Bills" icon={<RefreshCw className="w-4 h-4" />} />
                <Link href="/recurring" className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5 -mt-3">
                  Manage <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {sortedGroups.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">No active expense rules in {currency}.</p>
              ) : (
                sortedGroups.map((group) => (
                  <div key={group}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group}</p>
                    <div className="space-y-1">
                      {grouped[group].map((rule) => {
                        const monthly = toMonthlyCents(rule);
                        const next    = getNextOccurrenceAfter(rule, todayMinus1ms);
                        return (
                          <button
                            key={rule.id}
                            onClick={() => setSelectedRule(rule)}
                            className="w-full glass-card p-3 rounded-xl flex items-center gap-3 text-left hover:bg-white/5 active:scale-[0.99] transition-all"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium truncate">{rule.name}</p>
                                <p className="text-sm font-bold text-amber-400 tabular-nums flex-shrink-0 ml-2">
                                  {formatMoney(rule.amountCents, currency)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-[10px] text-muted-foreground">{formatFrequency(rule.frequency)}</span>
                                <span className="text-[10px] text-muted-foreground/40">·</span>
                                <span className="text-[10px] text-indigo-300/70 tabular-nums">{formatMoney(monthly, currency)}/mo est.</span>
                                {next && (
                                  <>
                                    <span className="text-[10px] text-muted-foreground/40">·</span>
                                    <span className="text-[10px] text-muted-foreground">Next: {fmtDate(toDateStr(next))}</span>
                                  </>
                                )}
                              </div>
                              {rule.accountId && (
                                <p className="text-[10px] text-muted-foreground/50 mt-0.5 truncate">{accName(rule.accountId)}</p>
                              )}
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/25 flex-shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </motion.div>

            {/* ── C: Subscription Review ── */}
            {subscriptionRules.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
                className="glass-card p-5 rounded-2xl border border-indigo-500/15 space-y-3"
              >
                <SectionHeader title="Subscription Review" icon={<Target className="w-4 h-4 text-indigo-400" />} />
                <p className="text-[10px] text-muted-foreground/50 -mt-2">Identified by name or category keywords.</p>
                <div className="space-y-1.5">
                  {subscriptionRules.map((rule) => {
                    const monthly = toMonthlyCents(rule);
                    const next    = getNextOccurrenceAfter(rule, todayMinus1ms);
                    return (
                      <div key={rule.id} className="flex items-center gap-3 py-2 px-3 glass-card rounded-xl">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{rule.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-indigo-300 tabular-nums">{formatMoney(monthly, currency)}/mo</span>
                            {next && (
                              <>
                                <span className="text-[10px] text-muted-foreground/40">·</span>
                                <span className="text-[10px] text-muted-foreground">Due {fmtDate(toDateStr(next))}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedRule(rule)}
                          className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors px-2.5 py-1.5 rounded-lg flex-shrink-0"
                        >
                          Review
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── D: Upcoming Fixed Bills (30 days) ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
              className="glass-card p-5 rounded-2xl space-y-3"
            >
              <SectionHeader title="Upcoming (30 days)" icon={<Calendar className="w-4 h-4 text-amber-400" />} />

              {upcoming.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">No upcoming occurrences in the next 30 days.</p>
              ) : (
                <div className="space-y-1">
                  {upcoming.slice(0, 15).map((item, i) => {
                    const [dy, dm, dd] = item.dateStr.split("-").map(Number);
                    const occDate  = new Date(dy, dm - 1, dd);
                    const daysAway = Math.round((occDate.getTime() - today.getTime()) / 86400000);
                    const urgentCls = daysAway <= 3 ? "text-amber-400" : daysAway <= 7 ? "text-amber-400/70" : "text-muted-foreground";
                    return (
                      <div key={`${item.rule.id}-${item.dateStr}-${i}`} className="flex items-center gap-3 py-2 px-3 glass-card rounded-xl">
                        <div className="w-12 flex-shrink-0 text-center">
                          <p className={`text-[10px] font-bold ${urgentCls}`}>{fmtDate(item.dateStr)}</p>
                          <p className={`text-[10px] ${urgentCls}`}>
                            {daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `${daysAway}d`}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.rule.name}</p>
                          <p className="text-[10px] text-muted-foreground/60 truncate">{accName(item.rule.accountId)}</p>
                        </div>
                        <p className="text-sm font-semibold text-amber-400/90 tabular-nums flex-shrink-0">
                          {formatMoney(item.rule.amountCents, item.rule.currencyCode)}
                        </p>
                      </div>
                    );
                  })}
                  {upcoming.length > 15 && (
                    <p className="text-[10px] text-muted-foreground text-center py-1">
                      +{upcoming.length - 15} more occurrences
                    </p>
                  )}
                </div>
              )}
            </motion.div>

            {/* ── E: Inactive Rules (collapsed) ── */}
            {inactiveRules.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="glass-card p-5 rounded-2xl"
              >
                <button
                  onClick={() => setShowInactive((v) => !v)}
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-muted-foreground/40" />
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Inactive Rules ({inactiveRules.length})
                    </h3>
                  </div>
                  {showInactive
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground/40" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground/40" />}
                </button>

                <AnimatePresence>
                  {showInactive && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1 mt-3">
                        {inactiveRules.map((rule) => (
                          <button
                            key={rule.id}
                            onClick={() => setSelectedRule(rule)}
                            className="w-full glass-card p-3 rounded-xl flex items-center gap-3 text-left opacity-40 hover:opacity-60 transition-opacity"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{rule.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatMoney(rule.amountCents, rule.currencyCode)} · {formatFrequency(rule.frequency)}
                              </p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Add Fixed Bill */}
            <Link href="/recurring">
              <button className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 hover:bg-amber-500/10 transition-colors text-sm font-medium text-amber-400/80">
                <Plus className="w-4 h-4" /> Add Fixed Bill
              </button>
            </Link>
          </>
        )}
      </div>

      <RecurringDetailDrawer rule={selectedRule} onClose={() => setSelectedRule(null)} />
    </Layout>
  );
}
