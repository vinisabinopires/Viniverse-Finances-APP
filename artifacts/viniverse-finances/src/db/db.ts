import Dexie, { Table } from 'dexie';
import { Account, Transaction, Budget, RecurringRule } from '../types';

class ViniverseDB extends Dexie {
  accounts!: Table<Account>;
  transactions!: Table<Transaction>;
  budgets!: Table<Budget>;
  recurringRules!: Table<RecurringRule>;

  constructor() {
    super('viniverse-finances');
    this.version(1).stores({
      accounts: 'id, type, currencyCode, createdAt',
      transactions: 'id, type, accountId, currencyCode, occurredAt, createdAt',
    });
    this.version(2).stores({
      accounts: 'id, type, currencyCode, createdAt',
      transactions: 'id, type, accountId, currencyCode, occurredAt, createdAt',
      budgets: 'id, category, currencyCode, month, createdAt',
    });
    this.version(3).stores({
      accounts: 'id, type, currencyCode, createdAt',
      transactions: 'id, type, accountId, currencyCode, occurredAt, recurringOccurrenceKey, createdAt',
      budgets: 'id, category, currencyCode, month, createdAt',
      recurringRules: 'id, type, accountId, frequency, isActive, createdAt',
    });
  }
}

export const db = new ViniverseDB();
