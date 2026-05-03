import { db } from './db';
import { format } from 'date-fns';

export async function seedDatabase() {
  const isSeeded = localStorage.getItem('viniverse-seeded');
  if (isSeeded) return;

  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const formattedNow = now.toISOString();

  await db.accounts.bulkAdd([
    {
      id: 'acc-1',
      name: 'Chase Checking',
      type: 'CHECKING',
      currencyCode: 'USD',
      initialBalanceCents: 500000,
      createdAt: formattedNow,
      updatedAt: formattedNow,
    },
    {
      id: 'acc-2',
      name: 'Cash Wallet',
      type: 'CASH',
      currencyCode: 'USD',
      initialBalanceCents: 20000,
      createdAt: formattedNow,
      updatedAt: formattedNow,
    },
    {
      id: 'acc-3',
      name: 'Brazil Investments',
      type: 'INVESTMENT',
      currencyCode: 'BRL',
      initialBalanceCents: 1500000,
      createdAt: formattedNow,
      updatedAt: formattedNow,
    },
  ]);

  await db.transactions.bulkAdd([
    {
      id: crypto.randomUUID(),
      type: 'INCOME',
      amountCents: 350000,
      currencyCode: 'USD',
      accountId: 'acc-1',
      category: 'Salary',
      description: 'Tech Corp Inc.',
      occurredAt: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      createdAt: formattedNow,
      updatedAt: formattedNow,
    },
    {
      id: crypto.randomUUID(),
      type: 'EXPENSE',
      amountCents: 150000,
      currencyCode: 'USD',
      accountId: 'acc-1',
      category: 'Housing',
      description: 'Rent',
      occurredAt: new Date(now.getFullYear(), now.getMonth(), 2).toISOString(),
      createdAt: formattedNow,
      updatedAt: formattedNow,
    },
    {
      id: crypto.randomUUID(),
      type: 'EXPENSE',
      amountCents: 12050,
      currencyCode: 'USD',
      accountId: 'acc-1',
      category: 'Food',
      description: 'Whole Foods Market',
      occurredAt: new Date(now.getFullYear(), now.getMonth(), 5).toISOString(),
      createdAt: formattedNow,
      updatedAt: formattedNow,
    },
    {
      id: crypto.randomUUID(),
      type: 'EXPENSE',
      amountCents: 1599,
      currencyCode: 'USD',
      accountId: 'acc-1',
      category: 'Subscriptions',
      description: 'Netflix',
      occurredAt: new Date(now.getFullYear(), now.getMonth(), 10).toISOString(),
      createdAt: formattedNow,
      updatedAt: formattedNow,
    },
    {
      id: crypto.randomUUID(),
      type: 'INCOME',
      amountCents: 50000,
      currencyCode: 'BRL',
      accountId: 'acc-3',
      category: 'Investment',
      description: 'Dividends',
      occurredAt: lastMonth.toISOString(),
      createdAt: formattedNow,
      updatedAt: formattedNow,
    },
  ]);

  localStorage.setItem('viniverse-seeded', 'true');
}
