import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useLiveAccounts, addRecurringRule, updateRecurringRule } from "@/hooks/use-finance";
import { CategoryPicker } from "@/components/CategoryPicker";
import type { RecurringRule } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, { message: "Enter a valid amount" }),
  accountId: z.string().min(1, "Account is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "YEARLY"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface RecurringFormProps {
  onSuccess: () => void;
  editRule?: RecurringRule;
}

export function RecurringForm({ onSuccess, editRule }: RecurringFormProps) {
  const accounts = useLiveAccounts();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editRule
      ? {
          name: editRule.name,
          type: editRule.type,
          amount: (editRule.amountCents / 100).toFixed(2),
          accountId: editRule.accountId,
          category: editRule.category,
          description: editRule.description ?? "",
          frequency: editRule.frequency,
          startDate: editRule.startDate,
          endDate: editRule.endDate ?? "",
          notes: editRule.notes ?? "",
          isActive: editRule.isActive,
        }
      : {
          name: "",
          type: "EXPENSE",
          amount: "",
          accountId: accounts[0]?.id ?? "",
          category: "",
          description: "",
          frequency: "MONTHLY",
          startDate: new Date().toISOString().slice(0, 10),
          endDate: "",
          notes: "",
          isActive: true,
        },
  });

  const watchedType = form.watch("type");
  const watchedActive = form.watch("isActive");

  const onSubmit = async (data: FormData) => {
    const account = accounts.find((a) => a.id === data.accountId);
    const payload = {
      name: data.name,
      type: data.type,
      amountCents: Math.round(parseFloat(data.amount) * 100),
      currencyCode: account?.currencyCode ?? "USD",
      accountId: data.accountId,
      category: data.category,
      description: data.description ?? "",
      frequency: data.frequency,
      startDate: data.startDate,
      endDate: data.endDate || undefined,
      notes: data.notes || undefined,
      isActive: data.isActive,
    };

    if (editRule) {
      await updateRecurringRule(editRule.id, payload);
    } else {
      await addRecurringRule(payload);
    }
    onSuccess();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
          {(["EXPENSE", "INCOME"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => form.setValue("type", t)}
              className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
                watchedType === t
                  ? t === "EXPENSE"
                    ? "bg-rose-500/20 text-rose-400 shadow-sm"
                    : "bg-emerald-500/20 text-emerald-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "EXPENSE" ? "Expense" : "Income"}
            </button>
          ))}
        </div>

        {/* Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rule Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Monthly Rent, Netflix, Salary" {...field} className="bg-white/5 border-white/10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Amount */}
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
                  {...field}
                  className="bg-white/5 border-white/10 text-2xl font-semibold h-14"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Account */}
        <FormField
          control={form.control}
          name="accountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white/5 border-white/10">
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

        {/* Category */}
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <CategoryPicker value={field.value} onChange={field.onChange} transactionType={watchedType} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Frequency */}
        <FormField
          control={form.control}
          name="frequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frequency</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-popover border-white/10">
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="BIWEEKLY">Every 2 Weeks</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} className="bg-white/5 border-white/10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date <span className="text-muted-foreground font-normal">(opt.)</span></FormLabel>
                <FormControl>
                  <Input type="date" {...field} className="bg-white/5 border-white/10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
              <FormControl>
                <Input placeholder="e.g. Apartment rent" {...field} className="bg-white/5 border-white/10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
              <FormControl>
                <Textarea placeholder="Any extra details…" {...field} className="bg-white/5 border-white/10 resize-none" rows={2} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Active toggle */}
        <div className="flex items-center justify-between p-4 glass-card rounded-xl border border-white/10">
          <div>
            <p className="text-sm font-medium">Active</p>
            <p className="text-xs text-muted-foreground">Inactive rules are skipped during generation</p>
          </div>
          <button
            type="button"
            onClick={() => form.setValue("isActive", !watchedActive)}
            className={`relative w-11 h-6 rounded-full transition-colors ${watchedActive ? "bg-primary" : "bg-white/10"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${watchedActive ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
        </div>

        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl py-6 font-semibold disabled:opacity-60"
        >
          {form.formState.isSubmitting ? "Saving…" : editRule ? "Update Rule" : "Create Rule"}
        </Button>
      </form>
    </Form>
  );
}
