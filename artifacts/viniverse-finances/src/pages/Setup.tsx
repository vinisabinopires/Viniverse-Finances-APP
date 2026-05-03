import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ChevronLeft, Plus, X, CheckCircle2, Sparkles,
  Shield, AlertTriangle, ArrowRight, Wallet, CreditCard, TrendingUp, Check, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  useLiveAccounts, addRecurringRule, addBudget, addGoal, clearAllData, db,
  generateDueTransactions,
} from "@/hooks/use-finance";
import type { Account, RecurringFrequency, GoalType } from "@/types";
import type { GenerateResult } from "@/hooks/use-finance";
import { GOAL_TYPE_META } from "@/constants/goals";
import { formatMoney, formatFrequency } from "@/utils";

// ── Wizard types ──────────────────────────────────────────────────────────────

interface WizardAccount {
  tempId: string;
  name: string;
  type: Account["type"];
  currencyCode: "USD" | "BRL";
  initialBalanceCents: number;
}

interface WizardRule {
  name: string;
  type: "INCOME" | "EXPENSE";
  amountCents: number;
  currencyCode: "USD" | "BRL";
  accountRef: string; // "e:{id}" existing | "n:{tempId}" new
  category: string;
  frequency: RecurringFrequency;
  startDate: string;
  notes?: string;
}

interface WizardBudget {
  category: string;
  currencyCode: "USD" | "BRL";
  monthlyLimitCents: number;
}

