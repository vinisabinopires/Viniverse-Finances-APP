import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useLiveTransactions } from "@/hooks/use-finance";
import { TransactionCard } from "@/components/TransactionCard";
import { MonthSelector } from "@/components/MonthSelector";
import { motion, AnimatePresence } from "framer-motion";
import { TransactionDrawer } from "@/components/TransactionDrawer";
import { Button } from "@/components/ui/button";

type FilterType = "ALL" | "INCOME" | "EXPENSE";

export default function Transactions() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState<FilterType>("ALL");
  const transactions = useLiveTransactions();

  const currentMonthTransactions = transactions.filter((t) => {
    const tDate = new Date(t.occurredAt);
    return (
      tDate.getMonth() === currentDate.getMonth() &&
      tDate.getFullYear() === currentDate.getFullYear()
    );
  });

  const filteredTransactions = currentMonthTransactions.filter((t) => {
    if (filterType === "ALL") return true;
    return t.type === filterType;
  });

  return (
    <Layout>
      <div className="p-4 space-y-6 pt-12">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground text-sm mt-1">Review your income and expenses.</p>
        </header>

        <MonthSelector currentDate={currentDate} onChange={setCurrentDate} />

        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
          <Button
            variant="ghost"
            className={`flex-1 rounded-lg ${filterType === "ALL" ? "bg-white/10" : ""}`}
            onClick={() => setFilterType("ALL")}
          >
            All
          </Button>
          <Button
            variant="ghost"
            className={`flex-1 rounded-lg ${filterType === "INCOME" ? "bg-emerald-500/20 text-emerald-400" : ""}`}
            onClick={() => setFilterType("INCOME")}
          >
            Income
          </Button>
          <Button
            variant="ghost"
            className={`flex-1 rounded-lg ${filterType === "EXPENSE" ? "bg-rose-500/20 text-rose-400" : ""}`}
            onClick={() => setFilterType("EXPENSE")}
          >
            Expense
          </Button>
        </div>

        <div className="space-y-3 pb-8">
          <AnimatePresence mode="popLayout">
            {filteredTransactions.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-12 glass-card rounded-2xl"
              >
                <p className="text-muted-foreground text-sm">No transactions found.</p>
              </motion.div>
            ) : (
              filteredTransactions.map((t, i) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <TransactionCard transaction={t} />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
      <TransactionDrawer />
    </Layout>
  );
}
