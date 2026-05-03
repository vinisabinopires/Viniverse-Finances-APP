import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveAccounts, addTransfer, updateTransfer } from "@/hooks/use-finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Info } from "lucide-react";
import type { Transfer } from "@/types";

const schema = z.object({
  date:            z.string().min(1, "Date required"),
  fromAccountId:   z.string().min(1, "Select source account"),
  toAccountId:     z.string().min(1, "Select destination account"),
  fromAmount:      z.string().min(1, "Enter amount"),
  toAmount:        z.string().min(1, "Enter destination amount"),
  exchangeRate:    z.string().optional(),
  feeAmount:       z.string().optional(),
  feeCurrencyCode: z.enum(["USD", "BRL"]).optional(),
  description:     z.string().optional(),
  notes:           z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.fromAccountId && d.toAccountId && d.fromAccountId === d.toAccountId) {
    ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Must differ from source account" });
  }
  const from = parseFloat(d.fromAmount);
  if (isNaN(from) || from <= 0) ctx.addIssue({ code: "custom", path: ["fromAmount"], message: "Enter a valid amount > 0" });
  const to = parseFloat(d.toAmount);
  if (isNaN(to) || to <= 0) ctx.addIssue({ code: "custom", path: ["toAmount"], message: "Enter a valid amount > 0" });
});

type FormValues = z.infer<typeof schema>;

interface TransferFormProps {
  editTransfer?: Transfer;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TransferForm({ editTransfer, onSuccess, onCancel }: TransferFormProps) {
  const accounts    = useLiveAccounts();
  const [submitting, setSubmitting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const firstId  = accounts[0]?.id ?? "";
  const secondId = accounts[1]?.id ?? "";

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editTransfer ? {
      date:            editTransfer.date,
      fromAccountId:   editTransfer.fromAccountId,
      toAccountId:     editTransfer.toAccountId,
      fromAmount:      (editTransfer.fromAmountCents / 100).toFixed(2),
      toAmount:        (editTransfer.toAmountCents / 100).toFixed(2),
      exchangeRate:    editTransfer.exchangeRate?.toString() ?? "",
      feeAmount:       editTransfer.feeAmountCents ? (editTransfer.feeAmountCents / 100).toFixed(2) : "",
      feeCurrencyCode: editTransfer.feeCurrencyCode ?? "USD",
      description:     editTransfer.description ?? "",
      notes:           editTransfer.notes ?? "",
    } : {
      date:            today,
      fromAccountId:   firstId,
      toAccountId:     secondId,
      fromAmount:      "",
      toAmount:        "",
      exchangeRate:    "",
      feeAmount:       "",
      feeCurrencyCode: "USD",
      description:     "",
      notes:           "",
    },
  });

  const fromAccountId  = watch("fromAccountId");
  const toAccountId    = watch("toAccountId");
  const fromAmount     = watch("fromAmount");
  const exchangeRate   = watch("exchangeRate");
  const feeAmount      = watch("feeAmount");

  const fromAccount   = accounts.find((a) => a.id === fromAccountId);
  const toAccount     = accounts.find((a) => a.id === toAccountId);
  const isCross       = !!(fromAccount && toAccount && fromAccount.currencyCode !== toAccount.currencyCode);
  const showFeeCcy    = !!(feeAmount && parseFloat(feeAmount) > 0);

