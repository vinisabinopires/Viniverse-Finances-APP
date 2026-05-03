import { useState, useEffect } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../db/db';
import type {
  Account, Transaction, Budget, RecurringRule, RecurringFrequency,
  FinancialGoal, NetWorthSnapshot, NetWorthAccountBreakdown,
} from '../types';

export { db };

function useDexieLiveQuery<T>(querier: () => T | Promise<T>, defaultValue: T): T {
  const [result, setResult] = useState<T>(defaultValue);
  useEffect(() => {
    const sub = liveQuery(querier).subscribe({
      next: (v) => setResult(v as T),
      error: (err) => console.error('Dexie liveQuery error:', err),
    });
    return () => sub.unsubscribe();
  }, []);
  return result;
}

export function useLiveAccounts(): Account[] {
  return useDexieLiveQuery(() => db.accounts.toArray(), []);
}

export function useLiveTransactions(): Transaction[] {
  return useDexieLiveQuery(() => db.transactions.reverse().sortBy('occurredAt'), []);
}

export function useLiveBudgets(): Budget[] {
  return useDexieLiveQuery(() => db.budgets.orderBy('createdAt').reverse().toArray(), []);
}

export function useLiveRecurringRules(): RecurringRule[] {
  return useDexieLiveQuery(() => db.recurringRules.orderBy('createdAt').reverse().toArray(), []);
}

export function useLiveGoals(): FinancialGoal[] {
  return useDexieLiveQuery(() => db.financialGoals.orderBy('createdAt').toArray(), []);
}

export function useLiveSnapshots(): NetWorthSnapshot[] {
  return useDexieLiveQuery(
    () => db.netWorthSnapshots.orderBy('snapshotDate').reverse().toArray(),
    [],
  );
}

// ─── Transactions ────────────────────────────────────────────────────────────

export async function addTransaction(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString();
  await db.transactions.add({ id: crypto.randomUUID(), ...data, createdAt: now, updatedAt: now });
}

export async function updateTransaction(id: string, data: Partial<Transaction>) {
  const now = new Date().toISOString();
  await db.transactions.update(id, { ...data, updatedAt: now });
}

