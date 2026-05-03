import { format } from 'date-fns';
import type { RecurringFrequency } from '@/types';

export function formatMoney(cents: number, currency: 'USD' | 'BRL'): string {
  const amount = cents / 100;
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  } else {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  }
}

export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'MMM d, yyyy');
}

export function formatMonthYear(dateStr: string): string {
  return format(new Date(dateStr), 'MMMM yyyy');
}

export function formatFrequency(freq: RecurringFrequency): string {
  switch (freq) {
    case 'WEEKLY':   return 'Weekly';
    case 'BIWEEKLY': return 'Every 2 Weeks';
    case 'MONTHLY':  return 'Monthly';
    case 'YEARLY':   return 'Yearly';
  }
}
