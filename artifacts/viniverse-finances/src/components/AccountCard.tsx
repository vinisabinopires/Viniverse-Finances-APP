import { Account } from "@/types";
import { formatMoney } from "@/utils";
import { motion } from "framer-motion";
import { Landmark, Wallet, TrendingUp, CreditCard, Coins, ChevronRight } from "lucide-react";

interface AccountCardProps {
  account: Account;
  balanceCents: number;
  txCount?: number;
  onClick?: () => void;
}

const typeIcons = {
  CHECKING: Landmark,
  SAVINGS: Wallet,
  INVESTMENT: TrendingUp,
  CREDIT_CARD: CreditCard,
  CASH: Coins,
};

const typeLabels: Record<Account["type"], string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
  INVESTMENT: "Investment",
  CREDIT_CARD: "Credit Card",
  CASH: "Cash",
};

export function AccountCard({ account, balanceCents, txCount, onClick }: AccountCardProps) {
  const Icon = typeIcons[account.type] || Wallet;

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      data-testid={`card-account-${account.id}`}
      className="glass-card p-5 relative overflow-hidden rounded-2xl cursor-pointer hover:bg-white/10 active:bg-white/15 transition-colors"
    >
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{account.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-muted-foreground">{typeLabels[account.type]}</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-xs font-medium text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded-full border border-white/10">
                {account.currencyCode}
              </span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/50 mt-1 relative z-10" />
      </div>

      <div className="relative z-10">
        <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
        <p className="text-2xl font-bold tracking-tight">
          {formatMoney(balanceCents, account.currencyCode)}
        </p>
        {txCount !== undefined && (
          <p className="text-xs text-muted-foreground mt-1">
            {txCount} transaction{txCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </motion.div>
  );
}
