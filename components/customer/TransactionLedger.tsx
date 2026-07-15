import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { Skeleton } from '@/components/ui/Skeleton';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useCustomerHistory } from '@/hooks/useCollection';
import { useCustomer } from '@/hooks/useCustomer';
import { formatINR } from '@/utils/format';
import { useT } from '@/utils/i18n';
import type { CollectionEntry, EntryKind } from '@/types';

export interface TransactionLedgerProps {
  customerId: string;
}

interface Bubble {
  id: string;
  kind: EntryKind;
  amount: number;
  at: string; // ISO for time + sort
  date: string; // yyyy-mm-dd for grouping
  balanceAfter: number;
  opening?: boolean;
}

type Row =
  | { type: 'date'; key: string; label: string }
  | { type: 'bubble'; key: string; b: Bubble };

const dateChip = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const s = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((s(now) - s(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const timeLabel = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
};

export function TransactionLedger({ customerId }: TransactionLedgerProps) {
  const t = useT();
  const { entries, loading } = useCustomerHistory(customerId);
  const customer = useCustomer(customerId);

  const rows = useMemo<Row[]>(() => {
    if (!customer) return [];

    const asc = [...entries].sort((a, b) => a.collectedAt.localeCompare(b.collectedAt));
    const givenExtra = asc
      .filter((e) => e.kind === 'given')
      .reduce((s, e) => s + e.amount, 0);
    const openingDeal = Math.max(customer.dealAmount - givenExtra, 0);

    const opening: Bubble = {
      id: 'opening',
      kind: 'given',
      amount: openingDeal,
      at: customer.createdAt || customer.startDate,
      date: customer.startDate,
      balanceAfter: openingDeal,
      opening: true,
    };

    let balance = openingDeal;
    const bubbles: Bubble[] = [opening];
    for (const e of asc) {
      const kind: EntryKind = e.kind ?? 'received';
      balance += kind === 'given' ? e.amount : -e.amount;
      bubbles.push({
        id: e.id,
        kind,
        amount: e.amount,
        at: e.collectedAt,
        date: e.date,
        balanceAfter: Math.max(balance, 0),
      });
    }

    const out: Row[] = [];
    let lastDay = '';
    for (const b of bubbles) {
      const label = dateChip(b.date);
      if (label !== lastDay) {
        out.push({ type: 'date', key: `d-${b.id}`, label });
        lastDay = label;
      }
      out.push({ type: 'bubble', key: `b-${b.id}`, b });
    }
    return out;
  }, [entries, customer]);

  if (loading) {
    return (
      <View style={styles.skel}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={i % 2 ? '55%' : '50%'} height={68} radius={Radius.lg} />
        ))}
      </View>
    );
  }

  if (!customer) return null;

  return (
    <FlashList
      data={rows}
      keyExtractor={(r) => r.key}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        if (item.type === 'date') {
          return (
            <View style={styles.dateRow}>
              <Text style={styles.dateChip}>{item.label}</Text>
            </View>
          );
        }
        const { b } = item;
        const given = b.kind === 'given';
        const accent = given ? Colors.amountNegative : Colors.amountPositive;
        return (
          <Animated.View
            entering={FadeInUp.duration(260)}
            style={[styles.bubbleRow, given ? styles.alignRight : styles.alignLeft]}
          >
            <View style={styles.bubbleWrap}>
              <View style={styles.bubble}>
                <View style={[styles.iconDot, { backgroundColor: given ? Colors.dangerLight : Colors.successLight }]}>
                  <Feather name={given ? 'arrow-up-right' : 'arrow-down-left'} size={16} color={accent} />
                </View>
                <View style={styles.bubbleMid}>
                  <Text style={styles.bubbleAmount}>{formatINR(b.amount)}</Text>
                  <View style={styles.bubbleMeta}>
                    <Text style={[styles.bubbleKind, { color: accent }]}>
                      {(b.opening ? t('detail.opening') : given ? t('common.given') : t('common.received')).toUpperCase()}
                    </Text>
                    <Feather name="check" size={11} color={Colors.textTertiary} />
                    <Text style={styles.bubbleTime}>{timeLabel(b.at)}</Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.balance, given ? styles.balanceRight : styles.balanceLeft]}>
                {formatINR(b.balanceAfter)} {t('common.due').toLowerCase()}
              </Text>
            </View>
          </Animated.View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl },
  skel: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.lg },

  dateRow: { alignItems: 'center', marginVertical: Spacing.md },
  dateChip: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.textSecondary,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },

  bubbleRow: { width: '100%', marginBottom: Spacing.md },
  alignLeft: { alignItems: 'flex-start' },
  alignRight: { alignItems: 'flex-end' },
  bubbleWrap: { maxWidth: '78%' },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  iconDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  bubbleMid: {},
  bubbleAmount: { fontFamily: Typography.display, fontSize: 22, color: Colors.textPrimary, letterSpacing: -0.5 },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  bubbleKind: { fontFamily: Typography.bodyMedium, fontSize: 10, letterSpacing: 0.8 },
  bubbleTime: { fontFamily: Typography.body, fontSize: 11, color: Colors.textTertiary },
  balance: { fontFamily: Typography.body, fontSize: 11, color: Colors.textTertiary, marginTop: 5 },
  balanceLeft: { textAlign: 'left', marginLeft: Spacing.xs },
  balanceRight: { textAlign: 'right', marginRight: Spacing.xs },
});
