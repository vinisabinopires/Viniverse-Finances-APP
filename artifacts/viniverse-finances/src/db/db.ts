import Dexie, { Table } from 'dexie';
import { Account, Transaction } from '../types';

class ViniverseDB extends Dexie {
  accounts!: Table<Account>;
  transactions!: Table<Transaction>;

  constructor() {
    super('viniverse-finances');
    this.version(1).stores({
      accounts: 'id, type, currencyCode, createdAt',
      transactions: 'id, type, accountId, currencyCode, occurredAt, createdAt',
    });
  }
}

export const db = new ViniverseDB();