interface WizardGoal {
  name: string;
  goalType: GoalType;
  targetAmountCents: number;
  currentAmountCents: number;
  currencyCode: "USD" | "BRL";
  targetDate?: string;
  notes?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_LABELS = ["Welcome", "Clean Up", "Accounts", "Income", "Fixed Expenses", "Budgets", "Goals", "Review"];
const TOTAL_STEPS = STEP_LABELS.length;

const ACC_TYPES: { value: Account["type"]; label: string }[] = [
  { value: "CHECKING",    label: "Checking"    },
  { value: "SAVINGS",     label: "Savings"     },
  { value: "CASH",        label: "Cash"        },
  { value: "INVESTMENT",  label: "Investment"  },
  { value: "CREDIT_CARD", label: "Credit Card" },
];

const FREQUENCIES: { value: RecurringFrequency; label: string }[] = [
  { value: "WEEKLY",   label: "Weekly"   },
  { value: "BIWEEKLY", label: "Biweekly" },
  { value: "MONTHLY",  label: "Monthly"  },
  { value: "YEARLY",   label: "Yearly"   },
];

const ACC_TEMPLATES: { label: string; type: Account["type"]; currencyCode: "USD" | "BRL" }[] = [
  { label: "US Checking",        type: "CHECKING",    currencyCode: "USD" },
  { label: "US Savings",         type: "SAVINGS",     currencyCode: "USD" },
  { label: "Cash Wallet",        type: "CASH",        currencyCode: "USD" },
  { label: "Credit Card",        type: "CREDIT_CARD", currencyCode: "USD" },
  { label: "Brazil Checking",    type: "CHECKING",    currencyCode: "BRL" },
  { label: "Brazil Savings",     type: "SAVINGS",     currencyCode: "BRL" },
  { label: "Brazil Investments", type: "INVESTMENT",  currencyCode: "BRL" },
];

const INCOME_TEMPLATES: { label: string; frequency: RecurringFrequency; category: string }[] = [
  { label: "Weekly Salary",   frequency: "WEEKLY",   category: "Salary"         },
  { label: "Biweekly Salary", frequency: "BIWEEKLY", category: "Salary"         },
  { label: "Monthly Salary",  frequency: "MONTHLY",  category: "Salary"         },
  { label: "Freelance",       frequency: "MONTHLY",  category: "Freelance Income"},
  { label: "Other Income",    frequency: "MONTHLY",  category: "Other Income"   },
];

const EXPENSE_TEMPLATES: { label: string; category: string }[] = [
  { label: "Rent",         category: "Housing"       },
  { label: "Internet",     category: "Utilities"     },
  { label: "Phone",        category: "Phone"         },
  { label: "Apple/iCloud", category: "Subscriptions" },
  { label: "Apple Music",  category: "Subscriptions" },
  { label: "AppleCare",    category: "Insurance"     },
  { label: "Gas",          category: "Gas"           },
  { label: "Insurance",    category: "Insurance"     },
  { label: "Netflix",      category: "Subscriptions" },
  { label: "Subscriptions",category: "Subscriptions" },
];

const EXPENSE_CATS = [
  "Housing","Utilities","Phone","Gas","Insurance",
  "Subscriptions","Health","Education","Transportation",
  "Groceries","Dining","Shopping","Other Expense",
];

const BUDGET_CATS = [
  "Groceries","Dining","Transportation","Gas","Shopping",
  "Entertainment","Travel","Health","Education","Subscriptions","Other Expense",
];

const GOAL_TYPE_LIST: { value: GoalType; label: string }[] = [
  { value: "EMERGENCY_FUND", label: "Emergency Fund" },
  { value: "SAVINGS",        label: "Savings"        },
  { value: "INVESTMENT",     label: "Investment"     },
  { value: "TRAVEL",         label: "Travel"         },
  { value: "DEBT_PAYOFF",    label: "Debt Payoff"    },
  { value: "CUSTOM",         label: "Custom"         },
];

const todayStr = new Date().toISOString().slice(0, 10);
const toCents  = (v: string) => Math.round(parseFloat(v.replace(",", ".") || "0") * 100);

// Shared dark select class
const SEL = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer";

// ── Main component ────────────────────────────────────────────────────────────

export default function Setup() {
  const [, setLocation] = useLocation();
  const { toast }        = useToast();
  const existingAccounts = useLiveAccounts();

  // Navigation
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  // Step 1 – clean data
  const [cleanOption, setCleanOption] = useState<"keep" | "demo" | "fresh">("keep");
  const [deleteInput,  setDeleteInput]  = useState("");
  const isSeeded = !!localStorage.getItem("viniverse-seeded");

  // Step 2 – accounts form
  const [newAccounts, setNewAccounts] = useState<WizardAccount[]>([]);
  const [accName,    setAccName]    = useState("");
  const [accType,    setAccType]    = useState<Account["type"]>("CHECKING");
  const [accCurrency,setAccCurrency]= useState<"USD"|"BRL">("USD");
  const [accBalance, setAccBalance] = useState("");

  // Step 3 – income form
  const [incomeRules,  setIncomeRules]  = useState<WizardRule[]>([]);
  const [incName,      setIncName]      = useState("");
  const [incAmount,    setIncAmount]    = useState("");
  const [incCurrency,  setIncCurrency]  = useState<"USD"|"BRL">("USD");
  const [incAccountRef,setIncAccountRef]= useState("");
  const [incFrequency, setIncFrequency] = useState<RecurringFrequency>("MONTHLY");
  const [incCategory,  setIncCategory]  = useState("Salary");
  const [incDate,      setIncDate]      = useState(todayStr);

  // Step 4 – expense form
  const [expenseRules,  setExpenseRules]  = useState<WizardRule[]>([]);
  const [expName,       setExpName]       = useState("");
  const [expAmount,     setExpAmount]     = useState("");
  const [expCurrency,   setExpCurrency]   = useState<"USD"|"BRL">("USD");
  const [expAccountRef, setExpAccountRef] = useState("");
  const [expCategory,   setExpCategory]   = useState("Housing");
  const [expFrequency,  setExpFrequency]  = useState<RecurringFrequency>("MONTHLY");
  const [expDate,       setExpDate]       = useState(todayStr);
  const [expNotes,      setExpNotes]      = useState("");

  // Step 5 – budgets form
  const [budgetItems, setBudgetItems] = useState<WizardBudget[]>([]);
  const [budCategory, setBudCategory] = useState("Groceries");
  const [budCurrency, setBudCurrency] = useState<"USD"|"BRL">("USD");
  const [budLimit,    setBudLimit]    = useState("");

  // Step 6 – goals form
  const [goalItems,   setGoalItems]   = useState<WizardGoal[]>([]);
  const [goalName,    setGoalName]    = useState("");
  const [goalType,    setGoalType]    = useState<GoalType>("SAVINGS");
  const [goalTarget,  setGoalTarget]  = useState("");
  const [goalCurrent, setGoalCurrent] = useState("0");
  const [goalCurrency,setGoalCurrency]= useState<"USD"|"BRL">("USD");
  const [goalDate,    setGoalDate]    = useState("");
  const [goalNotes,   setGoalNotes]   = useState("");

  // Submit
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedCounts,  setSavedCounts]  = useState({ accounts: 0, rules: 0, budgets: 0, goals: 0 });

  // Post-setup generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [genResult,    setGenResult]    = useState<GenerateResult | null>(null);

  // Combined account options for income/expense dropdowns
  const allAccountOptions = [
    ...existingAccounts.map((a) => ({ ref: `e:${a.id}`, label: `${a.name} (${a.currencyCode})` })),
    ...newAccounts.map((a)       => ({ ref: `n:${a.tempId}`, label: `${a.name} (${a.currencyCode}) – new` })),
  ];

  // Auto-select first account when options appear
  useEffect(() => {
    if (allAccountOptions.length > 0 && !incAccountRef) setIncAccountRef(allAccountOptions[0].ref);
  }, [allAccountOptions.length]); // eslint-disable-line

  useEffect(() => {
    if (allAccountOptions.length > 0 && !expAccountRef) setExpAccountRef(allAccountOptions[0].ref);
  }, [allAccountOptions.length]); // eslint-disable-line

