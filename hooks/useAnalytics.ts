import { useMemo } from 'react';
import { endOfMonth, startOfMonth } from 'date-fns';
import { useCustomers } from './useCustomers';
import { useEntriesInRange, useTodayCollection } from './useCollection';
import { last7Days, toISODate } from '@/utils/date';
import { remainingAmount, calcProfit } from '@/utils/calc';
import type { Customer } from '@/types';

interface DashboardStats {
  todayCollected: number;
  todayExpected: number;
  outstandingTotal: number;
  activeCount: number;
  monthCollected: number;
  pendingTodayCount: number;
  netProfit: number;
  capitalOut: number;
  totalCollectedAll: number;
  loading: boolean;
}

export const useDashboardStats = (): DashboardStats => {
  const { customers, loading: customersLoading } = useCustomers();
  const { entries: todayEntries, total: todayCollected, loading: todayLoading } =
    useTodayCollection();

  const monthFrom = useMemo(() => toISODate(startOfMonth(new Date())), []);
  const monthTo = useMemo(() => toISODate(endOfMonth(new Date())), []);
  const { total: monthCollected, loading: monthLoading } = useEntriesInRange(
    monthFrom,
    monthTo,
  );

  return useMemo(() => {
    const active = customers.filter((c) => c.status === 'active');
    const todayExpected = active.reduce((sum, c) => sum + c.dailyAmount, 0);
    const outstandingTotal = active.reduce(
      (sum, c) => sum + remainingAmount(c),
      0,
    );
    const collectedIds = new Set(todayEntries.map((e) => e.customerId));
    const pendingTodayCount = active.filter((c) => !collectedIds.has(c.id)).length;

    // Net profit = deal − given across all non-cancelled deals (the margin earned/earning).
    const netProfit = customers.reduce(
      (sum, c) => sum + calcProfit(c.dealAmount, c.givenAmount),
      0,
    );
    const capitalOut = active.reduce((sum, c) => sum + c.givenAmount, 0);
    const totalCollectedAll = customers.reduce((sum, c) => sum + c.totalCollected, 0);

    return {
      todayCollected,
      todayExpected,
      outstandingTotal,
      activeCount: active.length,
      monthCollected,
      pendingTodayCount,
      netProfit,
      capitalOut,
      totalCollectedAll,
      loading: customersLoading || todayLoading || monthLoading,
    };
  }, [
    customers,
    todayEntries,
    todayCollected,
    monthCollected,
    customersLoading,
    todayLoading,
    monthLoading,
  ]);
};

interface ChartPoint {
  date: string;
  total: number;
}

export const useLast7DaysChart = (): { data: ChartPoint[]; loading: boolean } => {
  const days = useMemo(() => last7Days(), []);
  const from = days[0];
  const to = days[days.length - 1];
  const { entries, loading } = useEntriesInRange(from, to);

  const data = useMemo<ChartPoint[]>(() => {
    const map = new Map<string, number>();
    for (const d of days) map.set(d, 0);
    for (const e of entries) {
      map.set(e.date, (map.get(e.date) ?? 0) + e.amount);
    }
    return days.map((date) => ({ date, total: map.get(date) ?? 0 }));
  }, [days, entries]);

  return { data, loading };
};

interface SeriesPoint {
  date: string; // representative ISO (for the chart's today-highlight)
  label: string;
  total: number;
}

interface RangeAnalytics {
  receivedTotal: number;
  givenTotal: number;
  count: number;
  series: SeriesPoint[];
  loading: boolean;
}

const daysBetweenCount = (from: string, to: string): number => {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.round((b - a) / 86400000) + 1;
};

// Flexible from→to analytics. Daily buckets for short ranges, monthly for long.
export const useRangeAnalytics = (from: string, to: string): RangeAnalytics => {
  const { entries, loading } = useEntriesInRange(from, to);

  return useMemo(() => {
    const received = entries.filter((e) => (e.kind ?? 'received') === 'received');
    const receivedTotal = received.reduce((s, e) => s + e.amount, 0);
    const givenTotal = entries
      .filter((e) => e.kind === 'given')
      .reduce((s, e) => s + e.amount, 0);

    const span = daysBetweenCount(from, to);
    const monthly = span > 45;

    const buckets = new Map<string, { label: string; date: string; total: number }>();
    const keyOf = (iso: string) => (monthly ? iso.slice(0, 7) : iso);

    // seed buckets so the axis is continuous
    if (monthly) {
      const start = new Date(from);
      const end = new Date(to);
      const cur = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cur <= end) {
        const k = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
        buckets.set(k, {
          label: cur.toLocaleDateString('en-IN', { month: 'short' }),
          date: `${k}-15`,
          total: 0,
        });
        cur.setMonth(cur.getMonth() + 1);
      }
    } else {
      const start = new Date(from);
      const end = new Date(to);
      const cur = new Date(start);
      while (cur <= end) {
        const k = cur.toISOString().slice(0, 10);
        buckets.set(k, {
          label: cur.toLocaleDateString('en-IN', { day: 'numeric' }),
          date: k,
          total: 0,
        });
        cur.setDate(cur.getDate() + 1);
      }
    }

    for (const e of received) {
      const k = keyOf(e.date);
      const b = buckets.get(k);
      if (b) b.total += e.amount;
    }

    return {
      receivedTotal,
      givenTotal,
      count: received.length,
      series: Array.from(buckets.values()).map((b) => ({
        date: b.date,
        label: b.label,
        total: b.total,
      })),
      loading,
    };
  }, [entries, from, to, loading]);
};

export const useTopCustomers = (limit = 5): { data: Customer[] } => {
  const { customers } = useCustomers();
  const data = useMemo(
    () =>
      [...customers]
        .sort((a, b) => b.totalCollected - a.totalCollected)
        .slice(0, limit),
    [customers, limit],
  );
  return { data };
};
