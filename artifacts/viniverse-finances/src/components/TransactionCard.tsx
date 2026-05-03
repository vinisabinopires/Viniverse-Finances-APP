import { Transaction } from "@/types";
import { formatMoney, formatDate } from "@/utils";
import { ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

interface TransactionCardProps {
  transaction: Transaction;
  onClick?: () => void;
}

export function TransactionCard({ transaction, onClick }: TransactionCardProps) {
  const isIncome = transaction.type === "INCOME";
  const isRecurring = !!transaction.recurringRuleId;

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      data-testid={`card-transaction-${transaction.id}`}
      className="glass-card p-4 flex items-center gap-4 cursor-pointer transition-colors hover:bg-white/10 active:bg-white/15 rounded-2xl"
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isIncome ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
        {isIncome ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-foreground truncate">
          {transaction.description || transaction.category}
        </h4>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
          <span className="truncate">{transaction.category}</span>
          <span>·</span>
          <span className="whitespace-nowrap">{formatDate(transaction.occurredAt)}</span>
          {isRecurring && (
            <>
              <span>·</span>
              <span className="flex items-center gap-0.5 text-indigo-400/80 whitespace-nowrap">
                <RefreshCw className="w-2.5 h-2.5" /> Recurring
              </span>
            </>
          )}
        </div>
      </div>
      <div className="text-right whitespace-nowrap">
        <span className={`font-semibold ${isIncome ? "text-emerald-400" : "text-rose-400"}`}>
          {isIncome ? "+" : "-"}{formatMoney(transaction.amountCents, transaction.currencyCode)}
        </span>
      </div>
    </motion.div>
  );
}