  // Auto-sync toAmount from fromAmount when same currency
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    if (!isCross) setValue("toAmount", fromAmount ?? "");
  }, [fromAmount, isCross, setValue]);

  // Auto-compute toAmount from fromAmount × exchangeRate when cross-currency
  useEffect(() => {
    if (!isMounted.current) return;
    if (isCross && fromAmount && exchangeRate) {
      const f = parseFloat(fromAmount);
      const r = parseFloat(exchangeRate);
      if (!isNaN(f) && !isNaN(r) && r > 0) {
        setValue("toAmount", (f * r).toFixed(2));
      }
    }
  }, [fromAmount, exchangeRate, isCross, setValue]);

  const onSubmit = async (values: FormValues) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const fromAcc = accounts.find((a) => a.id === values.fromAccountId);
      const toAcc   = accounts.find((a) => a.id === values.toAccountId);
      const hasFee  = !!(values.feeAmount && parseFloat(values.feeAmount) > 0);
      const data = {
        date:            values.date,
        fromAccountId:   values.fromAccountId,
        toAccountId:     values.toAccountId,
        fromAmountCents: Math.round(parseFloat(values.fromAmount) * 100),
        fromCurrencyCode:(fromAcc?.currencyCode ?? "USD") as "USD" | "BRL",
        toAmountCents:   Math.round(parseFloat(values.toAmount) * 100),
        toCurrencyCode:  (toAcc?.currencyCode   ?? "USD") as "USD" | "BRL",
        exchangeRate:    values.exchangeRate ? parseFloat(values.exchangeRate) || undefined : undefined,
        feeAmountCents:  hasFee ? Math.round(parseFloat(values.feeAmount!) * 100) : undefined,
        feeCurrencyCode: hasFee ? (values.feeCurrencyCode ?? "USD") : undefined,
        description:     values.description || undefined,
        notes:           values.notes || undefined,
      };
      if (editTransfer) {
        await updateTransfer(editTransfer.id, data);
      } else {
        await addTransfer(data);
      }
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  if (accounts.length < 2) {
    return (
      <div className="py-14 text-center">
        <p className="text-muted-foreground text-sm">You need at least 2 accounts to create a transfer.</p>
        <button onClick={onCancel} className="mt-4 text-xs text-primary hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">

      {/* Cross-currency notice */}
      {isCross && (
        <div className="flex items-start gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3">
          <Info className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-indigo-300 leading-relaxed">
            Currency transfer — moves money between currencies. <strong>Not counted as income or expense.</strong>
          </p>
        </div>
      )}

      {/* Date */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date</label>
        <Input type="date" {...register("date")} className="bg-white/5 border-white/10" />
        {errors.date && <p className="text-xs text-rose-400 mt-1">{errors.date.message}</p>}
      </div>

      {/* From → To accounts */}
      <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">From</label>
          <Select value={fromAccountId} onValueChange={(v) => setValue("fromAccountId", v)}>
            <SelectTrigger className="bg-white/5 border-white/10 h-10">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} <span className="text-muted-foreground text-xs">({a.currencyCode})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.fromAccountId && <p className="text-xs text-rose-400 mt-1">{errors.fromAccountId.message}</p>}
        </div>

        <div className="flex items-center pb-1">
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">To</label>
          <Select value={toAccountId} onValueChange={(v) => setValue("toAccountId", v)}>
            <SelectTrigger className="bg-white/5 border-white/10 h-10">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.filter((a) => a.id !== fromAccountId).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} <span className="text-muted-foreground text-xs">({a.currencyCode})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.toAccountId && <p className="text-xs text-rose-400 mt-1">{errors.toAccountId.message}</p>}
        </div>
      </div>

      {/* Amount fields */}
      {isCross ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Amount to send ({fromAccount?.currencyCode})
            </label>
            <Input
              type="number" step="0.01" min="0.01" placeholder="0.00"
              {...register("fromAmount")}
              className="bg-white/5 border-white/10"
            />
            {errors.fromAmount && <p className="text-xs text-rose-400 mt-1">{errors.fromAmount.message}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Exchange rate (1 {fromAccount?.currencyCode} = ? {toAccount?.currencyCode})
            </label>
            <Input
              type="number" step="any" min="0.000001" placeholder="e.g. 5.75"
              {...register("exchangeRate")}
              className="bg-white/5 border-white/10"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Amount received ({toAccount?.currencyCode})
            </label>
            <Input
              type="number" step="0.01" min="0.01" placeholder="0.00"
              {...register("toAmount")}
              className="bg-white/5 border-white/10"
            />
            {errors.toAmount && <p className="text-xs text-rose-400 mt-1">{errors.toAmount.message}</p>}
          </div>
        </div>
      ) : (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Amount ({fromAccount?.currencyCode ?? "–"})
          </label>
          <Input
            type="number" step="0.01" min="0.01" placeholder="0.00"
            {...register("fromAmount")}
            className="bg-white/5 border-white/10"
          />
          {errors.fromAmount && <p className="text-xs text-rose-400 mt-1">{errors.fromAmount.message}</p>}
          <input type="hidden" {...register("toAmount")} />
        </div>
      )}

      {/* Fee */}
      <div className={`grid gap-2 ${showFeeCcy ? "grid-cols-2" : "grid-cols-1"}`}>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Transfer fee (optional)</label>
          <Input
            type="number" step="0.01" min="0" placeholder="0.00"
            {...register("feeAmount")}
            className="bg-white/5 border-white/10"
          />
        </div>
        {showFeeCcy && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Fee currency</label>
            <Select
              value={watch("feeCurrencyCode") ?? "USD"}
              onValueChange={(v) => setValue("feeCurrencyCode", v as "USD" | "BRL")}
            >
              <SelectTrigger className="bg-white/5 border-white/10 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="BRL">BRL</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description (optional)</label>
        <Input
          placeholder="e.g. Wallet refill"
          {...register("description")}
          className="bg-white/5 border-white/10"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes (optional)</label>
        <Textarea
          placeholder="Additional details…"
          {...register("notes")}
          className="bg-white/5 border-white/10 resize-none"
          rows={2}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button" variant="outline" onClick={onCancel}
          className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-foreground rounded-xl"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting} className="flex-1 rounded-xl">
          {submitting ? "Saving…" : editTransfer ? "Update Transfer" : "Save Transfer"}
        </Button>
      </div>
    </form>
  );
}
