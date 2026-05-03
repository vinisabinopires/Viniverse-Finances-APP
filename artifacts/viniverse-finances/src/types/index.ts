export interface Account {
  id: string;
  name: string;
  type: 'CHECKING' | 'SAVINGS' | 'CASH' | 'INVESTMENT' | 'CREDIT_CARD';
  currencyCode: 'USD' | 'BRL';
  initialBalanceCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  amountCents: number;
  currencyCode: 'USD' | 'BRL';
  accountId: string;
  category: string;
  description: string;
  notes?: string;
  occurredAt: string;
  recurringRuleId?: string;
  recurringOccurrenceKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  category: string;
  currencyCode: 'USD' | 'BRL';
  monthlyLimitCents: number;
  month: string; // YYYY-MM
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type RecurringFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'YEARLY';

export type GoalType = 'EMERGENCY_FUND' | 'SAVINGS' | 'INVESTMENT' | 'TRAVEL' | 'DEBT_PAYOFF' | 'CUSTOM';

export interface FinancialGoal {
  id: string;
  name: string;
  goalType: GoalType;
  targetAmountCents: number;
  currentAmountCents: number;
  currencyCode: 'USD' | 'BRL';
  targetDate?: string; // YYYY-MM-DD
  notes?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NetWorthAccountBreakdown {
  accountId: string;
  accountName: string;
  accountType: string;
  currencyCode: 'USD' | 'BRL';
  balanceCents: number;
}

export interface NetWorthSnapshot {
  id: string;
  snapshotDate: string; // YYYY-MM-DD
  totalUsdCents: number;
  totalBrlCents: number;
  exchangeRateBrlPerUsd?: number;
  totalConvertedToUsdCents?: number;
  totalConvertedToBrlCents?: number;
  accountBreakdown: NetWorthAccountBreakdown[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyPlan {
  id: string;
  weekStartDate: string; // YYYY-MM-DD (Monday)
  weekEndDate: string;   // YYYY-MM-DD (Sunday)
  currencyCode: 'USD' | 'BRL';
  expectedIncomeCents: number;
  plannedFixedExpensesCents: number;
  plannedVariableSpendingCents: number;
  plannedSavingsCents: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringRule {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  amountCents: number;
  currencyCode: 'USD' | 'BRL';
  accountId: string;
  category: string;
  description: string;
  notes?: string;
  frequency: RecurringFrequency;
  startDate: string; // YYYY-MM-DD
  endDate?: string;  // YYYY-MM-DD
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuickTemplate {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  amountCents?: number;
  currencyCode: 'USD' | 'BRL';
  accountId?: string;
  category: string;
  description?: string;
  notes?: string;
  icon?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
