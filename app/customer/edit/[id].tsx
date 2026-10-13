import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useCustomer } from '@/hooks/useCustomer';
import { useUIStore } from '@/store/ui.store';
import { updateCustomer } from '@/services/customers.service';
import { calcDailyAmount, calcEndDate, calcProfit } from '@/utils/calc';
import { formatINR, normalizePhone } from '@/utils/format';
import { formatDisplay } from '@/utils/date';
import type { CustomerStatus } from '@/types';
import { useT } from '@/utils/i18n';

const STATUSES: { key: CustomerStatus; label: string }[] = [
  { key: 'active', label: 'common.active' },
  { key: 'paused', label: 'common.paused' },
  { key: 'completed', label: 'common.completed' },
  { key: 'defaulted', label: 'customers.defaulted' },
];

const toNumber = (s: string): number => {
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

export default function EditCustomerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useCustomer(id);
  const user = useUIStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const t = useT();

  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [address, setAddress] = useState(customer?.address ?? '');
  const [notes, setNotes] = useState(customer?.notes ?? '');
  const [dealAmount, setDealAmount] = useState(String(customer?.dealAmount ?? ''));
  const [givenAmount, setGivenAmount] = useState(String(customer?.givenAmount ?? ''));
  const [days, setDays] = useState(String(customer?.collectionDays ?? ''));
  const [status, setStatus] = useState<CustomerStatus>(customer?.status ?? 'active');
  const [submitting, setSubmitting] = useState(false);

  const deal = toNumber(dealAmount);
  const given = toNumber(givenAmount);
  const collectionDays = toNumber(days);

  const dailyAmount = useMemo(
    () => calcDailyAmount(deal, collectionDays),
    [deal, collectionDays],
  );
  const profit = calcProfit(deal, given);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (deal <= 0) e.deal = t('addCustomer.required');
    if (given <= 0) e.given = t('addCustomer.required');
    if (given > deal) e.given = t('addCustomer.cannotExceedDeal');
    if (collectionDays <= 0) e.days = t('addCustomer.required');
    return e;
  }, [deal, given, collectionDays, t]);

  if (!customer) {
    return (
      <View style={styles.flex}>
        <EmptyState
          emoji="🔍"
          title={t('common.customerNotFound')}
          message={t('customerEdit.mayBeDeleted')}
          cta={{ label: t('common.back'), onPress: () => router.back() }}
        />
      </View>
    );
  }

  const canSubmit =
    name.trim().length > 0 &&
    phone.trim().length > 0 &&
    Object.keys(errors).length === 0 &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSubmitting(true);
    try {
      const endDate = calcEndDate(customer.startDate, collectionDays);
      await updateCustomer(user.uid, customer.id, {
        name: name.trim(),
        phone: normalizePhone(phone),
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        dealAmount: deal,
        givenAmount: given,
        collectionDays,
        dailyAmount,
        endDate,
        status,
      });
      showToast(t('customerEdit.updated'), 'success');
      router.back();
    } catch (err) {
      showToast(t('customerEdit.updateFailed'), 'error');
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.field}>
          <Input label={t('addCustomer.fullName')} value={name} onChangeText={setName} autoCapitalize="words" />
        </View>
        <View style={styles.field}>
          <Input label={t('addCustomer.phoneNumber')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </View>
        <View style={styles.field}>
          <Input label={t('addCustomer.addressOptional')} value={address} onChangeText={setAddress} />
        </View>

        <Text style={styles.sectionTitle}>{t('customerEdit.status')}</Text>
        <View style={styles.statusRow}>
          {STATUSES.map((s) => {
            const active = status === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setStatus(s.key)}
                style={[styles.statusChip, active && styles.statusChipActive]}
              >
                <Text style={[styles.statusText, active && styles.statusTextActive]}>
                  {t(s.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>{t('addCustomer.deal')}</Text>
        <View style={styles.field}>
          <Input
            label={t('customerEdit.dealAmount')}
            value={dealAmount}
            onChangeText={setDealAmount}
            keyboardType="numeric"
            prefix="₹"
            error={errors.deal}
          />
        </View>
        <View style={styles.field}>
          <Input
            label={t('customerEdit.givenAmount')}
            value={givenAmount}
            onChangeText={setGivenAmount}
            keyboardType="numeric"
            prefix="₹"
            error={errors.given}
          />
        </View>
        <View style={styles.field}>
          <Input
            label={t('addCustomer.collectionDays')}
            value={days}
            onChangeText={setDays}
            keyboardType="numeric"
            error={errors.days}
          />
        </View>

        <Card style={styles.summary} padding="md">
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('addCustomer.dailyCollection')}</Text>
            <Text style={styles.summaryValue}>{formatINR(dailyAmount)}{t('addCustomer.perDay')}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('overview.profit')}</Text>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>
              {formatINR(profit)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('customerEdit.endDate')}</Text>
            <Text style={styles.summaryValue}>
              {collectionDays > 0
                ? formatDisplay(calcEndDate(customer.startDate, collectionDays))
                : '—'}
            </Text>
          </View>
        </Card>

        <View style={styles.field}>
          <Input label={t('addCustomer.notesOptional')} value={notes} onChangeText={setNotes} multiline />
        </View>

        <Button
          title={t('customerEdit.save')}
          onPress={handleSubmit}
          fullWidth
          size="lg"
          loading={submitting}
          disabled={!canSubmit}
          style={styles.submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  field: { marginBottom: Spacing.md },
  sectionTitle: {
    fontFamily: Typography.heading,
    fontSize: 12,
    letterSpacing: 0.6,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  statusChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
  },
  statusChipActive: { backgroundColor: Colors.primary },
  statusText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statusTextActive: { color: Colors.textInverse },
  summary: { marginBottom: Spacing.md, gap: Spacing.sm },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontFamily: Typography.heading,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  submit: { marginTop: Spacing.sm },
});
