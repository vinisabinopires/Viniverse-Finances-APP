import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { addBudget, updateBudget } from "@/hooks/use-finance";
import { EXPENSE_CATEGORIES } from "@/components/CategoryPicker";
import type { Budget } from "@/types";

const schema = z.object({
  category: z.string().min(1, "Category is required"),
  currencyCode: z.enum(["USD", "BRL"]),
  monthlyLimit: z
    .string()
    .min(1, "Required")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, { message: "Enter a valid amount" }),
  month: z.string().min(7, "Month is required"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface BudgetFormProps {
  onSuccess: () => void;
  onCancel?: () => void;
  defaultMonth?: string; // YYYY-MM
  editBudget?: Budget;
}

export function BudgetForm({ onSuccess, onCancel, defaultMonth, editBudget }: BudgetFormProps) {
  const currentMonth = defaultMonth ?? new Date().toISOString().slice(0, 7);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editBudget
      ? {
          category: editBudget.category,
          currencyCode: editBudget.currencyCode,
          monthlyLimit: (editBudget.monthlyLimitCents / 100).toFixed(2),
          month: editBudget.month,
          notes: editBudget.notes ?? "",
        }
      : {
          category: "",
          currencyCode: "USD",
          monthlyLimit: "",
          month: currentMonth,
          notes: "",
        },
  });

  const [customCategory, setCustomCategory] = useState(
    editBudget ? !EXPENSE_CATEGORIES.includes(editBudget.category) : false,
  );
  const selectedCategory = form.watch("category");

  const handlePreset = (cat: string) => {
    form.setValue("category", cat, { shouldValidate: true });
    setCustomCategory(false);
  };

  const handleCustomToggle = () => {
    setCustomCategory(true);
    form.setValue("category", "", { shouldValidate: false });
  };

  const onSubmit = async (data: FormData) => {
    const payload = {
      category: data.category,
      currencyCode: data.currencyCode,
      monthlyLimitCents: Math.round(parseFloat(data.monthlyLimit) * 100),
      month: data.month,
      notes: data.notes ?? "",
    };

    if (editBudget) {
      await updateBudget(editBudget.id, payload);
    } else {
      await addBudget(payload);
    }
    onSuccess();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Category */}
        <FormField
          control={form.control}
          name="category"
          render={() => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handlePreset(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          selectedCategory === cat && !customCategory
                            ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                            : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleCustomToggle}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        customCategory
                          ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                          : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                      }`}
                    >
                      Custom...
                    </button>
                  </div>
                  {customCategory && (
                    <Input
                      placeholder="Type a custom category"
                      value={customCategory && !EXPENSE_CATEGORIES.includes(selectedCategory) ? selectedCategory : ""}
                      onChange={(e) => form.setValue("category", e.target.value, { shouldValidate: true })}
                      autoFocus
                      className="bg-white/5 border-white/10"
                    />
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Month */}
        <FormField
          control={form.control}
          name="month"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Month</FormLabel>
              <FormControl>
                <Input
                  type="month"
                  data-testid="input-budget-month"
                  {...field}
                  className="bg-white/5 border-white/10"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          {/* Monthly Limit */}
          <FormField
            control={form.control}
            name="monthlyLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monthly Limit</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    data-testid="input-budget-limit"
                    {...field}
                    className="bg-white/5 border-white/10"
                  />
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
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-white/5 border-white/10" data-testid="select-budget-currency">
                      <SelectValue placeholder="Currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-popover border-white/10">
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="BRL">BRL (R$)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g. Includes eating out and groceries"
                  data-testid="input-budget-notes"
                  {...field}
                  className="bg-white/5 border-white/10 resize-none"
                  rows={2}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2 pt-1">
          <Button
            type="submit"
            data-testid="btn-save-budget"
            disabled={form.formState.isSubmitting}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl py-6 font-semibold disabled:opacity-60"
          >
            {form.formState.isSubmitting ? "Saving…" : editBudget ? "Save Changes" : "Create Budget"}
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
