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
import { TransactionForm } from "@/components/TransactionForm";
import { deleteTransaction } from "@/hooks/use-finance";
import { formatMoney, formatDate } from "@/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowDownRight, ArrowUpRight, Pencil, Trash2, Calendar, Tag, Building2, FileText, StickyNote } from "lucide-react";
import type { Transaction, Account } from "@/types";

interface TransactionDetailDrawerProps {
  transaction: Transaction | null;
  accounts: Account[];
  onClose: () => void;
}

const typeLabels: Record<Account["type"], string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
  INVESTMENT: "Investment",
  CREDIT_CARD: "Credit Card",
  CASH: "Cash",
};

export function TransactionDetailDrawer({ transaction, accounts, onClose }: TransactionDetailDrawerProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [showDelete, setShowDelete] = useState(false);
  const { toast } = useToast();

  const account = accounts.find((a) => a.id === transaction?.accountId);
  const isIncome = transaction?.type === "INCOME";

  const handleClose = () => {
    setMode("view");
    setShowDelete(false);
    onClose();
  };

  const handleEditSuccess = () => {
    toast({ title: "Transaction updated" });
    setMode("view");
  };

  const handleDelete = async () => {
    if (!transaction) return;
    await deleteTransaction(transaction.id);
    setShowDelete(false);
    toast({ title: "Transaction deleted" });
    handleClose();
  };

  return (
    <>
      <Drawer
        open={!!transaction}
        onOpenChange={(open) => { if (!open) handleClose(); }}
      >
        <DrawerContent className="bg-background border-t border-white/10 text-foreground flex flex-col max-h-[92dvh]">
          {mode === "edit" && transaction ? (
            <>
              <DrawerHeader className="px-4 pt-2 pb-2 flex-shrink-0">
                <DrawerTitle>Edit Transaction</DrawerTitle>
              </DrawerHeader>
              <div
                className="flex-1 overflow-y-auto px-4"
                style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}
              >
                <TransactionForm
                  editTransaction={transaction}
                  onSuccess={handleEditSuccess}
                  onCancel={() => setMode("view")}
                />
              </div>
            </>
          ) : transaction ? (
            <>
              <DrawerHeader className="px-4 pb-4 flex-shrink-0">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${isIncome ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
                    {isIncome ? <ArrowDownRight className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <DrawerTitle className="text-xl leading-tight">
                      {transaction.description || transaction.category}
                    </DrawerTitle>
                    <p className={`text-2xl font-bold mt-1 ${isIncome ? "text-emerald-400" : "text-rose-400"}`}>
                      {isIncome ? "+" : "-"}{formatMoney(transaction.amountCents, transaction.currencyCode)}
                    </p>
                  </div>
                </div>
              </DrawerHeader>

              <div
                className="flex-1 overflow-y-auto px-4"
                style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 1.5rem))" }}
              >
                <div className="space-y-1 mb-6">
                  <DetailRow icon={<Tag className="w-4 h-4" />} label="Category" value={transaction.category} />
                  <DetailRow
                    icon={<Building2 className="w-4 h-4" />}
                    label="Account"
                    value={account ? `${account.name} · ${typeLabels[account.type] ?? account.type}` : transaction.accountId}
                  />
                  <DetailRow icon={<Calendar className="w-4 h-4" />} label="Date" value={formatDate(transaction.occurredAt)} />
                  {transaction.description && (
                    <DetailRow icon={<FileText className="w-4 h-4" />} label="Description" value={transaction.description} />
                  )}
                  {transaction.notes && (
                    <DetailRow icon={<StickyNote className="w-4 h-4" />} label="Notes" value={transaction.notes} />
                  )}
                </div>

                <div className="text-xs text-muted-foreground space-y-0.5 mb-6 px-1">
                  <p>Created {formatDate(transaction.createdAt)}</p>
                  {transaction.updatedAt !== transaction.createdAt && (
                    <p>Updated {formatDate(transaction.updatedAt)}</p>
                  )}
                </div>

                <div className="flex gap-3 pb-4">
                  <Button
                    onClick={() => setMode("edit")}
                    className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-foreground rounded-xl"
                    variant="outline"
                    data-testid="btn-edit-transaction"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => setShowDelete(true)}
                    variant="outline"
                    className="flex-1 border-rose-500/30 bg-rose-500/5 text-rose-400 hover:bg-rose-500/15 hover:border-rose-500/50 rounded-xl"
                    data-testid="btn-delete-transaction"
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
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-foreground" data-testid="btn-cancel-delete-tx">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-500 text-white hover:bg-rose-600" data-testid="btn-confirm-delete-tx">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-xl hover:bg-white/5 transition-colors">
      <span className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground leading-snug">{value}</p>
      </div>
    </div>
  );
}
