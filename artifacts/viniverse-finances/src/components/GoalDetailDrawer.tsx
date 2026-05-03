import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GoalForm } from "@/components/GoalForm";
import { deleteGoal, updateGoal } from "@/hooks/use-finance";
import { formatMoney, formatDate } from "@/utils";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Archive, ArchiveRestore } from "lucide-react";
import type { FinancialGoal } from "@/types";
import { GOAL_TYPE_META } from "@/constants/goals";

interface GoalDetailDrawerProps {
  goal: FinancialGoal | null;
  monthExpensesCents: number;
  onClose: () => void;
}

export function GoalDetailDrawer({ goal, monthExpensesCents, onClose }: GoalDetailDrawerProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [showDelete, setShowDelete] = useState(false);
  const { toast } = useToast();

  const handleClose = () => {
    setMode("view");
    setShowDelete(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!goal) return;
    await deleteGoal(goal.id);
    toast({ title: "Goal deleted" });
    handleClose();
  };

  const handleArchive = async () => {
    if (!goal) return;
    await updateGoal(goal.id, { isArchived: !goal.isArchived });
    toast({ title: goal.isArchived ? "Goal restored" : "Goal archived" });
  };

  if (!goal) return null;

  const pct = goal.targetAmountCents > 0
    ? Math.min(Math.round((goal.currentAmountCents / goal.targetAmountCents) * 100), 100)
    : 0;
  const remaining = Math.max(goal.targetAmountCents - goal.currentAmountCents, 0);
  const meta = GOAL_TYPE_META[goal.goalType];
  const isEmergency = goal.goalType === "EMERGENCY_FUND";
  const monthsCovered = isEmergency && monthExpensesCents > 0
    ? (goal.currentAmountCents / monthExpensesCents).toFixed(1)
    : null;

  const barColor =
    pct >= 100 ? "bg-yellow-400" :
    pct >= 70  ? "bg-emerald-500/80" :
    pct >= 30  ? "bg-indigo-500/80" :
    "bg-blue-500/80";

  return (
    <>
      <Drawer open={!!goal} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DrawerContent className="bg-background border-t border-white/10 text-foreground p-4 pb-safe max-h-[90dvh] overflow-y-auto">
          {mode === "edit" ? (
            <>
              <DrawerHeader className="px-0 pb-2">
                <div className="flex items-center justify-between">
                  <DrawerTitle>Edit Goal</DrawerTitle>
                  <button onClick={() => setMode("view")} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 transition-colors">
                    Cancel
                  </button>
                </div>
              </DrawerHeader>
              <div className="pb-8">
                <GoalForm editGoal={goal} onSuccess={() => { toast({ title: "Goal updated" }); setMode("view"); }} />
              </div>
            </>
          ) : (
            <>
              <DrawerHeader className="px-0 pb-4">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${meta.bg}`}>
                    {meta.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <DrawerTitle className="text-xl leading-tight">{goal.name}</DrawerTitle>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.badge}`}>
                        {meta.label}
                      </span>
                      {goal.isArchived && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
                          Archived
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </DrawerHeader>

              {/* Progress */}
              <div className="glass-card p-5 rounded-2xl mb-5 space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Progress</p>
                    <p className="text-3xl font-bold">{pct}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-0.5">Remaining</p>
                    <p className="text-lg font-semibold text-muted-foreground">{formatMoney(remaining, goal.currencyCode)}</p>
                  </div>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatMoney(goal.currentAmountCents, goal.currencyCode)} saved</span>
                  <span>of {formatMoney(goal.targetAmountCents, goal.currencyCode)}</span>
                </div>
              </div>

              {/* Emergency fund helper */}
              {isEmergency && (
                <div className="glass-card p-4 rounded-xl mb-5 border border-amber-500/20 bg-amber-500/5 space-y-1.5">
                  <p className="text-xs font-semibold text-amber-400">Emergency Fund</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A strong emergency fund covers 3–6 months of essential expenses.
                  </p>
                  {monthsCovered !== null ? (
                    <p className="text-sm font-semibold text-amber-300 mt-1">
                      {monthsCovered} months covered at current monthly expenses
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      {monthExpensesCents === 0
                        ? "Add expenses this month to estimate months covered."
                        : "Currency mismatch — check that expenses match your goal currency."}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-0 mb-5">
                {goal.targetDate && <DetailRow label="Target date" value={formatDate(goal.targetDate)} />}
                {goal.notes && <DetailRow label="Notes" value={goal.notes} />}
                <DetailRow label="Currency" value={goal.currencyCode} />
                <DetailRow label="Created" value={formatDate(goal.createdAt)} />
              </div>

              <div className="space-y-3 pb-4">
                <button
                  onClick={handleArchive}
                  className="w-full py-3 rounded-xl text-sm font-medium border bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 transition-colors"
                  data-testid="btn-archive-goal"
                >
                  {goal.isArchived
                    ? <><ArchiveRestore className="w-4 h-4 inline mr-2" />Restore Goal</>
                    : <><Archive className="w-4 h-4 inline mr-2" />Archive Goal</>}
                </button>
                <div className="flex gap-3">
                  <Button onClick={() => setMode("edit")} variant="outline" className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-foreground rounded-xl" data-testid="btn-edit-goal">
                    <Pencil className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Button onClick={() => setShowDelete(true)} variant="outline" className="flex-1 border-rose-500/30 bg-rose-500/5 text-rose-400 hover:bg-rose-500/15 rounded-xl" data-testid="btn-delete-goal">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent className="bg-background border-white/10 max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{goal.name}"?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This goal will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-500 text-white hover:bg-rose-600" data-testid="btn-confirm-delete-goal">
              Delete Goal
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
      <p className="text-xs text-muted-foreground w-24 flex-shrink-0 mt-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground leading-snug">{value}</p>
    </div>
  );
}