  // ── Validation ──────────────────────────────────────────────────────────────
  const step1Valid = cleanOption !== "fresh" || deleteInput === "DELETE";

  // ── Add helpers ─────────────────────────────────────────────────────────────
  const doAddAccount = () => {
    if (!accName.trim()) return;
    setNewAccounts((p) => [...p, { tempId: crypto.randomUUID(), name: accName.trim(), type: accType, currencyCode: accCurrency, initialBalanceCents: toCents(accBalance) }]);
    setAccName(""); setAccBalance("");
  };

  const doAddIncome = () => {
    if (!incName.trim() || toCents(incAmount) <= 0) return;
    const ref = incAccountRef || allAccountOptions[0]?.ref || "";
    setIncomeRules((p) => [...p, { name: incName.trim(), type: "INCOME", amountCents: toCents(incAmount), currencyCode: incCurrency, accountRef: ref, category: incCategory, frequency: incFrequency, startDate: incDate }]);
    setIncName(""); setIncAmount("");
  };

  const doAddExpense = () => {
    if (!expName.trim() || toCents(expAmount) <= 0) return;
    const ref = expAccountRef || allAccountOptions[0]?.ref || "";
    setExpenseRules((p) => [...p, { name: expName.trim(), type: "EXPENSE", amountCents: toCents(expAmount), currencyCode: expCurrency, accountRef: ref, category: expCategory, frequency: expFrequency, startDate: expDate, notes: expNotes || undefined }]);
    setExpName(""); setExpAmount(""); setExpNotes("");
  };

  const doAddBudget = () => {
    if (toCents(budLimit) <= 0) return;
    setBudgetItems((p) => [...p, { category: budCategory, currencyCode: budCurrency, monthlyLimitCents: toCents(budLimit) }]);
    setBudLimit("");
  };

  const doAddGoal = () => {
    if (!goalName.trim() || toCents(goalTarget) <= 0) return;
    setGoalItems((p) => [...p, { name: goalName.trim(), goalType: goalType, targetAmountCents: toCents(goalTarget), currentAmountCents: toCents(goalCurrent || "0"), currencyCode: goalCurrency, targetDate: goalDate || undefined, notes: goalNotes || undefined }]);
    setGoalName(""); setGoalTarget(""); setGoalCurrent("0"); setGoalDate(""); setGoalNotes("");
  };

  // ── Finish ──────────────────────────────────────────────────────────────────
  const handleFinish = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // 1. Handle data cleaning
      if (cleanOption === "fresh") {
        await clearAllData();
        localStorage.setItem("viniverse-onboarded", "true");
      } else if (cleanOption === "demo" && isSeeded) {
        await clearAllData();
      }

      // 2. Create new accounts (pre-generate IDs for reference resolution)
      const accountIdMap = new Map<string, string>();
      const now = new Date().toISOString();
      for (const acc of newAccounts) {
        const id = crypto.randomUUID();
        await db.accounts.add({ id, name: acc.name, type: acc.type, currencyCode: acc.currencyCode, initialBalanceCents: acc.initialBalanceCents, createdAt: now, updatedAt: now });
        accountIdMap.set(acc.tempId, id);
      }

      // Resolve "e:{id}" or "n:{tempId}" → actual DB account id
      const resolveRef = (ref: string): string => {
        if (ref.startsWith("e:")) return ref.slice(2);
        if (ref.startsWith("n:")) return accountIdMap.get(ref.slice(2)) ?? "";
        return "";
      };

      // 3. Create recurring rules
      let ruleCount = 0;
      for (const rule of [...incomeRules, ...expenseRules]) {
        const accountId = resolveRef(rule.accountRef);
        if (!accountId) continue; // skip rules with no resolvable account
        await addRecurringRule({ name: rule.name, type: rule.type, amountCents: rule.amountCents, currencyCode: rule.currencyCode, accountId, category: rule.category, description: rule.name, notes: rule.notes, frequency: rule.frequency, startDate: rule.startDate, isActive: true });
        ruleCount++;
      }

      // 4. Create budgets for current month
      const month = new Date().toISOString().slice(0, 7);
      for (const b of budgetItems) {
        await addBudget({ category: b.category, currencyCode: b.currencyCode, monthlyLimitCents: b.monthlyLimitCents, month });
      }

      // 5. Create goals
      for (const g of goalItems) {
        await addGoal({ name: g.name, goalType: g.goalType, targetAmountCents: g.targetAmountCents, currentAmountCents: g.currentAmountCents, currencyCode: g.currencyCode, targetDate: g.targetDate, notes: g.notes, isArchived: false });
      }

