import { useState, useEffect } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../db/db';
import type { Account, Transaction, Budget, RecurringRule, RecurringFrequency } from '../types';

export { db };

function useDexieLiveQuery<T>(querier: () => T | Promise<T>, defaultValue: T): T {
  const [result, setResult] = useState<T>(defaultValue);

  useEffect(() => {
    const subscription = liveQuery(querier).subscribe({
      next: (value) => setResult(value as T),
      error: (err) => console.error('Dexie liveQuery error:', err),
    });
    return () => subscription.unsubscribe();
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

// ─── Generation logic ─────────────────────────────────────────────────────────

function advanceDate(date: Date, frequency: RecurringFrequency): void {
  switch (frequency) {
    case 'WEEKLY':   date.setDate(date.getDate() + 7);         break;
    case 'BIWEEKLY': date.setDate(date.getDate() + 14);        break;
    case 'MONTHLY':  date.setMonth(date.getMonth() + 1);       break;
    case 'YEARLY':   date.setFullYear(date.getFullYear() + 1); break;
  }
}

/** All YYYY-MM-DD occurrence strings from startDate up to (and including) upTo. */
function getOccurrenceDates(rule: RecurringRule, upTo: Date): string[] {
  const dates: string[] = [];
  const start = new Date(rule.startDate + 'T12:00:00');
  const endDate = rule.endDate ? new Date(rule.endDate + 'T12:00:00') : null;
  const cutoff = endDate && endDate < upTo ? endDate : upTo;

  let current = new Date(start);
  let guard = 0;
  while (current <= cutoff && guard < 500) {
    dates.push(current.toISOString().slice(0, 10));
    advanceDate(current, rule.frequency);
    guard++;
  }
  return dates;
}

/** The next occurrence date AFTER `after`. Returns null if the rule has ended. */
export function getNextOccurrenceAfter(rule: RecurringRule, after: Date): Date | null {
  const start = new Date(rule.startDate + 'T12:00:00');
  const endDate = rule.endDate ? new Date(rule.endDate + 'T12:00:00') : null;

  let current = new Date(start);
  let guard = 0;
  while (current <= after && guard < 1000) {
    advanceDate(current, rule.frequency);
    guard++;
  }

  if (endDate && current > endDate) return null;
  return current;
}

export interface GenerateResult {
  created: number;
  skipped: number;
}

export async function generateDueTransactions(rules: RecurringRule[]): Promise<GenerateResult> {
  const now = new Date().toISOString();
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let created = 0;
  let skipped = 0;

  for (const rule of rules) {
    if (!rule.isActive) continue;

    const dates = getOccurrenceDates(rule, today);

    for (const dateStr of dates) {
      const key = `${rule.id}:${dateStr}`;
      const existing = await db.transactions
        .where('recurringOccurrenceKey')
        .equals(key)
        .count();

      if (existing > 0) {
        skipped++;
        continue;
      }

      await db.transactions.add({
        id: crypto.randomUUID(),
        type: rule.type,
        amountCents: rule.amountCents,
        currencyCode: rule.currencyCode,
        accountId: rule.accountId,
        category: rule.category,
        description: rule.description || rule.name,
        notes: rule.notes,
        occurredAt: new Date(dateStr + 'T12:00:00').toISOString(),
        recurringRuleId: rule.id,
        recurringOccurrenceKey: key,
        createdAt: now,
        updatedAt: now,
      });
      created++;
    }
  }

  return { created, skipped };
}

// ─── Clear All ────────────────────────────────────────────────────────────────

export async function clearAllData() {
  await db.transactions.clear();
  await db.accounts.clear();
  await db.budgets.clear();
  await db.recurringRules.clear();
  localStorage.removeItem('viniverse-seeded');
}
