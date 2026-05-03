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
  createdAt: string;
  updatedAt: string;
}
