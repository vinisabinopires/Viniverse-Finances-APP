import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useLiveTransactions } from "@/hooks/use-finance";
import { TransactionCard } from "@/components/TransactionCard";
import { MonthSelector } from "@/components/MonthSelector";
import { motion, AnimatePresence } from "framer-motion";
import { TransactionDrawer } from "@/components/TransactionDrawer";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

type FilterType = "ALL" | "INCOME" | "EXPENSE";

export default function Transactions() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState<FilterType>("ALL");
  const [search, setSearch] = useState("");
  const transactions = useLiveTransactions();

  const currentMonthTransactions = transactions.filter((t) => {
    const tDate = new Date(t.occurredAt);
    return (
      tDate.getMonth() === currentDate.getMonth() &&
      tDate.getFullYear() === currentDate.getFullYear()
    );
  });

  const filteredTransactions = useMemo(() => {
    let list = currentMonthTransactions;
    if (filterType !== "ALL") {
      list = list.filter((t) => t.type === filterType);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.description?.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [currentMonthTransactions, filterType, search]);

  const hasActiveFilters = filterType !== "ALL" || search.trim() !== "";

  const clearFilters = () => {
    setFilterType("ALL");
    setSearch("");
  };

  return (
    <Layout>
      <div className="p-4 space-y-4 pt-12">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground text-sm mt-1">Review your income and expenses.</p>
        </header>

        <MonthSelector currentDate={currentDate} onChange={setCurrentDate} />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by description, category, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-transactions"
            className="bg-white/5 border-white/10 pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              data-testid="btn-clear-search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex flex-1 bg-white/5 p-1 rounded-xl border border-white/10">
            {(["ALL", "INCOME", "EXPENSE"] as FilterType[]).map((type) => (
              <button
                key={type}
                data-testid={`filter-${type.toLowerCase()}`}
                onClick={() => setFilterType(type)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterType === type
                    ? type === "INCOME"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : type === "EXPENSE"
                      ? "bg-rose-500/20 text-rose-400"
                      : "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {type === "ALL" ? "All" : type === "INCOME" ? "Income" : "Expense"}
              </button>
            ))}
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              data-testid="btn-clear-filters"
              className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>{filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="space-y-3 pb-8">
          <AnimatePresence mode="popLayout">
            {filteredTransactions.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-14 glass-card rounded-2xl"
              >
                <p className="text-muted-foreground text-sm">No transactions found.</p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </motion.div>
            ) : (
              filteredTransactions.map((t, i) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
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
