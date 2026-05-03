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
