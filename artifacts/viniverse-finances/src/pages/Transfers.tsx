import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useLiveTransfers, useLiveAccounts, deleteTransfer } from "@/hooks/use-finance";
import { TransferForm } from "@/components/TransferForm";
import { MonthSelector } from "@/components/MonthSelector";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeftRight, ArrowRight, Plus, Trash2, Pencil } from "lucide-react";
import { formatMoney, formatDate } from "@/utils";
import { useToast } from "@/hooks/use-toast";
import type { Transfer } from "@/types";

function TransferCard({
  transfer,
  fromName,
  toName,
  onClick,
  onDelete,
}: {
  transfer: Transfer;
  fromName: string;
  toName: string;
  onClick: () => void;
  onDelete: () => void;
}) {
  const isCross = transfer.fromCurrencyCode !== transfer.toCurrencyCode;

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button
        onClick={onClick}
        className="w-full p-4 flex items-start gap-3 text-left hover:bg-white/5 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold truncate max-w-[110px]">{fromName}</span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-semibold truncate max-w-[110px]">{toName}</span>
          </div>

          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-sm font-bold text-indigo-400 tabular-nums">
              {formatMoney(transfer.fromAmountCents, transfer.fromCurrencyCode)}
            </span>
            {isCross && (
              <>
                <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
                <span className="text-sm font-bold text-indigo-300 tabular-nums">
                  {formatMoney(transfer.toAmountCents, transfer.toCurrencyCode)}
                </span>
                {transfer.exchangeRate && (
                  <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded-full">
                    @ {transfer.exchangeRate}
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground">{formatDate(transfer.date)}</span>
            {transfer.description && (
              <>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="text-xs text-muted-foreground truncate max-w-[140px]">{transfer.description}</span>
              </>
            )}
            {transfer.feeAmountCents && (
              <>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="text-xs text-amber-400/70">
                  fee {formatMoney(transfer.feeAmountCents, transfer.feeCurrencyCode ?? transfer.fromCurrencyCode)}
                </span>
              </>
            )}
          </div>
        </div>
      </button>

      <div className="border-t border-white/5 flex">
        <button
          onClick={onClick}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
        <div className="w-px bg-white/5" />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/5 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}

export default function Transfers() {
  const [currentDate,   setCurrentDate]   = useState(new Date());
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [editTransfer,  setEditTransfer]  = useState<Transfer | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<Transfer | null>(null);

  const transfers = useLiveTransfers();
  const accounts  = useLiveAccounts();
  const { toast } = useToast();

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "Deleted account";

  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

  const monthTransfers = useMemo(
    () => transfers.filter((t) => t.date.startsWith(currentMonth)),
    [transfers, currentMonth],
  );

  const openAdd = () => {
    setEditTransfer(null);
    setDrawerOpen(true);
  };

  const openEdit = (t: Transfer) => {
    setEditTransfer(t);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditTransfer(null);
  };

  const handleSuccess = () => {
    closeDrawer();
    toast({ title: editTransfer ? "Transfer updated" : "Transfer saved" });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteTransfer(deleteTarget.id);
    setDeleteTarget(null);
    toast({ title: "Transfer deleted" });
  };

  // Summary for current month
  const summaryByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of monthTransfers) {
      map[t.fromCurrencyCode] = (map[t.fromCurrencyCode] ?? 0) + t.fromAmountCents;
    }
    return map;
  }, [monthTransfers]);

  return (
    <Layout>
      <div className="p-4 space-y-4 pt-12 pb-8">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transfers</h1>
            <p className="text-muted-foreground text-sm mt-1">Move money between accounts.</p>
          </div>
          <Button
            onClick={openAdd}
            className="rounded-xl gap-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/25"
            variant="outline"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </header>

        <MonthSelector currentDate={currentDate} onChange={setCurrentDate} />

        {/* Month summary */}
        {monthTransfers.length > 0 && (
          <div className="glass-card rounded-2xl p-3 flex gap-4 flex-wrap">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Transfers</p>
              <p className="text-sm font-bold">{monthTransfers.length}</p>
            </div>
            {Object.entries(summaryByCurrency).map(([ccy, cents]) => (
              <div key={ccy}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Moved ({ccy})</p>
                <p className="text-sm font-bold text-indigo-400 tabular-nums">{formatMoney(cents, ccy as "USD" | "BRL")}</p>
              </div>
            ))}
            <div className="ml-auto self-center">
              <p className="text-[10px] text-muted-foreground leading-relaxed">Not counted as income or expense</p>
            </div>
          </div>
        )}

        {/* Transfer list */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {monthTransfers.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass-card rounded-2xl py-14 text-center"
              >
                <ArrowLeftRight className="w-8 h-8 text-indigo-400/40 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No transfers this month.</p>
                <p className="text-xs text-muted-foreground/60 mt-1 max-w-[240px] mx-auto leading-relaxed">
                  Use transfers when moving money between your own accounts — like cash to checking or USD to BRL investments.
                </p>
                <Button onClick={openAdd} className="mt-5 rounded-xl gap-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/25" variant="outline">
                  <Plus className="w-4 h-4" /> Add Transfer
                </Button>
              </motion.div>
            ) : (
              monthTransfers.map((t, i) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                >
                  <TransferCard
                    transfer={t}
                    fromName={accountName(t.fromAccountId)}
                    toName={accountName(t.toAccountId)}
                    onClick={() => openEdit(t)}
                    onDelete={() => setDeleteTarget(t)}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Add / Edit drawer */}
      <Drawer open={drawerOpen} onOpenChange={(o) => { if (!o) closeDrawer(); }}>
        <DrawerContent className="bg-background border-t border-white/10 text-foreground flex flex-col max-h-[92dvh]">
          <DrawerHeader className="px-4 pt-2 pb-2 flex-shrink-0">
            <DrawerTitle>{editTransfer ? "Edit Transfer" : "New Transfer"}</DrawerTitle>
          </DrawerHeader>
          <div
            className="flex-1 overflow-y-auto px-4"
            style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}
          >
            {drawerOpen && (
              <TransferForm
                editTransfer={editTransfer ?? undefined}
                onSuccess={handleSuccess}
                onCancel={closeDrawer}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-background border-white/10 max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transfer?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will reverse its effect on account balances. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-500 text-white hover:bg-rose-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
