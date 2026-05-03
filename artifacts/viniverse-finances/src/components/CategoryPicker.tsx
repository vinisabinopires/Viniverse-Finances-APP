import { useState } from "react";
import { Input } from "@/components/ui/input";

const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Refund",
  "Investment Return",
  "Other Income",
];

const EXPENSE_CATEGORIES = [
  "Rent",
  "Groceries",
  "Dining",
  "Transportation",
  "Gas",
  "Subscriptions",
  "Phone",
  "Internet",
  "Health",
  "Shopping",
  "Entertainment",
  "Education",
  "Travel",
  "Other Expense",
];

interface CategoryPickerProps {
  value: string;
  onChange: (value: string) => void;
  transactionType: "INCOME" | "EXPENSE";
}

export function CategoryPicker({ value, onChange, transactionType }: CategoryPickerProps) {
  const presets = transactionType === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const isPreset = presets.includes(value);
  const [showCustom, setShowCustom] = useState(!isPreset && value !== "");

  const handlePreset = (cat: string) => {
    onChange(cat);
    setShowCustom(false);
  };

  const handleCustomToggle = () => {
    setShowCustom(true);
    onChange("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => handlePreset(cat)}
            data-testid={`category-chip-${cat.toLowerCase().replace(/\s+/g, '-')}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              value === cat
                ? transactionType === "INCOME"
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : "bg-rose-500/20 border-rose-500/40 text-rose-300"
                : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
        <button
          type="button"
          onClick={handleCustomToggle}
          data-testid="category-chip-custom"
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            showCustom
              ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
              : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground"
          }`}
        >
          Custom...
        </button>
      </div>
      {showCustom && (
        <Input
          placeholder="Type a custom category"
          value={isPreset ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          data-testid="input-category-custom"
          className="bg-white/5 border-white/10"
        />
      )}
    </div>
  );
}
