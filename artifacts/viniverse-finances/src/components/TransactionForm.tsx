import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useLiveAccounts, addTransaction } from "@/hooks/use-finance";

const schema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.string().min(1, "Amount is required"),
  accountId: z.string().min(1, "Account is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  occurredAt: z.string().min(1, "Date is required"),
});

type FormData = z.infer<typeof schema>;

interface TransactionFormProps {
  onSuccess: () => void;
  defaultType?: "INCOME" | "EXPENSE";
}

export function TransactionForm({ onSuccess, defaultType = "EXPENSE" }: TransactionFormProps) {
  const accounts = useLiveAccounts();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: defaultType,
      amount: "",
      accountId: "",
      category: "",
      description: "",
      occurredAt: new Date().toISOString().slice(0, 10),
    },
  });

  const onSubmit = async (data: FormData) => {
    const account = accounts.find((a) => a.id === data.accountId);
    if (!account) return;

    await addTransaction({
      type: data.type,
      amountCents: Math.round(parseFloat(data.amount) * 100),
      currencyCode: account.currencyCode,
      accountId: data.accountId,
      category: data.category,
      description: data.description || "",
      occurredAt: new Date(data.occurredAt).toISOString(),
    });
    onSuccess();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-lg border border-white/10">
          <Button
            type="button"
            variant="ghost"
            className={`w-full ${form.watch("type") === "EXPENSE" ? "bg-rose-500/20 text-rose-400" : "text-muted-foreground"}`}
            onClick={() => form.setValue("type", "EXPENSE")}
          >
            Expense
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={`w-full ${form.watch("type") === "INCOME" ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground"}`}
            onClick={() => form.setValue("type", "INCOME")}
          >
            Income
          </Button>
        </div>

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="0.00" {...field} className="bg-white/5 border-white/10 text-xl font-medium" />
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-popover border-white/10">
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
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
                <Input placeholder="e.g. Groceries" {...field} className="bg-white/5 border-white/10" />
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
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Input placeholder="Details" {...field} className="bg-white/5 border-white/10" />
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
                <Input type="date" {...field} className="bg-white/5 border-white/10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl py-6">
          Save Transaction
        </Button>
      </form>
    </Form>
  );
}
