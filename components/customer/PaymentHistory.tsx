import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useCustomerHistory } from '@/hooks/useCollection';
import { useCustomer } from '@/hooks/useCustomer';
import { CollectionEntry } from './CollectionEntry';
import type { CollectionEntry as CollectionEntryType } from '@/types';

export interface PaymentHistoryProps {
  customerId: string;
  limit?: number;
}

type Row =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'entry'; key: string; entry: CollectionEntryType };

const MONTH_LABEL = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const MONTH_KEY = (iso: string): string => iso.slice(0, 7);

export function PaymentHistory({ customerId, limit }: PaymentHistoryProps) {
  const { entries, loading } = useCustomerHistory(customerId);
  const customer = useCustomer(customerId);
  const totalDays = customer?.collectionDays ?? 0;

  const rows = useMemo<Row[]>(() => {
    const sliced = typeof limit === 'number' ? entries.slice(0, limit) : entries;
    const out: Row[] = [];
    let lastMonth = '';
    sliced.forEach((entry) => {
      const monthKey = MONTH_KEY(entry.date);
      if (monthKey !== lastMonth) {
        out.push({
          kind: 'header',
          key: `h-${monthKey}`,
          label: MONTH_LABEL(entry.date),
        });
        lastMonth = monthKey;
      }
      out.push({ kind: 'entry', key: `e-${entry.id}`, entry });
    });
    return out;
  }, [entries, limit]);

  if (loading) {
    return (
      <View style={styles.skeletonWrap}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skeletonRow}>
            <Skeleton width={48} height={48} radius={24} />
            <View style={styles.skeletonText}>
              <Skeleton width="60%" height={14} />
              <View style={{ height: Spacing.xs }} />
              <Skeleton width="40%" height={12} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        emoji="🧾"
        title="No history yet"
        message="Collections will appear here once recorded."
      />
    );
  }

  return (
    <FlashList
      data={rows}
      keyExtractor={(item) => item.key}
      renderItem={({ item }) => {
        if (item.kind === 'header') {
          return (
            <View style={styles.header}>
              <Text style={styles.headerText}>{item.label}</Text>
            </View>
          );
        }
        return (
          <View>
            <CollectionEntry entry={item.entry} />
            <View style={styles.dayPill}>
              <Text style={styles.dayPillText}>
                Day {item.entry.dayNumber}
                {totalDays ? `/${totalDays}` : ''}
              </Text>
            </View>
          </View>
        );
      }}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: Spacing.lg,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    backgroundColor: Colors.background,
  },
  headerText: {
    fontFamily: Typography.heading,
    fontSize: 12,
    letterSpacing: 0.8,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
  },
  dayPill: {
    position: 'absolute',
    right: Spacing.md + Spacing.sm,
    top: Spacing.sm,
  },
  dayPillText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.textTertiary,
  },
  skeletonWrap: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  skeletonText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
});
