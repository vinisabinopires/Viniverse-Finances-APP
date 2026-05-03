import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { TransactionDrawer } from "@/components/TransactionDrawer";
import { TransactionDetailDrawer } from "@/components/TransactionDetailDrawer";
import { MonthSelector } from "@/components/MonthSelector";
import { TransactionCard } from "@/components/TransactionCard";
import { useLiveAccounts, useLiveTransactions, useLiveBudgets, calcBudgetSpent } from "@/hooks/use-finance";
import { formatMoney } from "@/utils";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, TrendingUp, Target, ChevronRight } from "lucide-react";
import type { Transaction } from "@/types";

function getBudgetStatus(pct: number) {
  if (pct >= 100) return { label: "Over Budget", color: "rose" } as const;
  if (pct >= 70) return { label: "Caution", color: "amber" } as const;
  return { label: "Safe", color: "emerald" } as const;
}

const barColors = { emerald: "bg-emerald-500/70", amber: "bg-amber-500/70", rose: "bg-rose-500/70" };
const textColors = { emerald: "text-emerald-400", amber: "text-amber-400", rose: "text-rose-400" };

export default function Dashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const accounts = useLiveAccounts();
  const transactions = useLiveTransactions();
  const budgets = useLiveBudgets();

  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

  const currentMonthTransactions = transactions.filter((t) => {
    const tDate = new Date(t.occurredAt);
    return (
      tDate.getMonth() === currentDate.getMonth() &&
      tDate.getFullYear() === currentDate.getFullYear()
    );
  });

  const monthIncome = currentMonthTransactions
    .filter((t) => t.type === "INCOME")
    .reduce((acc, t) => acc + t.amountCents, 0);
  const monthExpense = currentMonthTransactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((acc, t) => acc + t.amountCents, 0);

  const totalUsdBalance = accounts
    .filter((a) => a.currencyCode === "USD")
    .reduce((acc, account) => {
      const accTx = transactions.filter((t) => t.accountId === account.id);
      const income = accTx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amountCents, 0);
      const expense = accTx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amountCents, 0);
      return acc + account.initialBalanceCents + income - expense;
    }, 0);

  const totalBrlBalance = accounts
    .filter((a) => a.currencyCode === "BRL")
    .reduce((acc, account) => {
      const accTx = transactions.filter((t) => t.accountId === account.id);
      const income = accTx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amountCents, 0);
      const expense = accTx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amountCents, 0);
      return acc + account.initialBalanceCents + income - expense;
    }, 0);

  const categoryTotals = currentMonthTransactions
    .filter((t) => t.type === "EXPENSE")
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amountCents;
      return acc;
    }, {});

  const topCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCategoryAmount = topCategories[0]?.[1] || 1;
  const totalBar = monthIncome + monthExpense || 1;
  const incomeBarPct = Math.round((monthIncome / totalBar) * 100);
  const expenseBarPct = Math.round((monthExpense / totalBar) * 100);

  const recentTransactions = currentMonthTransactions.slice(0, 5);

  // Budget Watch: budgets for current month, sorted over→caution→safe
  const monthBudgets = budgets
    .filter((b) => b.month === currentMonth)
    .map((b) => {
      const spent = calcBudgetSpent(transactions, b.category, b.month, b.currencyCode);
      const pct = Math.round((spent / b.monthlyLimitCents) * 100);
      return { budget: b, spent, pct };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  return (
    <Layout>
      <div className="p-4 space-y-5 pb-6">
        <header className="pt-8 pb-2">
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
            Viniverse
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Your finances, under control.</p>
        </header>

        <MonthSelector currentDate={currentDate} onChange={setCurrentDate} />

        {/* Balance card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 rounded-3xl relative overflow-hidden"
          data-testid="card-total-balance"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="relative z-10">
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Balance</p>
            <div className="flex flex-col gap-1 mb-6">
              <h2 className="text-4xl font-bold tracking-tight">{formatMoney(totalUsdBalance, "USD")}</h2>
              {totalBrlBalance !== 0 && (
                <p className="text-sm text-muted-foreground font-medium">+ {formatMoney(totalBrlBalance, "BRL")}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                  <ArrowDownRight className="w-4 h-4" />
                  <span className="text-xs font-medium">Income</span>
                </div>
                <p className="text-lg font-semibold">{formatMoney(monthIncome, "USD")}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-rose-400 mb-1">
                  <ArrowUpRight className="w-4 h-4" />
                  <span className="text-xs font-medium">Expenses</span>
                </div>
                <p className="text-lg font-semibold">{formatMoney(monthExpense, "USD")}</p>
              </div>
            </div>

            {(monthIncome > 0 || monthExpense > 0) && (
              <div className="mt-5 space-y-2">
                <div className="flex gap-1.5 h-2 rounded-full overflow-hidden bg-white/5">
                  {monthIncome > 0 && (
                    <div
                      className="bg-emerald-500/70 rounded-full transition-all duration-700"
                      style={{ width: `${incomeBarPct}%` }}
                    />
                  )}
                  {monthExpense > 0 && (
                    <div
                      className="bg-rose-500/70 rounded-full transition-all duration-700"
                      style={{ width: `${expenseBarPct}%` }}
                    />
                  )}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{incomeBarPct}% income</span>
                  <span>{expenseBarPct}% expenses</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Budget Watch */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card p-5 rounded-2xl"
          data-testid="card-budget-watch"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Budget Watch
              </h3>
            </div>
            <Link href="/budgets" className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-0.5">
              All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {monthBudgets.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                No budgets for this month.{" "}
                <Link href="/budgets" className="text-primary hover:underline">
                  Create your first budget
                </Link>{" "}
                to track spending limits.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {monthBudgets.map(({ budget, spent, pct }, i) => {
                const status = getBudgetStatus(pct);
                return (
                  <motion.div
                    key={budget.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="space-y-1.5"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{budget.category}</span>
                        <span className={`text-[10px] font-semibold shrink-0 ${textColors[status.color]}`}>
                          {status.label}
                        </span>
                      </div>
                      <span className={`text-xs font-medium tabular-nums shrink-0 ${textColors[status.color]}`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColors[status.color]}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
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

        {/* Top Expenses */}
        {topCategories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-5 rounded-2xl"
            data-testid="card-top-categories"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Top Expenses</h3>
            </div>
            <div className="space-y-3">
              {topCategories.map(([category, amount], i) => {
                const pct = Math.round((amount / maxCategoryAmount) * 100);
                return (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="space-y-1"
                    data-testid={`category-bar-${i}`}
                  >
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-foreground font-medium">{category}</span>
                      <span className="text-rose-400 font-medium tabular-nums">
                        -{formatMoney(amount, "USD")}
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500/60 to-rose-400/80 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Recent Transactions */}
        <div>
          <h3 className="font-semibold text-lg mb-3">Recent Transactions</h3>
          <div className="space-y-2">
            {recentTransactions.length === 0 ? (
              <div className="text-center py-10 glass-card rounded-2xl">
                <p className="text-muted-foreground text-sm">No transactions this month.</p>
                <p className="text-xs text-muted-foreground mt-1">Tap + to add one.</p>
              </div>
            ) : (
              recentTransactions.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                >
                  <TransactionCard transaction={t} onClick={() => setSelectedTx(t)} />
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      <TransactionDrawer />
      <TransactionDetailDrawer
        transaction={selectedTx}
        accounts={accounts}
        onClose={() => setSelectedTx(null)}
      />
    </Layout>
  );
}
