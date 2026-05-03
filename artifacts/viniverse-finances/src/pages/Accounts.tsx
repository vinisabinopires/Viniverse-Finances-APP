import { Layout } from "@/components/Layout";
import { useLiveAccounts, useLiveTransactions } from "@/hooks/use-finance";
import { AccountCard } from "@/components/AccountCard";
import { AccountDrawer } from "@/components/AccountDrawer";
import { motion } from "framer-motion";

export default function Accounts() {
  const accounts = useLiveAccounts();
  const transactions = useLiveTransactions();

  return (
    <Layout>
      <div className="p-4 space-y-6 pt-12">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your wallets and cards.</p>
        </header>

        <div className="space-y-4">
          {accounts.map((account, i) => {
            const accTransactions = transactions.filter((t) => t.accountId === account.id);
            const accIncome = accTransactions.filter((t) => t.type === "INCOME").reduce((sum, t) => sum + t.amountCents, 0);
            const accExpense = accTransactions.filter((t) => t.type === "EXPENSE").reduce((sum, t) => sum + t.amountCents, 0);
            const balanceCents = account.initialBalanceCents + accIncome - accExpense;

            return (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <AccountCard account={account} balanceCents={balanceCents} />
              </motion.div>
            );
          })}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: accounts.length * 0.1 }}
            className="pt-2"
          >
            <AccountDrawer />
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
