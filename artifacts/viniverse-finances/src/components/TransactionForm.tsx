import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useLiveAccounts, addTransaction, updateTransaction } from "@/hooks/use-finance";
import { CategoryPicker } from "@/components/CategoryPicker";
import type { Transaction } from "@/types";

const schema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.string().min(1, "Amount is required").refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, { message: "Enter a valid amount" }),
  accountId: z.string().min(1, "Account is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  notes: z.string().optional(),
  occurredAt: z.string().min(1, "Date is required"),
});

type FormData = z.infer<typeof schema>;

interface TransactionFormProps {
  onSuccess: () => void;
  onCancel?: () => void;
  defaultType?: "INCOME" | "EXPENSE";
  editTransaction?: Transaction;
}

export function TransactionForm({ onSuccess, onCancel, defaultType = "EXPENSE", editTransaction }: TransactionFormProps) {
  const accounts = useLiveAccounts();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editTransaction
      ? {
          type: editTransaction.type,
          amount: (editTransaction.amountCents / 100).toFixed(2),
          accountId: editTransaction.accountId,
          category: editTransaction.category,
          description: editTransaction.description || "",
          notes: editTransaction.notes || "",
          occurredAt: editTransaction.occurredAt.slice(0, 10),
        }
      : {
          type: defaultType,
          amount: "",
          accountId: accounts[0]?.id || "",
          category: "",
          description: "",
          notes: "",
          occurredAt: new Date().toISOString().slice(0, 10),
        },
  });

  const watchedType = form.watch("type");

  const onSubmit = async (data: FormData) => {
    const account = accounts.find((a) => a.id === data.accountId);
    if (!account) return;

    const payload = {
      type: data.type,
      amountCents: Math.round(parseFloat(data.amount) * 100),
      currencyCode: account.currencyCode,
      accountId: data.accountId,
      category: data.category,
      description: data.description || "",
      notes: data.notes || "",
      occurredAt: new Date(data.occurredAt + "T12:00:00").toISOString(),
    };

    if (editTransaction) {
      await updateTransaction(editTransaction.id, payload);
    } else {
      await addTransaction(payload);
    }
    onSuccess();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
          <button
            type="button"
            data-testid="toggle-expense"
            className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
              watchedType === "EXPENSE"
                ? "bg-rose-500/20 text-rose-400 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => form.setValue("type", "EXPENSE")}
          >
            Expense
          </button>
          <button
            type="button"
            data-testid="toggle-income"
            className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
              watchedType === "INCOME"
                ? "bg-emerald-500/20 text-emerald-400 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => form.setValue("type", "INCOME")}
          >
            Income
          </button>
        </div>

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  inputMode="decimal"
                  data-testid="input-amount"
                  {...field}
                  className="bg-white/5 border-white/10 text-2xl font-semibold h-14"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="accountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white/5 border-white/10" data-testid="select-account">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-popover border-white/10">
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currencyCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <CategoryPicker
                  value={field.value}
                  onChange={field.onChange}
                  transactionType={watchedType}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Whole Foods, Netflix, etc."
                  data-testid="input-description"
                  {...field}
                  className="bg-white/5 border-white/10"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any extra details..."
                  data-testid="input-notes"
                  {...field}
                  className="bg-white/5 border-white/10 resize-none"
                  rows={2}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="occurredAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  data-testid="input-date"
                  {...field}
                  className="bg-white/5 border-white/10"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2 pt-1">
          <Button
            type="submit"
            data-testid="btn-save-transaction"
            disabled={form.formState.isSubmitting}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl py-6 font-semibold disabled:opacity-60"
          >
            {form.formState.isSubmitting
              ? "Saving…"
              : editTransaction
              ? "Save Changes"
              : "Save Transaction"}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={form.formState.isSubmitting}
              data-testid="btn-cancel-transaction"
              className="w-full bg-white/5 border-white/10 hover:bg-white/10 text-foreground rounded-xl py-5 font-medium"
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
