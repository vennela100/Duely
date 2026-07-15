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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useContactPicker } from '@/hooks/useContacts';
import { useUIStore } from '@/store/ui.store';
import { createCustomer } from '@/services/customers.service';
import { calcDailyAmount, calcEndDate, calcProfit } from '@/utils/calc';
import { formatINR, normalizePhone } from '@/utils/format';
import { formatDisplay, today } from '@/utils/date';

const DAY_PRESETS = [50, 100, 200];

const toNumber = (s: string): number => {
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

export default function AddCustomerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useUIStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const { pick, picking } = useContactPicker();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [dealAmount, setDealAmount] = useState('');
  const [givenAmount, setGivenAmount] = useState('');
  const [days, setDays] = useState('100');

  const [submitting, setSubmitting] = useState(false);
  const startDate = useMemo(() => today(), []);

  const deal = toNumber(dealAmount);
  const given = toNumber(givenAmount);
  const collectionDays = toNumber(days);

  const dailyAmount = useMemo(
    () => calcDailyAmount(deal, collectionDays),
    [deal, collectionDays],
  );
  const endDate = useMemo(
    () => (collectionDays > 0 ? calcEndDate(startDate, collectionDays) : ''),
    [startDate, collectionDays],
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

  const canSubmit =
    name.trim().length > 0 &&
    phone.trim().length > 0 &&
    Object.keys(errors).length === 0 &&
    !submitting;

  const handlePickContact = async () => {
    const c = await pick();
    if (!c) {
      showToast('Contacts permission denied', 'error');
      return;
    }
    if (c.name) setName(c.name);
    if (c.phone) setPhone(c.phone);
    setPhoneRaw(c.phoneRaw);
    setPhoto(c.photo);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSubmitting(true);
    try {
      const id = await createCustomer(user.uid, {
        name: name.trim(),
        phone: normalizePhone(phone),
        phoneRaw: phoneRaw || phone,
        address: address.trim() || undefined,
        photo,
        notes: notes.trim() || undefined,
        deal: {
          dealAmount: deal,
          givenAmount: given,
          collectionDays,
          startDate,
        },
      });
      showToast(`${name.trim()} added`, 'success');
      router.replace(`/customer/${id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not add customer';
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
        <Pressable
          onPress={handlePickContact}
          style={styles.contactBtn}
          accessibilityRole="button"
        >
          {photo || name ? (
            <Avatar name={name || '?'} photo={photo} size={48} />
          ) : (
            <View style={styles.contactIcon}>
              <Feather name="user-plus" size={22} color={Colors.primary} />
            </View>
          )}
          <Text style={styles.contactBtnText}>
            {picking ? 'Opening contacts…' : 'Import from contacts'}
          </Text>
        </Pressable>

        <View style={styles.field}>
          <Input label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
        </View>
        <View style={styles.field}>
          <Input
            label="Phone number"
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              setPhoneRaw(v);
            }}
            keyboardType="phone-pad"
          />
        </View>
        <View style={styles.field}>
          <Input label="Address (optional)" value={address} onChangeText={setAddress} />
        </View>

        <Text style={styles.sectionTitle}>Deal</Text>

        <View style={styles.field}>
          <Input
            label="Deal amount (to collect)"
            value={dealAmount}
            onChangeText={setDealAmount}
            keyboardType="numeric"
            prefix="₹"
            error={errors.deal}
          />
        </View>
        <View style={styles.field}>
          <Input
            label="Given amount (paid out)"
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
          <View style={styles.presetRow}>
            {DAY_PRESETS.map((d) => {
              const active = collectionDays === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => setDays(String(d))}
                  style={[styles.preset, active && styles.presetActive]}
                >
                  <Text style={[styles.presetText, active && styles.presetTextActive]}>
                    {d} days
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
            <Text style={styles.summaryLabel}>Start → End</Text>
            <Text style={styles.summaryValue}>
              {formatDisplay(startDate)}
              {endDate ? ` → ${formatDisplay(endDate)}` : ''}
            </Text>
          </View>
        </Card>

        <View style={styles.field}>
          <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
        </View>

        <Button
          title="Add Customer"
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
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactIconText: { fontSize: 22 },
  contactBtnText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.primary,
  },
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
  presetRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  preset: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
  },
  presetActive: { backgroundColor: Colors.primary },
  presetText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  presetTextActive: { color: Colors.textInverse },
  summary: {
    backgroundColor: Colors.surface,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
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
