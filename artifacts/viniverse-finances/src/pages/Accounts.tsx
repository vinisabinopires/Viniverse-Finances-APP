import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useLiveAccounts, useLiveTransactions, deleteAccount } from "@/hooks/use-finance";
import { AccountCard } from "@/components/AccountCard";
import { AccountDrawer } from "@/components/AccountDrawer";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { Account } from "@/types";

export default function Accounts() {
  const accounts = useLiveAccounts();
  const transactions = useLiveTransactions();
  const { toast } = useToast();
  const [deleteCandidate, setDeleteCandidate] = useState<Account | null>(null);

  const getAccountBalance = (accountId: string, initialBalanceCents: number) => {
    const accTx = transactions.filter((t) => t.accountId === accountId);
    const income = accTx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amountCents, 0);
    const expense = accTx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amountCents, 0);
    return initialBalanceCents + income - expense;
  };

  const getAccountTxCount = (accountId: string) =>
    transactions.filter((t) => t.accountId === accountId).length;

  const handleDeleteRequest = (account: Account) => {
    setDeleteCandidate(account);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    await deleteAccount(deleteCandidate.id);
    setDeleteCandidate(null);
    toast({ title: "Account deleted", description: `${deleteCandidate.name} has been removed.` });
  };

  const candidateTxCount = deleteCandidate ? getAccountTxCount(deleteCandidate.id) : 0;

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

        <div className="space-y-4">
          <AnimatePresence>
            {accounts.map((account, i) => {
              const balanceCents = getAccountBalance(account.id, account.initialBalanceCents);
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
                    onDelete={() => handleDeleteRequest(account)}
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

      <AlertDialog open={!!deleteCandidate} onOpenChange={(open) => { if (!open) setDeleteCandidate(null); }}>
        <AlertDialogContent className="bg-background border-white/10 max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteCandidate?.name}"?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {candidateTxCount > 0
                ? `This account has ${candidateTxCount} transaction${candidateTxCount !== 1 ? "s" : ""}. Deleting it will not remove those transactions, but they will no longer be linked to a valid account.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-white/5 border-white/10 hover:bg-white/10 text-foreground"
              data-testid="btn-cancel-delete-account"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-rose-500 text-white hover:bg-rose-600"
              data-testid="btn-confirm-delete-account"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
