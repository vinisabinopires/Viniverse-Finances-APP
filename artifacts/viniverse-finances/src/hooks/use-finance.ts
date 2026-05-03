import { useState, useEffect } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../db/db';
import type { Account, Transaction, Budget } from '../types';

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

export async function addTransaction(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString();
  await db.transactions.add({ id: crypto.randomUUID(), ...data, createdAt: now, updatedAt: now });
}

export async function updateTransaction(id: string, data: Partial<Transaction>) {
  const now = new Date().toISOString();
  await db.transactions.update(id, { ...data, updatedAt: now });
}

export async function addAccount(data: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString();
  await db.accounts.add({ id: crypto.randomUUID(), ...data, createdAt: now, updatedAt: now });
}

export async function updateAccount(id: string, data: Partial<Account>) {
  const now = new Date().toISOString();
  await db.accounts.update(id, { ...data, updatedAt: now });
}

export async function deleteTransaction(id: string) {
  await db.transactions.delete(id);
}

export async function deleteAccount(id: string) {
  await db.accounts.delete(id);
}

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

export async function clearAllData() {
  await db.transactions.clear();
  await db.accounts.clear();
  await db.budgets.clear();
  localStorage.removeItem('viniverse-seeded');
}
