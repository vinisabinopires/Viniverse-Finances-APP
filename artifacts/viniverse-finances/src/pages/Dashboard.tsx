import { useState } from "react";
import { Layout } from "@/components/Layout";
import { TransactionDrawer } from "@/components/TransactionDrawer";
import { MonthSelector } from "@/components/MonthSelector";
import { TransactionCard } from "@/components/TransactionCard";
import { useLiveAccounts, useLiveTransactions } from "@/hooks/use-finance";
import { formatMoney } from "@/utils";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Empty } from "@/components/ui/empty";

export default function Dashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const accounts = useLiveAccounts();
  const transactions = useLiveTransactions();

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

  // Simplified total balance: just sum USD for now (as MVP)
  // BRL should ideally be converted or shown separately.
  const totalUsdBalance = accounts
    .filter((a) => a.currencyCode === "USD")
    .reduce((acc, account) => {
      const accTransactions = transactions.filter((t) => t.accountId === account.id);
      const accIncome = accTransactions.filter((t) => t.type === "INCOME").reduce((sum, t) => sum + t.amountCents, 0);
      const accExpense = accTransactions.filter((t) => t.type === "EXPENSE").reduce((sum, t) => sum + t.amountCents, 0);
      return acc + account.initialBalanceCents + accIncome - accExpense;
    }, 0);

  const totalBrlBalance = accounts
    .filter((a) => a.currencyCode === "BRL")
    .reduce((acc, account) => {
      const accTransactions = transactions.filter((t) => t.accountId === account.id);
      const accIncome = accTransactions.filter((t) => t.type === "INCOME").reduce((sum, t) => sum + t.amountCents, 0);
      const accExpense = accTransactions.filter((t) => t.type === "EXPENSE").reduce((sum, t) => sum + t.amountCents, 0);
      return acc + account.initialBalanceCents + accIncome - accExpense;
    }, 0);

  return (
    <Layout>
      <div className="p-4 space-y-6">
        <header className="pt-8 pb-4">
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
            Viniverse
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Your finances, under control.</p>
        </header>

        <MonthSelector currentDate={currentDate} onChange={setCurrentDate} />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 rounded-3xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="relative z-10">
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Balance</p>
            <div className="flex flex-col gap-1">
              <h2 className="text-4xl font-bold tracking-tight">
                {formatMoney(totalUsdBalance, "USD")}
              </h2>
              {totalBrlBalance > 0 && (
                <p className="text-sm text-muted-foreground font-medium">
                  + {formatMoney(totalBrlBalance, "BRL")}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8">
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
          </div>
        </motion.div>

        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg">Recent Transactions</h3>
          </div>
          
          <div className="space-y-3">
            {currentMonthTransactions.length === 0 ? (
              <div className="text-center py-10 glass-card">
                <p className="text-muted-foreground text-sm">No transactions this month.</p>
              </div>
            ) : (
              currentMonthTransactions.slice(0, 5).map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <TransactionCard transaction={t} />
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
      <TransactionDrawer />
    </Layout>
  );
}
