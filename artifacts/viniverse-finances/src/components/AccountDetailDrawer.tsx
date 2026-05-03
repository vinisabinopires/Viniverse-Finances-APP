import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
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
import { AccountForm } from "@/components/AccountForm";
import { deleteAccount } from "@/hooks/use-finance";
import { formatMoney, formatDate } from "@/utils";
import { useToast } from "@/hooks/use-toast";
import { Landmark, Wallet, TrendingUp, CreditCard, Coins, Pencil, Trash2, ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { Account, Transaction } from "@/types";

interface AccountDetailDrawerProps {
  account: Account | null;
  balanceCents: number;
  transactions: Transaction[];
  onClose: () => void;
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

export function AccountDetailDrawer({ account, balanceCents, transactions, onClose }: AccountDetailDrawerProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [showDelete, setShowDelete] = useState(false);
  const { toast } = useToast();

  const accountTransactions = account
    ? transactions.filter((t) => t.accountId === account.id)
    : [];
  const recentTx = accountTransactions.slice(0, 4);
  const Icon = account ? typeIcons[account.type] || Wallet : Wallet;

  const handleClose = () => {
    setMode("view");
    setShowDelete(false);
    onClose();
  };

  const handleEditSuccess = () => {
    toast({ title: "Account updated" });
    setMode("view");
  };

  const handleDelete = async () => {
    if (!account) return;
    await deleteAccount(account.id);
    setShowDelete(false);
    toast({ title: "Account deleted", description: `${account.name} removed.` });
    handleClose();
  };

  return (
    <>
      <Drawer
        open={!!account}
        onOpenChange={(open) => { if (!open) handleClose(); }}
      >
        <DrawerContent className="bg-background border-t border-white/10 text-foreground flex flex-col max-h-[92dvh]">
          {mode === "edit" && account ? (
            <>
              <DrawerHeader className="px-4 pt-2 pb-2 flex-shrink-0">
                <DrawerTitle>Edit Account</DrawerTitle>
              </DrawerHeader>
              <div
                className="flex-1 overflow-y-auto px-4"
                style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}
              >
                <AccountForm
                  editAccount={account}
                  onSuccess={handleEditSuccess}
                  onCancel={() => setMode("view")}
                />
              </div>
            </>
          ) : account ? (
            <>
              <DrawerHeader className="px-4 pb-4 flex-shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <DrawerTitle className="text-xl">{account.name}</DrawerTitle>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm text-muted-foreground">{typeLabels[account.type]}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-xs font-medium bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-muted-foreground">
                        {account.currencyCode}
                      </span>
                    </div>
                  </div>
                </div>
              </DrawerHeader>

              <div
                className="flex-1 overflow-y-auto px-4"
                style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 1.5rem))" }}
              >
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="glass-card p-4 rounded-2xl">
                    <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
                    <p className="text-xl font-bold">{formatMoney(balanceCents, account.currencyCode)}</p>
                  </div>
                  <div className="glass-card p-4 rounded-2xl">
                    <p className="text-xs text-muted-foreground mb-1">Initial Balance</p>
                    <p className="text-xl font-bold">{formatMoney(account.initialBalanceCents, account.currencyCode)}</p>
                  </div>
                  <div className="glass-card p-4 rounded-2xl col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Transactions</p>
                    <p className="text-xl font-bold">{accountTransactions.length}</p>
                  </div>
                </div>

                {recentTx.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
                      Recent Activity
                    </p>
                    <div className="space-y-1">
                      {recentTx.map((t) => {
                        const isIncome = t.type === "INCOME";
                        return (
                          <div key={t.id} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-white/5 transition-colors">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isIncome ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                              {isIncome ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{t.description || t.category}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(t.occurredAt)}</p>
                            </div>
                            <span className={`text-sm font-medium whitespace-nowrap ${isIncome ? "text-emerald-400" : "text-rose-400"}`}>
                              {isIncome ? "+" : "-"}{formatMoney(t.amountCents, t.currencyCode)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground space-y-0.5 mb-5 px-1">
                  <p>Created {formatDate(account.createdAt)}</p>
                  {account.updatedAt !== account.createdAt && (
                    <p>Updated {formatDate(account.updatedAt)}</p>
                  )}
                </div>

                <div className="flex gap-3 pb-4">
                  <Button
                    onClick={() => setMode("edit")}
                    className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-foreground rounded-xl"
                    variant="outline"
                    data-testid="btn-edit-account"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => setShowDelete(true)}
                    variant="outline"
                    className="flex-1 border-rose-500/30 bg-rose-500/5 text-rose-400 hover:bg-rose-500/15 hover:border-rose-500/50 rounded-xl"
                    data-testid="btn-delete-account"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent className="bg-background border-white/10 max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{account?.name}"?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {accountTransactions.length > 0
                ? `This account has ${accountTransactions.length} transaction${accountTransactions.length !== 1 ? "s" : ""}. They will remain but will no longer link to a valid account.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-foreground" data-testid="btn-cancel-delete-account">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-500 text-white hover:bg-rose-600" data-testid="btn-confirm-delete-account">
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
