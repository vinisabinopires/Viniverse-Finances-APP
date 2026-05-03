import { Transaction } from "@/types";
import { formatMoney, formatDate } from "@/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

interface TransactionCardProps {
  transaction: Transaction;
  onClick?: () => void;
}

export function TransactionCard({ transaction, onClick }: TransactionCardProps) {
  const isIncome = transaction.type === "INCOME";

  return (
    <motion.div
      whileTap={onClick ? { scale: 0.98 } : {}}
      onClick={onClick}
      className={`glass-card p-4 flex items-center gap-4 cursor-pointer transition-colors hover:bg-white/10 ${onClick ? 'active-elevate' : ''}`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
        {isIncome ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-foreground truncate">{transaction.description || transaction.category}</h4>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <span className="truncate">{transaction.category}</span>
          <span>•</span>
          <span>{formatDate(transaction.occurredAt)}</span>
        </div>
      </div>
      <div className="text-right whitespace-nowrap">
        <span className={`font-medium ${isIncome ? 'text-emerald-400' : 'text-foreground'}`}>
          {isIncome ? "+" : "-"}{formatMoney(transaction.amountCents, transaction.currencyCode)}
        </span>
      </div>
    </motion.div>
  );
}
