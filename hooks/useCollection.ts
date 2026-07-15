import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  recordCollection,
  subscribeCustomerEntries,
  subscribeEntriesInRange,
} from '@/services/collections.service';
import { sendCollectionSMS } from '@/services/sms.service';
import { useCollectionStore } from '@/store/collection.store';
import { useUIStore } from '@/store/ui.store';
import { today } from '@/utils/date';
import type { CollectionEntry, Customer, PaymentMethod } from '@/types';

export const useTodayCollection = () => {
  const user = useUIStore((s) => s.user);
  const entries = useCollectionStore((s) => s.todayEntries);
  const loading = useCollectionStore((s) => s.loading);
  const subscribeToday = useCollectionStore((s) => s.subscribeToday);
  const unsubscribeToday = useCollectionStore((s) => s.unsubscribeToday);

  useEffect(() => {
    if (!user) {
      unsubscribeToday();
      return;
    }
    subscribeToday(user.uid);
    return () => {
      unsubscribeToday();
    };
  }, [user, subscribeToday, unsubscribeToday]);

  const total = useMemo(
    () => entries.reduce((sum, e) => sum + e.amount, 0),
    [entries],
  );

  const wasCollected = useCallback(
    (customerId: string) => entries.some((e) => e.customerId === customerId),
    [entries],
  );

  return { entries, total, wasCollected, loading };
};

export const useCustomerHistory = (customerId: string) => {
  const user = useUIStore((s) => s.user);
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !customerId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeCustomerEntries(
      user.uid,
      customerId,
      (list) => {
        setEntries(list);
        setLoading(false);
      },
      () => {
        setEntries([]);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user, customerId]);

  return { entries, loading };
};

export const useEntriesInRange = (from: string, to: string) => {
  const user = useUIStore((s) => s.user);
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !from || !to) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeEntriesInRange(
      user.uid,
      from,
      to,
      (list) => {
        setEntries(list);
        setLoading(false);
      },
      () => {
        setEntries([]);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user, from, to]);

  const total = useMemo(
    () => entries.reduce((sum, e) => sum + e.amount, 0),
    [entries],
  );

  return { entries, total, loading };
};

interface RecordArgs {
  customer: Customer;
  amount: number;
  method: PaymentMethod;
  notes?: string;
  sendSMS?: boolean;
  date?: string;
}

interface RecordResult {
  entry: CollectionEntry;
  smsResult?: { ok: boolean; reason?: string };
}

export const useRecordCollection = () => {
  const user = useUIStore((s) => s.user);
  const msgLang = useUIStore((s) => s.msgLang);

  return useCallback(
    async (args: RecordArgs): Promise<RecordResult> => {
      if (!user) throw new Error('Not authenticated');

      let smsResult: { ok: boolean; reason?: string } | undefined;
      if (args.sendSMS) {
        const projectedTotal = args.customer.totalCollected + args.amount;
        const projectedDay = args.customer.daysCollected + 1;
        smsResult = await sendCollectionSMS({
          customerName: args.customer.name,
          phone: args.customer.phone,
          amountCollected: args.amount,
          totalCollected: projectedTotal,
          dealAmount: args.customer.dealAmount,
          dayNumber: projectedDay,
          totalDays: args.customer.collectionDays,
          date: args.date ?? today(),
          lang: msgLang,
        });
      }

      const entry = await recordCollection(user.uid, {
        customer: args.customer,
        amount: args.amount,
        method: args.method,
        notes: args.notes,
        smsSent: smsResult?.ok ?? false,
        date: args.date,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      return { entry, smsResult };
    },
    [user, msgLang],
  );
};
