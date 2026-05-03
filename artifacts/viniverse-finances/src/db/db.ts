import Dexie, { Table } from 'dexie';
import { Account, Transaction, Budget } from '../types';

class ViniverseDB extends Dexie {
  accounts!: Table<Account>;
  transactions!: Table<Transaction>;
  budgets!: Table<Budget>;

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
  }
}

export const db = new ViniverseDB();
