import type { Customer, CustomerStatus } from '@/types';
import { addDaysISO } from './date';

export const calcDailyAmount = (dealAmount: number, days: number): number => {
  if (days <= 0) return 0;
  return Math.round((dealAmount / days) * 100) / 100;
};

export const calcEndDate = (startISO: string, days: number): string =>
  addDaysISO(startISO, Math.max(days - 1, 0));

export const calcProfit = (deal: number, given: number): number => deal - given;

export const calcProfitPct = (deal: number, given: number): number => {
  if (given <= 0) return 0;
  return ((deal - given) / given) * 100;
};

export const remainingAmount = (c: Pick<Customer, 'dealAmount' | 'totalCollected'>): number =>
  Math.max(c.dealAmount - c.totalCollected, 0);

export const progressPct = (
  c: Pick<Customer, 'dealAmount' | 'totalCollected'>,
): number => {
  if (c.dealAmount <= 0) return 0;
  return Math.min((c.totalCollected / c.dealAmount) * 100, 100);
};

export const deriveStatus = (
  c: Pick<Customer, 'dealAmount' | 'totalCollected' | 'status'>,
): CustomerStatus => {
  if (c.status === 'paused' || c.status === 'defaulted') return c.status;
  if (c.totalCollected >= c.dealAmount) return 'completed';
  return 'active';
};
