import { useState } from "react";
import { Layout } from "@/components/Layout";
import {
  useLiveAccounts, useLiveTransactions, useLiveSnapshots, useLiveTransfers,
  calcNetWorth, addSnapshot, updateSnapshot, deleteSnapshot,
} from "@/hooks/use-finance";
import { formatMoney, formatDate } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Camera, ChevronDown, ChevronUp, Trash2, ArrowLeftRight,
} from "lucide-react";
import type { NetWorthSnapshot } from "@/types";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Checking", SAVINGS: "Savings", CASH: "Cash",
  INVESTMENT: "Investment", CREDIT_CARD: "Credit Card",
};

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

function NetWorthChart({ snapshots }: { snapshots: NetWorthSnapshot[] }) {
  if (snapshots.length < 2) return null;

  const sorted = [...snapshots]
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate))
    .slice(-12);

  const values = sorted.map((s) => s.totalConvertedToUsdCents ?? s.totalUsdCents);
  const allZero = values.every((v) => v === 0);
  if (allZero) return null;

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range  = maxVal - minVal || 1;

  const W = 340; const H = 150;
  const pL = 8; const pR = 8; const pT = 16; const pB = 36;
  const cW = W - pL - pR; const cH = H - pT - pB;
  const n = sorted.length;

  const pts = values.map((v, i) => ({
    x: pL + (n === 1 ? cW / 2 : (i / (n - 1)) * cW),
    y: pT + cH - ((v - minVal) / range) * cH,
    snap: sorted[i],
  }));

  const linePts   = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillPts   = `${pts[0].x.toFixed(1)},${(pT + cH).toFixed(1)} ${linePts} ${pts[n - 1].x.toFixed(1)},${(pT + cH).toFixed(1)}`;
  const labelIdxs = [...new Set([0, Math.floor((n - 1) / 2), n - 1])];

  const hasConverted = sorted.some((s) => s.totalConvertedToUsdCents != null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Net Worth Trend</p>
        {!hasConverted && <p className="text-[10px] text-muted-foreground/60">Showing USD only</p>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 150 }}>
        <defs>
          <linearGradient id="nw-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgb(99,102,241)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(99,102,241)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={fillPts} fill="url(#nw-grad)" />
        <polyline points={linePts} fill="none" stroke="rgb(99,102,241)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5"
            fill="rgb(99,102,241)" stroke="rgb(10,12,30)" strokeWidth="1.5" />
        ))}
        {labelIdxs.map((i) => (
          <text key={i} x={pts[i].x} y={H - 8} textAnchor="middle"
            fontSize="9" fill="rgba(148,163,184,0.8)">
            {sorted[i].snapshotDate.slice(5)}
          </text>
        ))}
        {/* Value labels: min and max */}
        <text x={pL} y={pT + cH} textAnchor="start" fontSize="8" fill="rgba(148,163,184,0.6)">
          {(minVal / 100).toFixed(0)}
        </text>
        <text x={pL} y={pT + 4} textAnchor="start" fontSize="8" fill="rgba(148,163,184,0.6)">
          {(maxVal / 100).toFixed(0)}
        </text>
      </svg>
    </div>
  );
}

// ─── Snapshot Row ─────────────────────────────────────────────────────────────

