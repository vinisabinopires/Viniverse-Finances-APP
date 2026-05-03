import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { addAccount, updateAccount } from "@/hooks/use-finance";
import type { Account } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["CHECKING", "SAVINGS", "CASH", "INVESTMENT", "CREDIT_CARD"]),
  currencyCode: z.enum(["USD", "BRL"]),
  initialBalance: z
    .string()
    .min(1, "Required")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, { message: "Enter a valid amount" }),
});

type FormData = z.infer<typeof schema>;

interface AccountFormProps {
  onSuccess: () => void;
  onCancel?: () => void;
  editAccount?: Account;
}

export function AccountForm({ onSuccess, onCancel, editAccount }: AccountFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editAccount
      ? {
          name: editAccount.name,
          type: editAccount.type,
          currencyCode: editAccount.currencyCode,
          initialBalance: (editAccount.initialBalanceCents / 100).toFixed(2),
        }
      : {
          name: "",
          type: "CHECKING",
          currencyCode: "USD",
          initialBalance: "0",
        },
  });

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      type: data.type,
      currencyCode: data.currencyCode,
      initialBalanceCents: Math.round(parseFloat(data.initialBalance) * 100),
    };

    if (editAccount) {
      await updateAccount(editAccount.id, payload);
    } else {
      await addAccount(payload);
    }
    onSuccess();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Chase Checking"
                  data-testid="input-account-name"
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
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white/5 border-white/10" data-testid="select-account-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-popover border-white/10">
                  <SelectItem value="CHECKING">Checking</SelectItem>
                  <SelectItem value="SAVINGS">Savings</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="INVESTMENT">Investment</SelectItem>
                  <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="initialBalance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Initial Balance</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    placeholder="0.00"
                    data-testid="input-initial-balance"
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
            name="currencyCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-white/5 border-white/10" data-testid="select-currency">
                      <SelectValue placeholder="Currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-popover border-white/10">
                    <SelectItem value="USD">USD — US Dollar ($)</SelectItem>
                    <SelectItem value="BRL">BRL — Real (R$)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-2 pt-1">
          <Button
            type="submit"
            data-testid="btn-save-account"
            disabled={form.formState.isSubmitting}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl py-6 font-semibold disabled:opacity-60"
          >
            {form.formState.isSubmitting ? "Saving…" : editAccount ? "Save Changes" : "Add Account"}
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
