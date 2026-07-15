import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { AmountDisplay } from '@/components/ui/AmountDisplay';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { formatDisplay } from '@/utils/date';
import type { CollectionEntry as CollectionEntryType, PaymentMethod } from '@/types';

export interface CollectionEntryProps {
  entry: CollectionEntryType;
  showCustomer?: boolean;
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  other: 'Other',
};

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
};

export function CollectionEntry({ entry, showCustomer = false }: CollectionEntryProps) {
  return (
    <View style={styles.row}>
      <View style={styles.timelineCol}>
        <View style={styles.dot} />
        <View style={styles.line} />
      </View>

      <View style={styles.cardWrap}>
        <Card padding="sm">
          <View style={styles.topRow}>
            <View style={styles.leftCol}>
              {showCustomer ? (
                <Text style={styles.customerName} numberOfLines={1}>
                  {entry.customerName}
                </Text>
              ) : null}
              <Text style={styles.dateText}>
                {formatDisplay(entry.date)}
                {entry.collectedAt ? ` · ${formatTime(entry.collectedAt)}` : ''}
              </Text>
            </View>
            <AmountDisplay amount={entry.amount} size={18} mono bold />
          </View>

          <View style={styles.metaRow}>
            <Badge label={METHOD_LABEL[entry.method]} variant="info" size="sm" />
            <Badge
              label={entry.smsSent ? 'SMS sent' : 'Notified in-app'}
              variant={entry.smsSent ? 'success' : 'neutral'}
              size="sm"
            />
            <Text style={styles.dayText}>Day {entry.dayNumber}</Text>
          </View>

          {entry.notes ? (
            <Text style={styles.notes} numberOfLines={2}>
              {entry.notes}
            </Text>
          ) : null}
        </Card>
      </View>
    </View>
  );
}

const DOT_SIZE = 12;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  timelineCol: {
    width: 24,
    alignItems: 'center',
    paddingTop: Spacing.sm + 2,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.primarySurface,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.borderLight,
    marginTop: 4,
  },
  cardWrap: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  leftCol: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  customerName: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  dateText: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    flexWrap: 'wrap',
  },
  dayText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.textTertiary,
    marginLeft: 'auto',
  },
  notes: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});
