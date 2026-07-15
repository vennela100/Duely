import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors, Glass, Radius, Spacing, Typography } from '@/constants/theme';
import { useCustomer } from '@/hooks/useCustomer';
import { useCustomerHistory } from '@/hooks/useCollection';
import { remainingAmount, calcProfit, progressPct } from '@/utils/calc';
import { formatINR } from '@/utils/format';
import { formatDisplay } from '@/utils/date';
import { useT } from '@/utils/i18n';

export default function CustomerProfileScreen() {
  const router = useRouter();
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useCustomer(id);
  const { entries } = useCustomerHistory(id ?? '');

  if (!customer) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState emoji="🔍" title="Not found" message="" cta={{ label: 'Back', onPress: () => router.back() }} />
      </SafeAreaView>
    );
  }

  const profit = calcProfit(customer.dealAmount, customer.givenAmount);
  const outstanding = remainingAmount(customer);
  const pct = Math.round(progressPct(customer));
  const received = entries.filter((e) => (e.kind ?? 'received') === 'received').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.hBtn}>
          <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.hTitle}>{t('detail.viewProfile')}</Text>
        <Pressable onPress={() => router.replace(`/customer/edit/${customer.id}`)} hitSlop={10} style={styles.hBtn}>
          <Feather name="edit-2" size={19} color={Colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <View style={styles.identity}>
          <Avatar name={customer.name} photo={customer.photo} size={76} />
          <Text style={styles.name} numberOfLines={1}>{customer.name}</Text>
          <Text style={styles.phone}>{customer.phone}</Text>
        </View>

        {/* Money overview — 4 cards */}
        <View style={styles.grid}>
          <Metric label={t('overview.totalGiven')} value={formatINR(customer.givenAmount)} />
          <Metric label={t('overview.totalProfit')} value={formatINR(profit)} color={Colors.amountPositive} />
          <Metric label={t('overview.collected')} value={formatINR(customer.totalCollected)} color={Colors.amountPositive} />
          <Metric label={t('overview.outstanding')} value={formatINR(outstanding)} color={Colors.amountNegative} />
        </View>

        {/* Progress */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>{t('overview.repaid')}</Text>
            <Text style={styles.cardValue}>{pct}%</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.cardSub}>
            {formatINR(customer.totalCollected)} {t('overview.of')} {formatINR(customer.dealAmount)}
          </Text>
        </View>

        {/* Calculation breakdown — makes the numbers unambiguous */}
        <Text style={styles.sectionLabel}>{t('overview.calcTitle').toUpperCase()}</Text>
        <View style={styles.card}>
          <CalcRow label={t('overview.principal')} value={`+ ${formatINR(customer.givenAmount)}`} />
          <CalcRow label={t('overview.profit')} value={`+ ${formatINR(profit)}`} color={Colors.amountPositive} />
          <View style={styles.calcLine} />
          <CalcRow label={t('overview.dealTotal')} value={formatINR(customer.dealAmount)} bold />
          <CalcRow label={t('overview.collected')} value={`− ${formatINR(customer.totalCollected)}`} color={Colors.amountPositive} />
          <View style={styles.calcLine} />
          <CalcRow label={t('overview.outstanding')} value={formatINR(outstanding)} bold color={Colors.amountNegative} />
        </View>

        {/* Deal */}
        <Text style={styles.sectionLabel}>{t('overview.deal').toUpperCase()}</Text>
        <View style={styles.card}>
          <DealRow label={t('overview.dealAmount')} value={formatINR(customer.dealAmount)} />
          <View style={styles.divider} />
          <DealRow label={t('overview.daily')} value={`${formatINR(customer.dailyAmount)}/day`} />
          <View style={styles.divider} />
          <DealRow label={t('overview.days')} value={`${customer.daysCollected}/${customer.collectionDays}`} />
          <View style={styles.divider} />
          <DealRow label={t('overview.period')} value={`${formatDisplay(customer.startDate)} → ${formatDisplay(customer.endDate)}`} />
          <View style={styles.divider} />
          <DealRow label={t('overview.payments')} value={String(received)} />
          {customer.lastCollectionDate ? (
            <>
              <View style={styles.divider} />
              <DealRow label={t('overview.lastPaid')} value={formatDisplay(customer.lastCollectionDate)} />
            </>
          ) : null}
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, color && { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function DealRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dealRow}>
      <Text style={styles.dealLabel}>{label}</Text>
      <Text style={styles.dealValue}>{value}</Text>
    </View>
  );
}

function CalcRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={styles.calcRow}>
      <Text style={[styles.calcLabel, bold && { color: Colors.textPrimary, fontFamily: Typography.heading }]}>{label}</Text>
      <Text style={[styles.calcValue, bold && { fontSize: 18 }, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  hBtn: { padding: 2 },
  hTitle: { fontFamily: Typography.heading, fontSize: 16, color: Colors.textPrimary },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },

  identity: { alignItems: 'center' },
  name: { fontFamily: Typography.display, fontSize: 22, color: Colors.textPrimary, marginTop: Spacing.md, letterSpacing: -0.5 },
  phone: { fontFamily: Typography.body, fontSize: 14, color: Colors.textSecondary, marginTop: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xl },
  metric: { width: '47.8%', flexGrow: 1, borderRadius: Radius.lg, padding: Spacing.md, ...Glass },
  metricLabel: { fontFamily: Typography.body, fontSize: 12, color: Colors.textTertiary },
  metricValue: { fontFamily: Typography.display, fontSize: 22, color: Colors.textPrimary, letterSpacing: -0.5, marginTop: 6 },

  card: { borderRadius: Radius.lg, padding: Spacing.lg, marginTop: Spacing.md, ...Glass },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { fontFamily: Typography.body, fontSize: 13, color: Colors.textSecondary },
  cardValue: { fontFamily: Typography.heading, fontSize: 15, color: Colors.textPrimary },
  track: { height: 6, backgroundColor: Colors.surfaceElevated, borderRadius: 3, marginTop: Spacing.sm, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  cardSub: { fontFamily: Typography.body, fontSize: 12, color: Colors.textTertiary, marginTop: Spacing.sm },

  sectionLabel: { fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textTertiary, letterSpacing: 1, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  dealRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md },
  dealLabel: { fontFamily: Typography.body, fontSize: 14, color: Colors.textSecondary },
  dealValue: { fontFamily: Typography.heading, fontSize: 14, color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.borderLight },
  calcRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  calcLabel: { fontFamily: Typography.body, fontSize: 14, color: Colors.textSecondary },
  calcValue: { fontFamily: Typography.heading, fontSize: 15, color: Colors.textPrimary, letterSpacing: -0.3 },
  calcLine: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },
});