function SnapshotRow({
  snap, onDelete,
}: { snap: NetWorthSnapshot; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full p-4 flex items-start gap-3 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{formatDate(snap.snapshotDate)}</p>
            {snap.totalConvertedToUsdCents != null && (
              <p className="text-sm font-bold text-indigo-400 tabular-nums">
                ≈ {formatMoney(snap.totalConvertedToUsdCents, "USD")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
            <span>{formatMoney(snap.totalUsdCents, "USD")}</span>
            {snap.totalBrlCents !== 0 && <><span>·</span><span>{formatMoney(snap.totalBrlCents, "BRL")}</span></>}
            {snap.exchangeRateBrlPerUsd && <><span>·</span><span>1 USD = {snap.exchangeRateBrlPerUsd} BRL</span></>}
          </div>
          {snap.notes && <p className="text-xs text-muted-foreground/70 mt-1 italic">{snap.notes}</p>}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Account Breakdown</p>
              {snap.accountBreakdown.map((acc) => (
                <div key={acc.accountId} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{acc.accountName}</p>
                    <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[acc.accountType] ?? acc.accountType}</p>
                  </div>
                  <p className={`font-semibold tabular-nums flex-shrink-0 ml-3 ${acc.balanceCents < 0 ? "text-rose-400" : "text-foreground"}`}>
                    {formatMoney(acc.balanceCents, acc.currencyCode)}
                  </p>
                </div>
              ))}
              <div className="pt-3 mt-2 border-t border-white/10">
                <button
                  onClick={() => onDelete(snap.id)}
                  className="flex items-center gap-2 text-xs text-rose-400 hover:text-rose-300 transition-colors"
                  data-testid={`btn-delete-snapshot-${snap.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete snapshot
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NetWorth() {
  const accounts     = useLiveAccounts();
  const transactions = useLiveTransactions();
  const transfers    = useLiveTransfers();
  const snapshots    = useLiveSnapshots();
  const { toast }  = useToast();

  const [exchangeRateStr, setExchangeRateStr] = useState("");
  const [showSnapshotForm, setShowSnapshotForm] = useState(false);
  const [snapshotNotes, setSnapshotNotes] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { totalUsdCents, totalBrlCents, breakdown } = calcNetWorth(accounts, transactions, transfers);

  const rate    = parseFloat(exchangeRateStr);
  const hasRate = !isNaN(rate) && rate > 0;
  const convertedToUsd = hasRate ? Math.round(totalUsdCents + totalBrlCents / rate) : null;
  const convertedToBrl = hasRate ? Math.round(totalUsdCents * rate + totalBrlCents) : null;

  const todayStr        = new Date().toISOString().slice(0, 10);
  const todaySnapshot   = snapshots.find((s) => s.snapshotDate === todayStr);
  const sortedSnapshots = [...snapshots].sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));

  const handleSaveSnapshot = async (replace: boolean) => {
    const payload = {
      snapshotDate: todayStr,
      totalUsdCents,
      totalBrlCents,
      exchangeRateBrlPerUsd: hasRate ? rate : undefined,
      totalConvertedToUsdCents: convertedToUsd ?? undefined,
      totalConvertedToBrlCents: convertedToBrl ?? undefined,
      accountBreakdown: breakdown,
      notes: snapshotNotes.trim() || undefined,
    };
    if (replace && todaySnapshot) {
      await updateSnapshot(todaySnapshot.id, payload);
      toast({ title: "Snapshot updated", description: todayStr });
    } else {
      await addSnapshot(payload);
      toast({ title: "Snapshot saved", description: todayStr });
    }
    setShowSnapshotForm(false);
    setSnapshotNotes("");
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteSnapshot(deleteId);
    setDeleteId(null);
    toast({ title: "Snapshot deleted" });
  };

  return (
    <Layout>
      <div className="p-4 space-y-5 pt-12 pb-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Net Worth</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your financial growth over time.</p>
        </header>

        {/* Current Net Worth */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 rounded-3xl relative overflow-hidden"
          data-testid="card-net-worth-current"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="relative z-10 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current Net Worth</p>

            {convertedToUsd != null ? (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Consolidated (approx.)</p>
                <p className="text-4xl font-bold tracking-tight text-indigo-400">
                  ≈ {formatMoney(convertedToUsd, "USD")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  ≈ {formatMoney(convertedToBrl!, "BRL")}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Enter an exchange rate below to see a consolidated total.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="glass-card p-3 rounded-2xl">
                <p className="text-xs text-muted-foreground mb-1">🇺🇸 USD</p>
                <p className={`text-xl font-bold tabular-nums ${totalUsdCents < 0 ? "text-rose-400" : ""}`}>
                  {formatMoney(totalUsdCents, "USD")}
                </p>
              </div>
              <div className="glass-card p-3 rounded-2xl">
                <p className="text-xs text-muted-foreground mb-1">🇧🇷 BRL</p>
                <p className={`text-xl font-bold tabular-nums ${totalBrlCents < 0 ? "text-rose-400" : ""}`}>
                  {formatMoney(totalBrlCents, "BRL")}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Account breakdown */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-3">Account Breakdown</h3>
          <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/10 border border-white/10">
            {breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No accounts yet.</p>
            ) : (
              breakdown.map((acc) => (
                <div key={acc.accountId} className="flex items-center justify-between p-4 gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{acc.accountName}</p>
                    <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[acc.accountType] ?? acc.accountType} · {acc.currencyCode}</p>
                  </div>
                  <p className={`font-semibold tabular-nums flex-shrink-0 ${acc.balanceCents < 0 ? "text-rose-400" : "text-foreground"}`}>
                    {formatMoney(acc.balanceCents, acc.currencyCode)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Exchange rate */}
        <div className="glass-card p-4 rounded-2xl space-y-3">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Exchange Rate</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground whitespace-nowrap">1 USD =</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 5.70"
              value={exchangeRateStr}
              onChange={(e) => setExchangeRateStr(e.target.value)}
              className="bg-white/5 border-white/10 flex-1"
              data-testid="input-exchange-rate"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">BRL</span>
          </div>
          {hasRate && (
            <p className="text-xs text-indigo-400">
              Consolidated: ≈ {formatMoney(convertedToUsd!, "USD")} · ≈ {formatMoney(convertedToBrl!, "BRL")}
            </p>
          )}
        </div>

        {/* Save snapshot */}
        <div className="space-y-3">
          {!showSnapshotForm ? (
            <Button
              onClick={() => setShowSnapshotForm(true)}
              data-testid="btn-save-snapshot"
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl py-6 font-semibold"
            >
              <Camera className="w-4 h-4 mr-2" />
              {todaySnapshot ? "Update Today's Snapshot" : "Create Net Worth Snapshot"}
            </Button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4 rounded-2xl space-y-3 border border-indigo-500/20"
            >
              {todaySnapshot && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-amber-400">
                    A snapshot for today already exists. Saving will replace it.
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Notes (optional)</p>
                <Textarea
                  placeholder="e.g. After salary, before rent payment…"
                  value={snapshotNotes}
                  onChange={(e) => setSnapshotNotes(e.target.value)}
                  className="bg-white/5 border-white/10 resize-none text-sm"
                  rows={2}
                  data-testid="input-snapshot-notes"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setShowSnapshotForm(false); setSnapshotNotes(""); }}
                  className="flex-1 bg-white/5 border-white/10 hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleSaveSnapshot(!!todaySnapshot)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                  data-testid="btn-confirm-snapshot"
                >
                  {todaySnapshot ? "Replace" : "Save Snapshot"}
                </Button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Chart */}
        {snapshots.length >= 2 && (
          <div className="glass-card p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">History Chart</h3>
            </div>
            <NetWorthChart snapshots={snapshots} />
          </div>
        )}

        {snapshots.length === 1 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Create one more snapshot to see your net worth trend.
          </p>
        )}

        {/* Snapshot list */}
        {sortedSnapshots.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-3">
              Snapshots ({sortedSnapshots.length})
            </h3>
            <div className="space-y-3">
              {sortedSnapshots.map((snap) => (
                <SnapshotRow key={snap.id} snap={snap} onDelete={setDeleteId} />
              ))}
            </div>
          </div>
        )}

        {accounts.length === 0 && (
          <div className="text-center py-8 glass-card rounded-2xl">
            <p className="text-muted-foreground text-sm">Add accounts first to track net worth.</p>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent className="bg-background border-white/10 max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete snapshot?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This snapshot will be permanently removed and the chart will update.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-500 text-white hover:bg-rose-600">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
