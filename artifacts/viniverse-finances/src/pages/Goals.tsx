import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useLiveGoals, useLiveTransactions, useLiveAccounts } from "@/hooks/use-finance";
import { GoalDetailDrawer } from "@/components/GoalDetailDrawer";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { GoalForm } from "@/components/GoalForm";
import { Button } from "@/components/ui/button";
import { formatMoney, formatDate } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Target, ChevronDown } from "lucide-react";
import type { FinancialGoal } from "@/types";
import { GOAL_TYPE_META } from "@/constants/goals";

export default function Goals() {
  const goals = useLiveGoals();
  const transactions = useLiveTransactions();
  const accounts = useLiveAccounts();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<FinancialGoal | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const activeGoals = goals.filter((g) => !g.isArchived);
  const archivedGoals = goals.filter((g) => g.isArchived);

  // For emergency fund: current month expenses per currency
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const getMonthExpenses = (currency: "USD" | "BRL") => {
    // Only count expenses from accounts matching that currency
    const currencyAccountIds = new Set(accounts.filter((a) => a.currencyCode === currency).map((a) => a.id));
    return transactions
      .filter((t) => t.type === "EXPENSE" && t.currencyCode === currency && t.occurredAt.slice(0, 7) === currentMonth && currencyAccountIds.has(t.accountId))
      .reduce((s, t) => s + t.amountCents, 0);
  };

  const selectedMonthExpenses = selectedGoal
    ? getMonthExpenses(selectedGoal.currencyCode)
    : 0;

  return (
    <Layout>
      <div className="p-4 space-y-5 pt-12 pb-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Goals</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your savings and financial objectives.</p>
        </header>

        {/* Active goals */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-3">
            Active Goals ({activeGoals.length})
          </h3>
          {activeGoals.length === 0 ? (
            <div className="text-center py-10 glass-card rounded-2xl">
              <Target className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No goals yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Create one below to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {activeGoals.map((goal, i) => (
                  <GoalCard key={goal.id} goal={goal} index={i} onClick={() => setSelectedGoal(goal)} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Archived goals */}
        {archivedGoals.length > 0 && (
          <div>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-3 hover:text-foreground transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showArchived ? "rotate-180" : ""}`} />
              Archived Goals ({archivedGoals.length})
            </button>
            <AnimatePresence>
              {showArchived && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  {archivedGoals.map((goal, i) => (
                    <GoalCard key={goal.id} goal={goal} index={i} onClick={() => setSelectedGoal(goal)} dimmed />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Add button */}
        <Button
          onClick={() => setAddOpen(true)}
          variant="outline"
          data-testid="btn-add-goal"
          className="w-full border-dashed border-white/20 bg-white/5 hover:bg-white/10 rounded-xl py-6 text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Goal
        </Button>
      </div>

      {/* Add drawer */}
      <Drawer open={addOpen} onOpenChange={setAddOpen}>
        <DrawerContent className="bg-background border-t border-white/10 text-foreground p-4 pb-safe max-h-[92dvh] overflow-y-auto">
          <DrawerHeader className="px-0 pb-2">
            <DrawerTitle>New Financial Goal</DrawerTitle>
          </DrawerHeader>
          <div className="pb-8">
            {addOpen && <GoalForm onSuccess={() => setAddOpen(false)} />}
          </div>
        </DrawerContent>
      </Drawer>

      <GoalDetailDrawer
        goal={selectedGoal}
        monthExpensesCents={selectedMonthExpenses}
        onClose={() => setSelectedGoal(null)}
      />
    </Layout>
  );
}

function GoalCard({ goal, index, onClick, dimmed = false }: {
  goal: FinancialGoal;
  index: number;
  onClick: () => void;
  dimmed?: boolean;
}) {
  const pct = goal.targetAmountCents > 0
    ? Math.min(Math.round((goal.currentAmountCents / goal.targetAmountCents) * 100), 100)
    : 0;
  const remaining = Math.max(goal.targetAmountCents - goal.currentAmountCents, 0);
  const meta = GOAL_TYPE_META[goal.goalType];

  const barColor =
    pct >= 100 ? "bg-yellow-400" :
    pct >= 70  ? "bg-emerald-500/80" :
    pct >= 30  ? "bg-indigo-500/80" :
    "bg-blue-500/80";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: dimmed ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      data-testid={`card-goal-${goal.id}`}
      className="glass-card p-5 rounded-2xl cursor-pointer hover:bg-white/10 active:bg-white/15 transition-colors space-y-4"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 ${meta.bg}`}>
          {meta.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-foreground leading-tight">{goal.name}</h4>
            <span className={`text-xs font-bold flex-shrink-0 tabular-nums ${pct >= 100 ? "text-yellow-400" : pct >= 70 ? "text-emerald-400" : "text-muted-foreground"}`}>
              {pct}%
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${meta.badge}`}>
              {meta.label}
            </span>
            {goal.targetDate && (
              <span className="text-[10px] text-muted-foreground">by {formatDate(goal.targetDate)}</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, delay: index * 0.05 }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatMoney(goal.currentAmountCents, goal.currencyCode)} saved</span>
          {remaining > 0
            ? <span>{formatMoney(remaining, goal.currencyCode)} to go</span>
            : <span className="text-yellow-400 font-semibold">Goal reached!</span>}
        </div>
      </div>
    </motion.div>
  );
}
