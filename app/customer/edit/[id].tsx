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

const STATUSES: { key: CustomerStatus; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Completed' },
  { key: 'defaulted', label: 'Defaulted' },
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
    if (deal <= 0) e.deal = 'Required';
    if (given <= 0) e.given = 'Required';
    if (given > deal) e.given = 'Cannot exceed deal amount';
    if (collectionDays <= 0) e.days = 'Required';
    return e;
  }, [deal, given, collectionDays]);

  if (!customer) {
    return (
      <View style={styles.flex}>
        <EmptyState
          emoji="🔍"
          title="Customer not found"
          message="This customer may have been deleted."
          cta={{ label: 'Go back', onPress: () => router.back() }}
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
      showToast('Customer updated', 'success');
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      showToast(msg, 'error');
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
          <Input label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
        </View>
        <View style={styles.field}>
          <Input label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </View>
        <View style={styles.field}>
          <Input label="Address (optional)" value={address} onChangeText={setAddress} />
        </View>

        <Text style={styles.sectionTitle}>Status</Text>
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
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Deal</Text>
        <View style={styles.field}>
          <Input
            label="Deal amount"
            value={dealAmount}
            onChangeText={setDealAmount}
            keyboardType="numeric"
            prefix="₹"
            error={errors.deal}
          />
        </View>
        <View style={styles.field}>
          <Input
            label="Given amount"
            value={givenAmount}
            onChangeText={setGivenAmount}
            keyboardType="numeric"
            prefix="₹"
            error={errors.given}
          />
        </View>
        <View style={styles.field}>
          <Input
            label="Collection days"
            value={days}
            onChangeText={setDays}
            keyboardType="numeric"
            error={errors.days}
          />
        </View>

        <Card style={styles.summary} padding="md">
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Daily collection</Text>
            <Text style={styles.summaryValue}>{formatINR(dailyAmount)}/day</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Profit</Text>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>
              {formatINR(profit)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>End date</Text>
            <Text style={styles.summaryValue}>
              {collectionDays > 0
                ? formatDisplay(calcEndDate(customer.startDate, collectionDays))
                : '—'}
            </Text>
          </View>
        </Card>

        <View style={styles.field}>
          <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
        </View>

        <Button
          title="Save Changes"
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
