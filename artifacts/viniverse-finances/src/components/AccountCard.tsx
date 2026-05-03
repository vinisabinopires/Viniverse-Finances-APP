import { Account } from "@/types";
import { formatMoney } from "@/utils";
import { motion } from "framer-motion";
import { Landmark, Wallet, TrendingUp, CreditCard, Coins } from "lucide-react";

interface AccountCardProps {
  account: Account;
  balanceCents: number;
  onClick?: () => void;
}

const typeIcons = {
  CHECKING: Landmark,
  SAVINGS: Wallet,
  INVESTMENT: TrendingUp,
  CREDIT_CARD: CreditCard,
  CASH: Coins,
};

export function AccountCard({ account, balanceCents, onClick }: AccountCardProps) {
  const Icon = typeIcons[account.type] || Wallet;

  return (
    <motion.div
      whileTap={onClick ? { scale: 0.98 } : {}}
      onClick={onClick}
      className={`glass-card p-5 relative overflow-hidden cursor-pointer transition-colors hover:bg-white/10 ${onClick ? 'active-elevate' : ''}`}
    >
      {/* Decorative gradient blob */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{account.name}</h3>
            <p className="text-xs text-muted-foreground">{account.type.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
      
      <div className="relative z-10">
        <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
        <p className="text-2xl font-bold tracking-tight">
          {formatMoney(balanceCents, account.currencyCode)}
        </p>
      </div>
    </motion.div>
  );
}
