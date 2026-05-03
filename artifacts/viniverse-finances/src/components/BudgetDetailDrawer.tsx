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
import { BudgetForm } from "@/components/BudgetForm";
import { deleteBudget } from "@/hooks/use-finance";
import { formatMoney } from "@/utils";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, StickyNote } from "lucide-react";
import type { Budget } from "@/types";

interface BudgetDetailDrawerProps {
  budget: Budget | null;
  spentCents: number;
  onClose: () => void;
}

function getBudgetStatus(pct: number) {
  if (pct >= 100) return { label: "Over Budget", color: "rose" } as const;
  if (pct >= 70) return { label: "Caution", color: "amber" } as const;
  return { label: "Safe", color: "emerald" } as const;
}

const barColors = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

const textColors = {
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
};

const badgeColors = {
  emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  rose: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

export function BudgetDetailDrawer({ budget, spentCents, onClose }: BudgetDetailDrawerProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [showDelete, setShowDelete] = useState(false);
  const { toast } = useToast();

  const handleClose = () => {
    setMode("view");
    setShowDelete(false);
    onClose();
  };

  const handleEditSuccess = () => {
    toast({ title: "Budget updated" });
    setMode("view");
  };

  const handleDelete = async () => {
    if (!budget) return;
    await deleteBudget(budget.id);
    setShowDelete(false);
    toast({ title: "Budget deleted" });
    handleClose();
  };

  const pct = budget ? Math.round((spentCents / budget.monthlyLimitCents) * 100) : 0;
  const status = getBudgetStatus(pct);
  const remainingCents = budget ? budget.monthlyLimitCents - spentCents : 0;

  return (
    <>
      <Drawer open={!!budget} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DrawerContent className="bg-background border-t border-white/10 text-foreground flex flex-col max-h-[92dvh]">
          {mode === "edit" && budget ? (
            <>
              <DrawerHeader className="px-4 pt-2 pb-2 flex-shrink-0">
                <DrawerTitle>Edit Budget</DrawerTitle>
              </DrawerHeader>
              <div
                className="flex-1 overflow-y-auto px-4"
                style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}
              >
                <BudgetForm
                  editBudget={budget}
                  onSuccess={handleEditSuccess}
                  onCancel={() => setMode("view")}
                />
              </div>
            </>
          ) : budget ? (
            <>
              <DrawerHeader className="px-4 pb-4 flex-shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DrawerTitle className="text-xl">{budget.category}</DrawerTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-muted-foreground">
                        {budget.currencyCode}
                      </span>
                      <span className="text-xs text-muted-foreground">{budget.month}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeColors[status.color]}`}>
                    {status.label}
                  </span>
                </div>
              </DrawerHeader>

              <div
                className="flex-1 overflow-y-auto px-4"
                style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 1.5rem))" }}
              >
                <div className="glass-card p-5 rounded-2xl mb-5 space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Spent</p>
                      <p className={`text-2xl font-bold ${textColors[status.color]}`}>
                        {formatMoney(spentCents, budget.currencyCode)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-0.5">Limit</p>
                      <p className="text-lg font-semibold">{formatMoney(budget.monthlyLimitCents, budget.currencyCode)}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColors[status.color]}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{pct}% used</span>
                      <span>
                        {remainingCents >= 0
                          ? `${formatMoney(remainingCents, budget.currencyCode)} remaining`
                          : `Over by ${formatMoney(Math.abs(remainingCents), budget.currencyCode)}`}
                      </span>
                    </div>
                  </div>
                </div>

                {budget.notes && (
                  <div className="flex gap-3 px-1 mb-5">
                    <StickyNote className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground leading-relaxed">{budget.notes}</p>
                  </div>
                )}

                <div className="text-xs text-muted-foreground space-y-0.5 mb-5 px-1">
                  <p>Created {new Date(budget.createdAt).toLocaleDateString()}</p>
                  {budget.updatedAt !== budget.createdAt && (
                    <p>Updated {new Date(budget.updatedAt).toLocaleDateString()}</p>
                  )}
                </div>

                <div className="flex gap-3 pb-4">
                  <Button
                    onClick={() => setMode("edit")}
                    variant="outline"
                    className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-foreground rounded-xl"
                    data-testid="btn-edit-budget"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => setShowDelete(true)}
                    variant="outline"
                    className="flex-1 border-rose-500/30 bg-rose-500/5 text-rose-400 hover:bg-rose-500/15 hover:border-rose-500/50 rounded-xl"
                    data-testid="btn-delete-budget"
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
            <AlertDialogTitle>Delete this budget?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              The budget for "{budget?.category}" in {budget?.month} will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-500 text-white hover:bg-rose-600" data-testid="btn-confirm-delete-budget">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
