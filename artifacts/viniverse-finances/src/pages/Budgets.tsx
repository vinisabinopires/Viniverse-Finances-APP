import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useLiveBudgets, useLiveTransactions, calcBudgetSpent } from "@/hooks/use-finance";
import { BudgetDetailDrawer } from "@/components/BudgetDetailDrawer";
import { MonthSelector } from "@/components/MonthSelector";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { BudgetForm } from "@/components/BudgetForm";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Target } from "lucide-react";
import type { Budget } from "@/types";

function getBudgetStatus(pct: number) {
  if (pct >= 100) return { label: "Over Budget", color: "rose" } as const;
  if (pct >= 70) return { label: "Caution", color: "amber" } as const;
  return { label: "Safe", color: "emerald" } as const;
}

const barColors = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

const textColors = {
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
};

const badgeColors = {
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  rose: "bg-rose-500/10 text-rose-400 border-rose-500/25",
};

export default function Budgets() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [addOpen, setAddOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const budgets = useLiveBudgets();
  const transactions = useLiveTransactions();

  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

  const monthBudgets = budgets
    .filter((b) => b.month === currentMonth)
    .map((b) => {
      const spent = calcBudgetSpent(transactions, b.category, b.month, b.currencyCode);
      const pct = Math.round((spent / b.monthlyLimitCents) * 100);
      return { budget: b, spent, pct };
    })
    .sort((a, b) => b.pct - a.pct);

  const selectedSpent = selectedBudget
    ? calcBudgetSpent(transactions, selectedBudget.category, selectedBudget.month, selectedBudget.currencyCode)
    : 0;

  return (
    <Layout>
      <div className="p-4 space-y-4 pt-12 pb-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground text-sm mt-1">Monthly spending limits by category.</p>
        </header>

        <MonthSelector currentDate={currentDate} onChange={setCurrentDate} />

        <AnimatePresence mode="popLayout">
          {monthBudgets.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center py-16 glass-card rounded-2xl flex flex-col items-center gap-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                <Target className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">No budgets for {currentMonth}</p>
                <p className="text-xs text-muted-foreground mt-1">Create one to track your spending limits.</p>
              </div>
            </motion.div>
          ) : (
            monthBudgets.map(({ budget, spent, pct }, i) => {
              const status = getBudgetStatus(pct);
              const remaining = budget.monthlyLimitCents - spent;
              return (
                <motion.div
                  key={budget.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.06 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedBudget(budget)}
                  className="glass-card p-5 rounded-2xl cursor-pointer hover:bg-white/10 active:bg-white/15 transition-colors"
                  data-testid={`card-budget-${budget.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{budget.category}</h3>
                      <span className="text-xs font-medium bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-full text-muted-foreground">
                        {budget.currencyCode}
                      </span>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeColors[status.color]}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColors[status.color]}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className={`font-semibold ${textColors[status.color]}`}>
                        {formatMoney(spent, budget.currencyCode)} spent
                      </span>
                      <span className="text-muted-foreground">
                        {pct}% of {formatMoney(budget.monthlyLimitCents, budget.currencyCode)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {remaining >= 0
                        ? `${formatMoney(remaining, budget.currencyCode)} remaining`
                        : `Over by ${formatMoney(Math.abs(remaining), budget.currencyCode)}`}
                    </p>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: monthBudgets.length * 0.06 }}
        >
          <Button
            onClick={() => setAddOpen(true)}
            variant="outline"
            data-testid="btn-add-budget"
            className="w-full border-dashed border-white/20 bg-white/5 hover:bg-white/10 rounded-xl py-6 text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Budget
          </Button>
        </motion.div>
      </div>

      {/* Add budget drawer */}
      <Drawer open={addOpen} onOpenChange={setAddOpen}>
        <DrawerContent className="bg-background border-t border-white/10 text-foreground p-4 pb-safe max-h-[92dvh] overflow-y-auto">
          <DrawerHeader className="px-0 pb-2">
            <DrawerTitle>New Budget</DrawerTitle>
          </DrawerHeader>
          <div className="pb-8">
            {addOpen && (
              <BudgetForm
                defaultMonth={currentMonth}
                onSuccess={() => setAddOpen(false)}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Detail / edit / delete drawer */}
      <BudgetDetailDrawer
        budget={selectedBudget}
        spentCents={selectedSpent}
        onClose={() => setSelectedBudget(null)}
      />
    </Layout>
  );
}
