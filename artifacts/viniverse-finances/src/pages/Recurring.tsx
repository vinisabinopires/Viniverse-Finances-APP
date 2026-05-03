import { useState } from "react";
import { Layout } from "@/components/Layout";
import {
  useLiveRecurringRules, useLiveAccounts,
  generateDueTransactions, getNextOccurrenceAfter,
  type GenerateResult,
} from "@/hooks/use-finance";
import { RecurringDetailDrawer } from "@/components/RecurringDetailDrawer";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { RecurringForm } from "@/components/RecurringForm";
import { Button } from "@/components/ui/button";
import { formatMoney, formatDate, formatFrequency } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, RefreshCw, ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";
import type { RecurringRule } from "@/types";

export default function Recurring() {
  const rules = useLiveRecurringRules();
  const accounts = useLiveAccounts();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<RecurringRule | null>(null);
  const [generating, setGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<GenerateResult | null>(null);

  const activeRules = rules.filter((r) => r.isActive);
  const inactiveRules = rules.filter((r) => !r.isActive);

  const handleGenerate = async () => {
    setGenerating(true);
    setLastResult(null);
    try {
      const result = await generateDueTransactions(rules);
      setLastResult(result);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Layout>
      <div className="p-4 space-y-5 pt-12 pb-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Recurring</h1>
          <p className="text-muted-foreground text-sm mt-1">Automated income and expense rules.</p>
        </header>

        {/* Generate button */}
        <div className="glass-card p-4 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wide">Generate Transactions</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Generate all due transactions up to today for every active rule. Duplicates are automatically skipped.
          </p>
          <Button
            onClick={handleGenerate}
            disabled={generating || activeRules.length === 0}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl py-5 font-semibold disabled:opacity-50"
            data-testid="btn-generate"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${generating ? "animate-spin" : ""}`} />
            {generating ? "Generating…" : "Generate Due Transactions"}
          </Button>

          <AnimatePresence>
            {lastResult && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`rounded-xl p-3 text-sm border ${
                  lastResult.created > 0
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                    : "bg-white/5 border-white/10 text-muted-foreground"
                }`}
              >
                {lastResult.created === 0 && lastResult.skipped === 0
                  ? "No due transactions found."
                  : `Created ${lastResult.created} transaction${lastResult.created !== 1 ? "s" : ""}${lastResult.skipped > 0 ? `, skipped ${lastResult.skipped} duplicate${lastResult.skipped !== 1 ? "s" : ""}` : ""}.`}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Active rules */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-3">
            Active Rules ({activeRules.length})
          </h3>
          {activeRules.length === 0 ? (
            <div className="text-center py-10 glass-card rounded-2xl">
              <p className="text-muted-foreground text-sm">No active rules.</p>
              <p className="text-xs text-muted-foreground mt-1">Create one below to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {activeRules.map((rule, i) => (
                  <RuleCard key={rule.id} rule={rule} accounts={accounts} index={i} onClick={() => setSelectedRule(rule)} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Inactive rules */}
        {inactiveRules.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-3">
              Paused Rules ({inactiveRules.length})
            </h3>
            <div className="space-y-3">
              {inactiveRules.map((rule, i) => (
                <RuleCard key={rule.id} rule={rule} accounts={accounts} index={i} onClick={() => setSelectedRule(rule)} />
              ))}
            </div>
          </div>
        )}

        {/* Add button */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Button
            onClick={() => setAddOpen(true)}
            variant="outline"
            data-testid="btn-add-rule"
            className="w-full border-dashed border-white/20 bg-white/5 hover:bg-white/10 rounded-xl py-6 text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Recurring Rule
          </Button>
        </motion.div>
      </div>

      {/* Add drawer */}
      <Drawer open={addOpen} onOpenChange={setAddOpen}>
        <DrawerContent className="bg-background border-t border-white/10 text-foreground p-4 pb-safe max-h-[92dvh] overflow-y-auto">
          <DrawerHeader className="px-0 pb-2">
            <DrawerTitle>New Recurring Rule</DrawerTitle>
          </DrawerHeader>
          <div className="pb-8">
            {addOpen && <RecurringForm onSuccess={() => setAddOpen(false)} />}
          </div>
        </DrawerContent>
      </Drawer>

      <RecurringDetailDrawer rule={selectedRule} onClose={() => setSelectedRule(null)} />
    </Layout>
  );
}

function RuleCard({
  rule, accounts, index, onClick,
}: {
  rule: RecurringRule;
  accounts: ReturnType<typeof useLiveAccounts>;
  index: number;
  onClick: () => void;
}) {
  const isIncome = rule.type === "INCOME";
  const account = accounts.find((a) => a.id === rule.accountId);
  const nextDue = getNextOccurrenceAfter(rule, new Date());

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      data-testid={`card-rule-${rule.id}`}
      className="glass-card p-4 rounded-2xl cursor-pointer hover:bg-white/10 active:bg-white/15 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isIncome ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
          {isIncome ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 justify-between">
            <h4 className="font-semibold text-foreground truncate">{rule.name}</h4>
            <span className={`font-semibold text-sm whitespace-nowrap ${isIncome ? "text-emerald-400" : "text-rose-400"}`}>
              {isIncome ? "+" : "-"}{formatMoney(rule.amountCents, rule.currencyCode)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground">{rule.category}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground">{formatFrequency(rule.frequency)}</span>
            {account && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground truncate">{account.name}</span>
              </>
            )}
          </div>
          {nextDue && (
            <p className="text-xs text-indigo-400/80 mt-1">
              Next: {formatDate(nextDue.toISOString())}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
