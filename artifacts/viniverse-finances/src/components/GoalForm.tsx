import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { addGoal, updateGoal } from "@/hooks/use-finance";
import type { FinancialGoal, GoalType } from "@/types";

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  EMERGENCY_FUND: "Emergency Fund",
  SAVINGS:        "Savings",
  INVESTMENT:     "Investment",
  TRAVEL:         "Travel",
  DEBT_PAYOFF:    "Debt Payoff",
  CUSTOM:         "Custom",
};

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  goalType: z.enum(["EMERGENCY_FUND", "SAVINGS", "INVESTMENT", "TRAVEL", "DEBT_PAYOFF", "CUSTOM"]),
  targetAmount: z
    .string()
    .min(1, "Target amount is required")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, { message: "Enter a valid amount" }),
  currentAmount: z
    .string()
    .refine((v) => v === "" || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0), { message: "Enter a valid amount" }),
  currencyCode: z.enum(["USD", "BRL"]),
  targetDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface GoalFormProps {
  onSuccess: () => void;
  onCancel?: () => void;
  editGoal?: FinancialGoal;
}

export function GoalForm({ onSuccess, onCancel, editGoal }: GoalFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editGoal
      ? {
          name: editGoal.name,
          goalType: editGoal.goalType,
          targetAmount: (editGoal.targetAmountCents / 100).toFixed(2),
          currentAmount: (editGoal.currentAmountCents / 100).toFixed(2),
          currencyCode: editGoal.currencyCode,
          targetDate: editGoal.targetDate ?? "",
          notes: editGoal.notes ?? "",
        }
      : {
          name: "",
          goalType: "SAVINGS",
          targetAmount: "",
          currentAmount: "0",
          currencyCode: "USD",
          targetDate: "",
          notes: "",
        },
  });

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      goalType: data.goalType,
      targetAmountCents: Math.round(parseFloat(data.targetAmount) * 100),
      currentAmountCents: data.currentAmount ? Math.round(parseFloat(data.currentAmount) * 100) : 0,
      currencyCode: data.currencyCode,
      targetDate: data.targetDate || undefined,
      notes: data.notes || undefined,
      isArchived: editGoal?.isArchived ?? false,
    };

    if (editGoal) {
      await updateGoal(editGoal.id, payload);
    } else {
      await addGoal(payload);
    }
    onSuccess();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Goal type */}
        <FormField
          control={form.control}
          name="goalType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Goal Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-popover border-white/10">
                  {(Object.entries(GOAL_TYPE_LABELS) as [GoalType, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Goal Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Emergency Fund, Europe Trip…" {...field} className="bg-white/5 border-white/10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Currency */}
        <FormField
          control={form.control}
          name="currencyCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Currency</FormLabel>
              <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                {(["USD", "BRL"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => field.onChange(c)}
                    className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
                      field.value === c
                        ? "bg-primary/20 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c === "USD" ? "🇺🇸 USD" : "🇧🇷 BRL"}
                  </button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Amounts */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="targetAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Amount</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" placeholder="0.00" inputMode="decimal" {...field} className="bg-white/5 border-white/10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currentAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Amount</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" placeholder="0.00" inputMode="decimal" {...field} className="bg-white/5 border-white/10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Target date */}
        <FormField
          control={form.control}
          name="targetDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Target Date <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
              <FormControl>
                <Input type="date" {...field} className="bg-white/5 border-white/10" />
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

        <div className="space-y-2 pt-1">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl py-6 font-semibold disabled:opacity-60"
          >
            {form.formState.isSubmitting ? "Saving…" : editGoal ? "Save Changes" : "Create Goal"}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={form.formState.isSubmitting}
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