export async function deleteTransaction(id: string) {
  await db.transactions.delete(id);
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export async function addAccount(data: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString();
  await db.accounts.add({ id: crypto.randomUUID(), ...data, createdAt: now, updatedAt: now });
}

export async function updateAccount(id: string, data: Partial<Account>) {
  const now = new Date().toISOString();
  await db.accounts.update(id, { ...data, updatedAt: now });
}

export async function deleteAccount(id: string) {
  await db.accounts.delete(id);
}

// ─── Budgets ─────────────────────────────────────────────────────────────────

export async function addBudget(data: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString();
  await db.budgets.add({ id: crypto.randomUUID(), ...data, createdAt: now, updatedAt: now });
}

export async function updateBudget(id: string, data: Partial<Budget>) {
  const now = new Date().toISOString();
  await db.budgets.update(id, { ...data, updatedAt: now });
}

export async function deleteBudget(id: string) {
  await db.budgets.delete(id);
}

export function calcBudgetSpent(
  transactions: Transaction[],
  category: string,
  month: string,
  currencyCode: 'USD' | 'BRL',
): number {
  return transactions
    .filter(
      (t) =>
        t.type === 'EXPENSE' &&
        t.currencyCode === currencyCode &&
        t.occurredAt.slice(0, 7) === month &&
        t.category.toLowerCase() === category.toLowerCase(),
    )
    .reduce((sum, t) => sum + t.amountCents, 0);
}

// ─── Recurring Rules ──────────────────────────────────────────────────────────

export async function addRecurringRule(data: Omit<RecurringRule, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString();
  await db.recurringRules.add({ id: crypto.randomUUID(), ...data, createdAt: now, updatedAt: now });
}

export async function updateRecurringRule(id: string, data: Partial<RecurringRule>) {
  const now = new Date().toISOString();
  await db.recurringRules.update(id, { ...data, updatedAt: now });
}

export async function deleteRecurringRule(id: string) {
  await db.recurringRules.delete(id);
}

function advanceDate(date: Date, frequency: RecurringFrequency): void {
  switch (frequency) {
    case 'WEEKLY':   date.setDate(date.getDate() + 7);         break;
    case 'BIWEEKLY': date.setDate(date.getDate() + 14);        break;
    case 'MONTHLY':  date.setMonth(date.getMonth() + 1);       break;
    case 'YEARLY':   date.setFullYear(date.getFullYear() + 1); break;
  }
}

function getOccurrenceDates(rule: RecurringRule, upTo: Date): string[] {
  const dates: string[] = [];
  const start   = new Date(rule.startDate + 'T12:00:00');
  const endDate = rule.endDate ? new Date(rule.endDate + 'T12:00:00') : null;
  const cutoff  = endDate && endDate < upTo ? endDate : upTo;
  let current = new Date(start);
  let guard = 0;
  while (current <= cutoff && guard < 500) {
    dates.push(current.toISOString().slice(0, 10));
    advanceDate(current, rule.frequency);
    guard++;
  }
  return dates;
}

export function getNextOccurrenceAfter(rule: RecurringRule, after: Date): Date | null {
  const start   = new Date(rule.startDate + 'T12:00:00');
  const endDate = rule.endDate ? new Date(rule.endDate + 'T12:00:00') : null;
  let current = new Date(start);
  let guard = 0;
  while (current <= after && guard < 1000) { advanceDate(current, rule.frequency); guard++; }
  if (endDate && current > endDate) return null;
  return current;
}

export interface GenerateResult { created: number; skipped: number; }

export async function generateDueTransactions(rules: RecurringRule[]): Promise<GenerateResult> {
  const now = new Date().toISOString();
  const today = new Date(); today.setHours(23, 59, 59, 999);
  let created = 0; let skipped = 0;
  for (const rule of rules) {
    if (!rule.isActive) continue;
    for (const dateStr of getOccurrenceDates(rule, today)) {
      const key = `${rule.id}:${dateStr}`;
      if (await db.transactions.where('recurringOccurrenceKey').equals(key).count() > 0) { skipped++; continue; }
      await db.transactions.add({
        id: crypto.randomUUID(), type: rule.type, amountCents: rule.amountCents,
        currencyCode: rule.currencyCode, accountId: rule.accountId,
        category: rule.category, description: rule.description || rule.name,
        notes: rule.notes, occurredAt: new Date(dateStr + 'T12:00:00').toISOString(),
        recurringRuleId: rule.id, recurringOccurrenceKey: key, createdAt: now, updatedAt: now,
      });
      created++;
    }
  }
  return { created, skipped };
}

// ─── Financial Goals ──────────────────────────────────────────────────────────

export async function addGoal(data: Omit<FinancialGoal, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString();
  await db.financialGoals.add({ id: crypto.randomUUID(), ...data, createdAt: now, updatedAt: now });
}

export async function updateGoal(id: string, data: Partial<FinancialGoal>) {
  const now = new Date().toISOString();
  await db.financialGoals.update(id, { ...data, updatedAt: now });
}

export async function deleteGoal(id: string) {
  await db.financialGoals.delete(id);
}

// ─── Net Worth ────────────────────────────────────────────────────────────────

/** Calculate a single account's current balance from initial + all its transactions. */
export function calcAccountBalance(account: Account, transactions: Transaction[]): number {
  const accTx  = transactions.filter((t) => t.accountId === account.id);
  const income  = accTx.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amountCents, 0);
  const expense = accTx.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amountCents, 0);
  return account.initialBalanceCents + income - expense;
}

export interface NetWorthTotals {
  totalUsdCents: number;
  totalBrlCents: number;
  breakdown: NetWorthAccountBreakdown[];
}

export function calcNetWorth(accounts: Account[], transactions: Transaction[]): NetWorthTotals {
  let totalUsdCents = 0;
  let totalBrlCents = 0;
  const breakdown: NetWorthAccountBreakdown[] = [];
  for (const account of accounts) {
    const balanceCents = calcAccountBalance(account, transactions);
    if (account.currencyCode === 'USD') totalUsdCents += balanceCents;
    else totalBrlCents += balanceCents;
    breakdown.push({
      accountId:   account.id,
      accountName: account.name,
      accountType: account.type,
      currencyCode: account.currencyCode,
      balanceCents,
    });
  }
  return { totalUsdCents, totalBrlCents, breakdown };
}

export async function addSnapshot(data: Omit<NetWorthSnapshot, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString();
  await db.netWorthSnapshots.add({ id: crypto.randomUUID(), ...data, createdAt: now, updatedAt: now });
}

export async function updateSnapshot(id: string, data: Partial<NetWorthSnapshot>) {
  const now = new Date().toISOString();
  await db.netWorthSnapshots.update(id, { ...data, updatedAt: now });
}

export async function deleteSnapshot(id: string) {
  await db.netWorthSnapshots.delete(id);
}

// ─── Clear All ────────────────────────────────────────────────────────────────

export async function clearAllData() {
  await db.transactions.clear();
  await db.accounts.clear();
  await db.budgets.clear();
  await db.recurringRules.clear();
  await db.financialGoals.clear();
  await db.netWorthSnapshots.clear();
  localStorage.removeItem('viniverse-seeded');
}
