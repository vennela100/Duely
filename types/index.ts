export type CustomerStatus = 'active' | 'completed' | 'defaulted' | 'paused';

export type PaymentMethod = 'cash' | 'upi' | 'other';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  phoneRaw: string;
  address?: string;
  photo?: string;

  dealAmount: number;
  givenAmount: number;
  dailyAmount: number;
  collectionDays: number;
  startDate: string;
  endDate: string;

  status: CustomerStatus;
  totalCollected: number;
  daysCollected: number;
  lastCollectionDate?: string;

  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export type EntryKind = 'received' | 'given';

export interface CollectionEntry {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  collectedAt: string;
  method: PaymentMethod;
  notes?: string;
  smsSent: boolean;
  dayNumber: number;
  // 'received' = customer paid you (reduces due). 'given' = you lent more (raises due).
  // Optional for back-compat with entries saved before this field existed (treat as received).
  kind?: EntryKind;
}

export interface DailySummary {
  date: string;
  totalCollected: number;
  customersCollected: number;
  entries: CollectionEntry[];
}

export interface CustomerDealInput {
  dealAmount: number;
  givenAmount: number;
  collectionDays: number;
  startDate: string;
}

export interface NewCustomerInput {
  name: string;
  phone: string;
  phoneRaw: string;
  address?: string;
  photo?: string;
  notes?: string;
  deal: CustomerDealInput;
}
