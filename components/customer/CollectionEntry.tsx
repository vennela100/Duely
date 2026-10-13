import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { AmountDisplay } from '@/components/ui/AmountDisplay';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { formatDisplay } from '@/utils/date';
import type { CollectionEntry as CollectionEntryType, PaymentMethod } from '@/types';
import { useT } from '@/utils/i18n';
import { useUIStore } from '@/store/ui.store';

export interface CollectionEntryProps {
  entry: CollectionEntryType;
  showCustomer?: boolean;
}

const formatTime = (iso: string, locale: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
};

export function CollectionEntry({ entry, showCustomer = false }: CollectionEntryProps) {
  const t = useT();
  const lang = useUIStore((s) => s.lang);
  const locale = lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-IN';
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
                {entry.collectedAt ? ` · ${formatTime(entry.collectedAt, locale)}` : ''}
              </Text>
            </View>
            <AmountDisplay amount={entry.amount} size={18} mono bold />
          </View>

          <View style={styles.metaRow}>
            <Badge label={entry.method === 'cash' ? t('collection.cash') : entry.method === 'upi' ? 'UPI' : t('collection.other')} variant="info" size="sm" />
            <Badge
              label={entry.smsSent ? t('collection.smsSent') : t('collection.notifiedInApp')}
              variant={entry.smsSent ? 'success' : 'neutral'}
              size="sm"
            />
            <Text style={styles.dayText}>{t('common.day')} {entry.dayNumber}</Text>
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