      setSavedCounts({ accounts: newAccounts.length, rules: ruleCount, budgets: budgetItems.length, goals: goalItems.length });
      setDone(true);
    } catch {
      toast({ title: "Setup failed", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Post-setup: generate due recurring transactions ──────────────────────────
  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const allRules = await db.recurringRules.toArray();
      const activeRules = allRules.filter((r) => r.isActive);
      if (activeRules.length === 0) {
        setGenResult({ created: 0, skipped: 0 });
        return;
      }
      const result = await generateDueTransactions(activeRules);
      setGenResult(result);
      toast({
        title: result.created > 0 ? `Generated ${result.created} transaction${result.created !== 1 ? "s" : ""}` : "No new transactions",
        description: result.skipped > 0 ? `${result.skipped} already existed and were skipped.` : undefined,
      });
    } catch {
      toast({ title: "Generation failed", description: "Something went wrong. Try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handleBack = () => {
    if (step === 0) { setLocation("/more"); return; }
    setStep((s) => s - 1);
  };

  const handleNext = () => {
    if (step === TOTAL_STEPS - 1) { handleFinish(); return; }
    if (step === 1 && !step1Valid) return;
    setStep((s) => s + 1);
  };

  // ── Done screen ─────────────────────────────────────────────────────────────
  if (done) {
    const hasRules = savedCounts.rules > 0;

    return (
      <div
        className="min-h-screen bg-background flex flex-col items-center px-4 py-8 gap-5 overflow-y-auto"
        style={{ paddingTop: "max(2rem, env(safe-area-inset-top, 2rem))", paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}
      >
        {/* Success icon */}
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 15 }}
          className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mt-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </motion.div>

        <div className="text-center">
          <h1 className="text-2xl font-bold">Setup Complete!</h1>
          <p className="text-muted-foreground text-sm mt-1">Your real financial profile is ready.</p>
        </div>

        {/* Summary counts */}
        <div className="glass-card rounded-2xl border border-white/10 p-4 w-full max-w-sm text-left space-y-2">
          {([
            { label: "Accounts created", count: savedCounts.accounts },
            { label: "Recurring rules",  count: savedCounts.rules    },
            { label: "Budgets",          count: savedCounts.budgets  },
            { label: "Goals",            count: savedCounts.goals    },
          ] as { label: string; count: number }[]).map(({ label, count }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className={`font-semibold ${count > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>{count}</span>
            </div>
          ))}
        </div>

        {/* ── Activate recurring plan ──────────────────────────────────────── */}
        {hasRules && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="w-full max-w-sm glass-card rounded-2xl border border-indigo-500/25 bg-indigo-500/5 p-4 space-y-3 text-left"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-sm font-semibold text-indigo-300">Activate your recurring plan</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You created recurring income and expense rules. Generate due transactions now to reflect them in your Dashboard, Weekly Cashflow, Budgets, and Monthly Reports.
            </p>

            {/* Result feedback */}
            {genResult !== null && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`rounded-xl px-3 py-2 text-xs font-medium space-y-0.5 ${
                  genResult.created > 0
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    : "bg-white/5 border border-white/10 text-muted-foreground"
                }`}>
                {genResult.created > 0 ? (
                  <p>✓ Created {genResult.created} transaction{genResult.created !== 1 ? "s" : ""}</p>
                ) : (
                  <p>No due transactions found for today.</p>
                )}
                {genResult.skipped > 0 && (
                  <p className="text-muted-foreground">↩ Skipped {genResult.skipped} already existing</p>
                )}
              </motion.div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/25 h-11 rounded-xl font-semibold disabled:opacity-50"
              variant="outline"
            >
              {isGenerating ? (
                <>
                  <Zap className="w-4 h-4 mr-2 animate-pulse" /> Generating…
                </>
              ) : genResult !== null ? (
                <>
                  <Zap className="w-4 h-4 mr-2" /> Run Again
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" /> Generate Due Transactions
                </>
              )}
            </Button>
          </motion.div>
        )}

        {/* Backup reminder */}
        <div className="w-full max-w-sm glass-card rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3 text-left">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400">Export a backup</p>
            <p className="text-xs text-muted-foreground mt-0.5">After adding real financial data, export a backup so your local data can be restored later.</p>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full max-w-sm space-y-2">
          <Button onClick={() => setLocation("/")}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold h-12 rounded-2xl text-base">
            Go to Dashboard
          </Button>
          {genResult !== null && genResult.created > 0 && (
            <Button variant="outline" onClick={() => setLocation("/transactions")}
              className="w-full bg-white/5 border-white/10 hover:bg-white/10 h-11 rounded-2xl">
              View Transactions
            </Button>
          )}
          <Button variant="outline" onClick={() => setLocation("/more")}
            className="w-full bg-white/5 border-white/10 hover:bg-white/10 h-11 rounded-2xl">
            Export Backup in Settings
          </Button>
        </div>
      </div>
    );
  }

  // ── Step content ────────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {

      // ── Welcome ────────────────────────────────────────────────────────────
      case 0:
        return (
          <div className="flex flex-col items-center text-center gap-6 pt-8">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-purple-500/30">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Real Life Setup</h1>
              <p className="text-muted-foreground text-sm mt-2 leading-relaxed max-w-xs mx-auto">
                Replace demo data with your real financial structure — accounts, income, bills, budgets, and goals. You can skip any step and edit everything later.
              </p>
            </div>
            <div className="w-full max-w-xs space-y-3 mt-2">
              <Button onClick={() => setStep(1)} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold h-12 rounded-2xl text-base shadow-lg shadow-purple-500/20">
                Start Setup <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <button onClick={() => setLocation("/more")} className="w-full text-sm text-muted-foreground hover:text-foreground py-2 transition-colors">
                Exit to Settings
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 w-full max-w-xs mt-4">
              {["Accounts","Rules","Budgets","Goals"].map((label) => (
                <div key={label} className="glass-card rounded-xl p-2 text-center border border-white/10">
                  <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
                </div>
              ))}
            </div>
          </div>
        );

      // ── Clean data ─────────────────────────────────────────────────────────
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Clean Up Data</h2>
              <p className="text-muted-foreground text-sm mt-1">Choose how to handle existing data before continuing.</p>
            </div>

            {([
              {
                value: "keep" as const,
                title: "Keep my current data",
                desc: "Keep all existing accounts, transactions, budgets, and settings unchanged.",
                border: "border-emerald-500/25 bg-emerald-500/5",
                selectedBorder: "border-emerald-500/50 bg-emerald-500/10",
              },
              {
                value: "demo" as const,
                title: isSeeded ? "Remove demo/sample data" : "Remove demo data (not detected)",
                desc: isSeeded
                  ? "Clear all sample data that was loaded during onboarding."
                  : "Demo data could not be detected with certainty. Use Start Fresh only if you already exported a backup.",
                border: "border-amber-500/20 bg-amber-500/5",
                selectedBorder: "border-amber-500/50 bg-amber-500/10",
              },
              {
                value: "fresh" as const,
                title: "Start completely fresh",
                desc: "Delete all financial data and begin from zero. Export a backup first!",
                border: "border-rose-500/15 bg-rose-500/5",
                selectedBorder: "border-rose-500/50 bg-rose-500/10",
              },
            ] as { value: "keep"|"demo"|"fresh"; title: string; desc: string; border: string; selectedBorder: string }[]).map(({ value, title, desc, border, selectedBorder }) => (
              <button key={value} onClick={() => setCleanOption(value)}
                className={`w-full p-4 rounded-2xl border text-left transition-all ${cleanOption === value ? selectedBorder : border}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center transition-all ${cleanOption === value ? "border-primary bg-primary" : "border-white/30"}`}>
                    {cleanOption === value && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              </button>
            ))}

            {cleanOption === "fresh" && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-2xl border border-rose-500/25 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <p className="text-sm font-medium text-rose-400">Confirm data deletion</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Type <span className="font-mono font-bold text-rose-400">DELETE</span> to confirm. PIN settings will be preserved.
                </p>
                <Input placeholder="Type DELETE to confirm" value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)}
                  className="bg-white/5 border-rose-500/30 font-mono placeholder:font-sans" />
              </motion.div>
            )}
          </div>
        );

      // ── Accounts ───────────────────────────────────────────────────────────
      case 2:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Your Accounts</h2>
              <p className="text-muted-foreground text-sm mt-1">Add your real bank accounts, wallets, and cards.</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Quick templates</p>
              <div className="flex flex-wrap gap-1.5">
                {ACC_TEMPLATES.map((t) => (
                  <button key={t.label} onClick={() => { setAccName(t.label); setAccType(t.type); setAccCurrency(t.currencyCode); }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/30 transition-all active:scale-95">
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-2xl border border-white/10 p-4 space-y-3">
              <Input placeholder="Account name (e.g. Chase Checking)" value={accName} onChange={(e) => setAccName(e.target.value)} className="bg-white/5 border-white/10" />
              <div className="grid grid-cols-2 gap-2">
                <select value={accType} onChange={(e) => setAccType(e.target.value as Account["type"])} className={SEL}>
                  {ACC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select value={accCurrency} onChange={(e) => setAccCurrency(e.target.value as "USD"|"BRL")} className={SEL}>
                  <option value="USD">USD $</option>
                  <option value="BRL">BRL R$</option>
                </select>
              </div>
              <Input type="number" placeholder="Opening balance (e.g. 1500.00)" value={accBalance} onChange={(e) => setAccBalance(e.target.value)} min="0" step="0.01" className="bg-white/5 border-white/10" />
              <Button onClick={doAddAccount} disabled={!accName.trim()} variant="outline" className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20">
                <Plus className="w-4 h-4 mr-1" /> Add Account
              </Button>
            </div>

            {newAccounts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">To be created ({newAccounts.length})</p>
                {newAccounts.map((acc) => (
                  <div key={acc.tempId} className="glass-card rounded-xl border border-white/10 p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                      <Wallet className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{acc.name}</p>
                      <p className="text-xs text-muted-foreground">{acc.type.replace("_"," ")} · {acc.currencyCode} · {formatMoney(acc.initialBalanceCents, acc.currencyCode)}</p>
                    </div>
                    <button onClick={() => setNewAccounts((p) => p.filter((a) => a.tempId !== acc.tempId))} className="text-muted-foreground hover:text-rose-400 transition-colors p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {newAccounts.length === 0 && existingAccounts.length > 0 && (
              <p className="text-center text-xs text-muted-foreground py-1">
                You have {existingAccounts.length} existing account{existingAccounts.length !== 1 ? "s" : ""}. Add more or tap Continue to skip.
              </p>
            )}
          </div>
        );

      // ── Income ─────────────────────────────────────────────────────────────
      case 3:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Recurring Income</h2>
              <p className="text-muted-foreground text-sm mt-1">Add salary, freelance, and other regular income.</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {INCOME_TEMPLATES.map((t) => (
                <button key={t.label} onClick={() => { setIncName(t.label); setIncFrequency(t.frequency); setIncCategory(t.category); }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/30 transition-all active:scale-95">
                  {t.label}
                </button>
              ))}
            </div>

            {allAccountOptions.length === 0 ? (
              <div className="glass-card rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">No accounts available. Go back and add at least one account, or skip this step and add rules later from Recurring Transactions.</p>
              </div>
            ) : (
              <div className="glass-card rounded-2xl border border-white/10 p-4 space-y-3">
                <Input placeholder="Income name (e.g. Monthly Salary)" value={incName} onChange={(e) => setIncName(e.target.value)} className="bg-white/5 border-white/10" />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="Amount" value={incAmount} onChange={(e) => setIncAmount(e.target.value)} min="0" step="0.01" className="bg-white/5 border-white/10" />
                  <select value={incCurrency} onChange={(e) => setIncCurrency(e.target.value as "USD"|"BRL")} className={SEL}>
                    <option value="USD">USD $</option>
                    <option value="BRL">BRL R$</option>
                  </select>
                </div>
                <select value={incAccountRef || allAccountOptions[0]?.ref || ""} onChange={(e) => setIncAccountRef(e.target.value)} className={SEL}>
                  {allAccountOptions.map((o) => <option key={o.ref} value={o.ref}>{o.label}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select value={incFrequency} onChange={(e) => setIncFrequency(e.target.value as RecurringFrequency)} className={SEL}>
                    {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <Input type="date" value={incDate} onChange={(e) => setIncDate(e.target.value)} className="bg-white/5 border-white/10" />
                </div>
                <Input placeholder="Category (e.g. Salary)" value={incCategory} onChange={(e) => setIncCategory(e.target.value)} className="bg-white/5 border-white/10" />
                <Button onClick={doAddIncome} disabled={!incName.trim() || toCents(incAmount) <= 0} variant="outline"
                  className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                  <Plus className="w-4 h-4 mr-1" /> Add Income Rule
                </Button>
              </div>
            )}

            {incomeRules.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Added ({incomeRules.length})</p>
                {incomeRules.map((r, i) => (
                  <div key={i} className="glass-card rounded-xl border border-white/10 p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{formatMoney(r.amountCents, r.currencyCode)} · {formatFrequency(r.frequency)}</p>
                    </div>
                    <button onClick={() => setIncomeRules((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-rose-400 transition-colors p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      // ── Fixed expenses ─────────────────────────────────────────────────────
      case 4:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Fixed Expenses</h2>
              <p className="text-muted-foreground text-sm mt-1">Add rent, subscriptions, and other recurring bills.</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_TEMPLATES.map((t) => (
                <button key={t.label} onClick={() => { setExpName(t.label); setExpCategory(t.category); }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/30 transition-all active:scale-95">
                  {t.label}
                </button>
              ))}
            </div>

            {allAccountOptions.length === 0 ? (
              <div className="glass-card rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">No accounts available. Go back and add at least one account.</p>
              </div>
            ) : (
              <div className="glass-card rounded-2xl border border-white/10 p-4 space-y-3">
                <Input placeholder="Expense name (e.g. Rent)" value={expName} onChange={(e) => setExpName(e.target.value)} className="bg-white/5 border-white/10" />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="Amount" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} min="0" step="0.01" className="bg-white/5 border-white/10" />
                  <select value={expCurrency} onChange={(e) => setExpCurrency(e.target.value as "USD"|"BRL")} className={SEL}>
                    <option value="USD">USD $</option>
                    <option value="BRL">BRL R$</option>
                  </select>
                </div>
                <select value={expAccountRef || allAccountOptions[0]?.ref || ""} onChange={(e) => setExpAccountRef(e.target.value)} className={SEL}>
                  {allAccountOptions.map((o) => <option key={o.ref} value={o.ref}>{o.label}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select value={expCategory} onChange={(e) => setExpCategory(e.target.value)} className={SEL}>
                    {EXPENSE_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={expFrequency} onChange={(e) => setExpFrequency(e.target.value as RecurringFrequency)} className={SEL}>
                    {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <Input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} className="bg-white/5 border-white/10" />
                <Input placeholder="Notes (optional)" value={expNotes} onChange={(e) => setExpNotes(e.target.value)} className="bg-white/5 border-white/10" />
                <Button onClick={doAddExpense} disabled={!expName.trim() || toCents(expAmount) <= 0} variant="outline"
                  className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20">
                  <Plus className="w-4 h-4 mr-1" /> Add Expense Rule
                </Button>
              </div>
            )}

            {expenseRules.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Added ({expenseRules.length})</p>
                {expenseRules.map((r, i) => (
                  <div key={i} className="glass-card rounded-xl border border-white/10 p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{formatMoney(r.amountCents, r.currencyCode)} · {formatFrequency(r.frequency)} · {r.category}</p>
                    </div>
                    <button onClick={() => setExpenseRules((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-rose-400 transition-colors p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      // ── Budgets ────────────────────────────────────────────────────────────
      case 5:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Monthly Budgets</h2>
              <p className="text-muted-foreground text-sm mt-1">Set spending limits for the current month.</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Tap a category to select</p>
              <div className="flex flex-wrap gap-1.5">
                {BUDGET_CATS.map((cat) => (
                  <button key={cat} onClick={() => setBudCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 ${budCategory === cat ? "bg-primary/20 text-primary border-primary/30" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-2xl border border-white/10 p-4 space-y-3">
              <select value={budCategory} onChange={(e) => setBudCategory(e.target.value)} className={SEL}>
                {BUDGET_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Monthly limit" value={budLimit} onChange={(e) => setBudLimit(e.target.value)} min="0" step="0.01" className="bg-white/5 border-white/10" />
                <select value={budCurrency} onChange={(e) => setBudCurrency(e.target.value as "USD"|"BRL")} className={SEL}>
                  <option value="USD">USD $</option>
                  <option value="BRL">BRL R$</option>
                </select>
              </div>
              <Button onClick={doAddBudget} disabled={toCents(budLimit) <= 0} variant="outline"
                className="w-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20">
                <Plus className="w-4 h-4 mr-1" /> Add Budget
              </Button>
            </div>

            {budgetItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Added ({budgetItems.length})</p>
                {budgetItems.map((b, i) => (
                  <div key={i} className="glass-card rounded-xl border border-white/10 p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{b.category}</p>
                      <p className="text-xs text-muted-foreground">{formatMoney(b.monthlyLimitCents, b.currencyCode)}/mo</p>
                    </div>
                    <button onClick={() => setBudgetItems((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-rose-400 transition-colors p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      // ── Goals ──────────────────────────────────────────────────────────────
      case 6:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Financial Goals</h2>
              <p className="text-muted-foreground text-sm mt-1">Set savings targets and milestones.</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {GOAL_TYPE_LIST.map((t) => (
                <button key={t.value} onClick={() => { setGoalType(t.value); setGoalName(GOAL_TYPE_META[t.value].label); }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/30 transition-all active:scale-95">
                  {GOAL_TYPE_META[t.value].emoji} {t.label}
                </button>
              ))}
            </div>

            <div className="glass-card rounded-2xl border border-white/10 p-4 space-y-3">
              <Input placeholder="Goal name (e.g. Emergency Fund)" value={goalName} onChange={(e) => setGoalName(e.target.value)} className="bg-white/5 border-white/10" />
              <select value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)} className={SEL}>
                {GOAL_TYPE_LIST.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Target amount" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} min="0" step="0.01" className="bg-white/5 border-white/10" />
                <Input type="number" placeholder="Current amount" value={goalCurrent} onChange={(e) => setGoalCurrent(e.target.value)} min="0" step="0.01" className="bg-white/5 border-white/10" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={goalCurrency} onChange={(e) => setGoalCurrency(e.target.value as "USD"|"BRL")} className={SEL}>
                  <option value="USD">USD $</option>
                  <option value="BRL">BRL R$</option>
                </select>
                <Input type="date" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} className="bg-white/5 border-white/10" />
              </div>
              <Input placeholder="Notes (optional)" value={goalNotes} onChange={(e) => setGoalNotes(e.target.value)} className="bg-white/5 border-white/10" />
              <Button onClick={doAddGoal} disabled={!goalName.trim() || toCents(goalTarget) <= 0} variant="outline"
                className="w-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20">
                <Plus className="w-4 h-4 mr-1" /> Add Goal
              </Button>
            </div>

            {goalItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Added ({goalItems.length})</p>
                {goalItems.map((g, i) => {
                  const meta = GOAL_TYPE_META[g.goalType];
                  return (
                    <div key={i} className="glass-card rounded-xl border border-white/10 p-3 flex items-center gap-3">
                      <span className="text-xl flex-shrink-0">{meta.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{g.name}</p>
                        <p className="text-xs text-muted-foreground">{formatMoney(g.targetAmountCents, g.currencyCode)} target · {meta.label}</p>
                      </div>
                      <button onClick={() => setGoalItems((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-rose-400 transition-colors p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      // ── Review ─────────────────────────────────────────────────────────────
      case 7:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Review & Finish</h2>
              <p className="text-muted-foreground text-sm mt-1">Everything ready? Tap Finish Setup to save.</p>
            </div>

            {([
              {
                label: "Data handling",
                value: cleanOption === "keep"
                  ? "Keep existing data"
                  : cleanOption === "demo"
                  ? (isSeeded ? "Remove demo/sample data" : "Keep existing (demo not detected)")
                  : "Start fresh — ALL data will be deleted",
                warn: cleanOption === "fresh",
              },
              { label: "New accounts",     value: newAccounts.length > 0    ? newAccounts.map((a) => a.name).join(", ") : "None",                                        empty: newAccounts.length === 0    },
              { label: "Income rules",     value: incomeRules.length > 0    ? `${incomeRules.length} rule${incomeRules.length !== 1 ? "s" : ""}`    : "None",            empty: incomeRules.length === 0    },
              { label: "Fixed expenses",   value: expenseRules.length > 0   ? `${expenseRules.length} rule${expenseRules.length !== 1 ? "s" : ""}`  : "None",            empty: expenseRules.length === 0   },
              { label: "Budgets",          value: budgetItems.length > 0    ? `${budgetItems.length} budget${budgetItems.length !== 1 ? "s" : ""}`  : "None",            empty: budgetItems.length === 0    },
              { label: "Goals",            value: goalItems.length > 0      ? `${goalItems.length} goal${goalItems.length !== 1 ? "s" : ""}`        : "None",            empty: goalItems.length === 0      },
            ] as { label: string; value: string; warn?: boolean; empty?: boolean }[]).map(({ label, value, warn, empty }) => (
              <div key={label} className={`glass-card rounded-xl border p-3 ${warn ? "border-rose-500/30 bg-rose-500/5" : "border-white/10"}`}>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
                <p className={`text-sm font-medium mt-0.5 leading-relaxed ${warn ? "text-rose-400" : empty ? "text-muted-foreground" : "text-foreground"}`}>{value}</p>
              </div>
            ))}

            {cleanOption === "fresh" && (
              <div className="glass-card rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 flex items-start gap-3">
                <Shield className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-rose-400">All existing data will be deleted</p>
                  <p className="text-xs text-muted-foreground mt-0.5">This cannot be undone. Make sure you have an exported backup.</p>
                </div>
              </div>
            )}

            {newAccounts.length === 0 && incomeRules.length === 0 && expenseRules.length === 0 && budgetItems.length === 0 && goalItems.length === 0 && cleanOption === "keep" && (
              <div className="glass-card rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">Nothing to save. Finishing will not change any data — you can add items by going back.</p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // ── Layout ──────────────────────────────────────────────────────────────────
  const isLastStep = step === TOTAL_STEPS - 1;
  const progress   = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Fixed header with progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={handleBack} aria-label="Back"
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-medium">{STEP_LABELS[step]}</p>
              <p className="text-xs text-muted-foreground">{step + 1} / {TOTAL_STEPS}</p>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 pt-20 pb-32 px-4 overflow-y-auto">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18 }}
        >
          {renderStep()}
        </motion.div>
      </div>

      {/* Fixed footer — not shown on step 0 (has own buttons) */}
      {step > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-white/10 px-4 pt-3 space-y-2"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 1rem))" }}
        >
          <Button
            onClick={handleNext}
            disabled={isSubmitting || (step === 1 && !step1Valid)}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold h-12 rounded-2xl text-base disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : isLastStep ? "Finish Setup" : "Continue"}
            {!isSubmitting && !isLastStep && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
          {/* Skip available on steps 2-6 */}
          {step >= 2 && step <= 6 && (
            <button onClick={() => setStep((s) => s + 1)}
              className="w-full text-sm text-muted-foreground hover:text-foreground pb-1 transition-colors">
              Skip this step
            </button>
          )}
        </div>
      )}
    </div>
  );
}
