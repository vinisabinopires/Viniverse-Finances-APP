import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useLiveAccounts, useLiveTransactions, useLiveTransfers, calcAccountBalance } from "@/hooks/use-finance";
import { AccountCard } from "@/components/AccountCard";
import { AccountDrawer } from "@/components/AccountDrawer";
import { AccountDetailDrawer } from "@/components/AccountDetailDrawer";
import { motion, AnimatePresence } from "framer-motion";
import type { Account } from "@/types";

export default function Accounts() {
  const accounts     = useLiveAccounts();
  const transactions = useLiveTransactions();
  const transfers    = useLiveTransfers();
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const getAccountTxCount = (accountId: string) =>
    transactions.filter((t) => t.accountId === accountId).length;

  const selectedBalance = selectedAccount
    ? calcAccountBalance(selectedAccount, transactions, transfers)
    : 0;

  return (
    <Layout>
      <div className="p-4 space-y-4 pt-12">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your wallets and cards.</p>
        </header>

        {accounts.length === 0 && (
          <div className="text-center py-14 glass-card rounded-2xl">
            <p className="text-muted-foreground text-sm">No accounts yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Add your first account below.</p>
          </div>
        )}

        <div className="space-y-3">
          <AnimatePresence>
            {accounts.map((account, i) => {
              const balanceCents = calcAccountBalance(account, transactions, transfers);
              return (
                <motion.div
                  key={account.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.07 }}
                >
                  <AccountCard
                    account={account}
                    balanceCents={balanceCents}
                    txCount={getAccountTxCount(account.id)}
                    onClick={() => setSelectedAccount(account)}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: accounts.length * 0.07 }}
            className="pt-1"
          >
            <AccountDrawer />
          </motion.div>
        </div>
      </div>

      <AccountDetailDrawer
        account={selectedAccount}
        balanceCents={selectedBalance}
        transactions={transactions}
        onClose={() => setSelectedAccount(null)}
      />
    </Layout>
  );
}
