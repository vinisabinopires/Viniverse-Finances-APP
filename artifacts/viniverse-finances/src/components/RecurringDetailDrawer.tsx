import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RecurringForm } from "@/components/RecurringForm";
import { deleteRecurringRule, updateRecurringRule, useLiveAccounts, getNextOccurrenceAfter } from "@/hooks/use-finance";
import { formatMoney, formatDate, formatFrequency } from "@/utils";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";
import type { RecurringRule } from "@/types";

interface RecurringDetailDrawerProps {
  rule: RecurringRule | null;
  onClose: () => void;
}

export function RecurringDetailDrawer({ rule, onClose }: RecurringDetailDrawerProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [showDelete, setShowDelete] = useState(false);
  const { toast } = useToast();
  const accounts = useLiveAccounts();

  const account = accounts.find((a) => a.id === rule?.accountId);
  const isIncome = rule?.type === "INCOME";

  const nextDue = rule ? getNextOccurrenceAfter(rule, new Date()) : null;

  const handleClose = () => {
    setMode("view");
    setShowDelete(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!rule) return;
    await deleteRecurringRule(rule.id);
    toast({ title: "Recurring rule deleted" });
    handleClose();
  };

  const handleToggleActive = async () => {
    if (!rule) return;
    await updateRecurringRule(rule.id, { isActive: !rule.isActive });
    toast({ title: rule.isActive ? "Rule paused" : "Rule activated" });
  };

  return (
    <>
      <Drawer open={!!rule} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DrawerContent className="bg-background border-t border-white/10 text-foreground flex flex-col max-h-[92dvh]">
          {mode === "edit" && rule ? (
            <>
              <DrawerHeader className="px-4 pt-2 pb-2 flex-shrink-0">
                <DrawerTitle>Edit Rule</DrawerTitle>
              </DrawerHeader>
              <div
                className="flex-1 overflow-y-auto px-4"
                style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}
              >
                <RecurringForm
                  editRule={rule}
                  onSuccess={() => { toast({ title: "Rule updated" }); setMode("view"); }}
                  onCancel={() => setMode("view")}
                />
              </div>
            </>
          ) : rule ? (
            <>
              <DrawerHeader className="px-4 pb-4 flex-shrink-0">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${isIncome ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
                    {isIncome ? <ArrowDownRight className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <DrawerTitle className="text-xl leading-tight">{rule.name}</DrawerTitle>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${rule.isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" : "bg-white/5 text-muted-foreground border-white/10"}`}>
                        {rule.isActive ? "Active" : "Inactive"}
                      </span>
                      <span className="text-xs text-muted-foreground bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                        {formatFrequency(rule.frequency)}
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
                    <p className="text-xs text-muted-foreground mb-1">Amount</p>
                    <p className={`text-xl font-bold ${isIncome ? "text-emerald-400" : "text-rose-400"}`}>
                      {isIncome ? "+" : "-"}{formatMoney(rule.amountCents, rule.currencyCode)}
                    </p>
                  </div>
                  <div className="glass-card p-4 rounded-2xl">
                    <p className="text-xs text-muted-foreground mb-1">Next Due</p>
                    <p className="text-sm font-semibold">
                      {nextDue ? formatDate(nextDue.toISOString()) : rule.endDate ? "Ended" : "—"}
                    </p>
                  </div>
                </div>

                <div className="space-y-0 mb-5">
                  <DetailRow label="Category" value={rule.category} />
                  <DetailRow label="Account" value={account ? `${account.name} · ${rule.currencyCode}` : rule.currencyCode} />
                  <DetailRow label="Starts" value={formatDate(rule.startDate)} />
                  {rule.endDate && <DetailRow label="Ends" value={formatDate(rule.endDate)} />}
                  {rule.description && <DetailRow label="Description" value={rule.description} />}
                  {rule.notes && <DetailRow label="Notes" value={rule.notes} />}
                </div>

                <div className="text-xs text-muted-foreground space-y-0.5 mb-5 px-1">
                  <p>Created {formatDate(rule.createdAt)}</p>
                </div>

                <div className="space-y-3 pb-4">
                  <button
                    onClick={handleToggleActive}
                    className={`w-full py-3 rounded-xl text-sm font-medium border transition-colors ${rule.isActive ? "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10" : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20"}`}
                    data-testid="btn-toggle-active"
                  >
                    <RefreshCw className="w-4 h-4 inline mr-2" />
                    {rule.isActive ? "Pause Rule" : "Activate Rule"}
                  </button>

                  <div className="flex gap-3">
                    <Button onClick={() => setMode("edit")} variant="outline" className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-foreground rounded-xl" data-testid="btn-edit-rule">
                      <Pencil className="w-4 h-4 mr-2" /> Edit
                    </Button>
                    <Button onClick={() => setShowDelete(true)} variant="outline" className="flex-1 border-rose-500/30 bg-rose-500/5 text-rose-400 hover:bg-rose-500/15 rounded-xl" data-testid="btn-delete-rule">
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent className="bg-background border-white/10 max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{rule?.name}"?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              The rule will be removed. Already-generated transactions will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-500 text-white hover:bg-rose-600" data-testid="btn-confirm-delete-rule">
              Delete Rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-xl hover:bg-white/5 transition-colors">
      <p className="text-xs text-muted-foreground w-20 flex-shrink-0 mt-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground leading-snug">{value}</p>
    </div>
  );
}
