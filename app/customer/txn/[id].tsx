import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { Avatar } from '@/components/ui/Avatar';
import { Calendar } from '@/components/ui/Calendar';
import { SuccessOverlay } from '@/components/ui/SuccessOverlay';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useCustomer } from '@/hooks/useCustomer';
import { useRecordCollection } from '@/hooks/useCollection';
import { useSMSAvailability } from '@/hooks/useSMS';
import { useUIStore } from '@/store/ui.store';
import { recordGiven } from '@/services/collections.service';
import { remainingAmount } from '@/utils/calc';
import { formatINR } from '@/utils/format';
import { today, formatDisplay } from '@/utils/date';
import { useT } from '@/utils/i18n';

const dateLabel = (iso: string): string => (iso === today() ? 'Today' : formatDisplay(iso));

type Kind = 'received' | 'given';
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

const groupINR = (digits: string): string => {
  if (!digits) return '0';
  const [intPart, decPart] = digits.split('.');
  const n = parseInt(intPart || '0', 10);
  const grouped = n.toLocaleString('en-IN');
  return decPart !== undefined ? `${grouped}.${decPart.slice(0, 2)}` : grouped;
};

export default function TxnScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; type?: string }>();
  const kind: Kind = params.type === 'given' ? 'given' : 'received';
  const customer = useCustomer(params.id);
  const user = useUIStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const recordCollection = useRecordCollection();
  const { available: smsAvailable } = useSMSAvailability();
  const t = useT();

  const [raw, setRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [date, setDate] = useState(today());
  const [calOpen, setCalOpen] = useState(false);
  const [success, setSuccess] = useState(false);

  const amount = useMemo(() => parseFloat(raw || '0') || 0, [raw]);
  const isReceived = kind === 'received';
  const accent = isReceived ? Colors.amountPositive : Colors.amountNegative;

  if (!customer) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.missing}>Customer not found</Text>
      </SafeAreaView>
    );
  }

  const due = remainingAmount(customer);

  const press = (k: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (k === 'del') {
      setRaw((r) => r.slice(0, -1));
      return;
    }
    setRaw((r) => {
      if (k === '.' && r.includes('.')) return r;
      if (k === '.' && r === '') return '0.';
      if (r.includes('.') && r.split('.')[1]?.length >= 2) return r;
      if (r.replace('.', '').length >= 9) return r;
      return r + k;
    });
  };

  const submit = async () => {
    if (amount <= 0 || submitting || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSubmitting(true);
    try {
      if (isReceived) {
        await recordCollection({
          customer,
          amount,
          method: 'cash',
          sendSMS: smsAvailable === true,
          date,
        });
      } else {
        await recordGiven(user.uid, { customer, amount, date });
      }
      setSuccess(true); // overlay animates, then navigates back
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error');
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Avatar name={customer.name} photo={customer.photo} size={40} />
        <View style={styles.headerMid}>
          <Text style={styles.headerName} numberOfLines={1}>{customer.name}</Text>
          <Text style={[styles.headerDue, { color: Colors.amountNegative }]}>
            {formatINR(due)} Due
          </Text>
        </View>
      </View>

      {/* Amount */}
      <View style={styles.amountWrap}>
        <Text style={[styles.kindLabel, { color: accent }]}>
          {(isReceived ? t('txn.youReceived') : t('txn.youGave')).toUpperCase()}
        </Text>
        <Animated.Text key={raw} entering={FadeIn.duration(120)} style={styles.amount}>
          ₹{groupINR(raw)}
        </Animated.Text>
        <View style={[styles.amountLine, { backgroundColor: accent }]} />
      </View>

      {/* Date pill */}
      <View style={styles.dateWrap}>
        <Pressable style={styles.datePill} onPress={() => setCalOpen(true)}>
          <Feather name="calendar" size={15} color={Colors.textSecondary} />
          <Text style={styles.dateText}>{dateLabel(date)}</Text>
          <Feather name="chevron-down" size={15} color={Colors.textTertiary} />
        </Pressable>
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {KEYS.map((k) => (
          <Pressable
            key={k}
            onPress={() => press(k)}
            style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
            android_ripple={{ color: Colors.surfaceElevated, borderless: true }}
          >
            {k === 'del' ? (
              <Feather name="delete" size={24} color={Colors.textSecondary} />
            ) : (
              <Text style={styles.keyText}>{k}</Text>
            )}
          </Pressable>
        ))}
      </View>

      {/* Submit */}
      <Pressable
        onPress={submit}
        disabled={amount <= 0 || submitting}
        style={({ pressed }) => [
          styles.submit,
          { backgroundColor: accent },
          (amount <= 0 || submitting) && styles.submitDisabled,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Feather name={isReceived ? 'arrow-down' : 'arrow-up'} size={18} color={Colors.textInverse} />
        <Text style={styles.submitText}>
          {isReceived ? t('txn.addReceived') : t('txn.addGiven')}{amount > 0 ? ` · ${formatINR(amount)}` : ''}
        </Text>
      </Pressable>

      <SuccessOverlay
        visible={success}
        amount={amount}
        label={isReceived ? 'received' : 'given'}
        color={accent}
        onDone={() => router.back()}
      />

      <Modal visible={calOpen} transparent animationType="fade" onRequestClose={() => setCalOpen(false)}>
        <Pressable style={styles.calBackdrop} onPress={() => setCalOpen(false)}>
          <Pressable style={styles.calSheet} onPress={() => {}}>
            <Text style={styles.calTitle}>{t('txn.selectDate')}</Text>
            <Calendar
              value={date}
              onSelect={(iso) => {
                setDate(iso);
                setCalOpen(false);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  missing: { fontFamily: Typography.body, fontSize: 16, color: Colors.textSecondary, textAlign: 'center', marginTop: 80 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  back: { paddingRight: Spacing.xs },
  headerMid: { flex: 1, minWidth: 0 },
  headerName: { fontFamily: Typography.heading, fontSize: 17, color: Colors.textPrimary, letterSpacing: -0.3 },
  headerDue: { fontFamily: Typography.bodyMedium, fontSize: 13, marginTop: 1 },

  amountWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kindLabel: { fontFamily: Typography.bodyMedium, fontSize: 13, letterSpacing: 1.2, marginBottom: Spacing.md },
  amount: { fontFamily: Typography.display, fontSize: 56, color: Colors.textPrimary, letterSpacing: -2 },
  amountLine: { width: 200, height: 3, borderRadius: 2, marginTop: Spacing.md },
  dateWrap: { alignItems: 'center', paddingBottom: Spacing.sm },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  dateText: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.textPrimary },
  calBackdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', paddingHorizontal: Spacing.lg },
  calSheet: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg },
  calTitle: { fontFamily: Typography.heading, fontSize: 16, color: Colors.textPrimary, marginBottom: Spacing.md, textAlign: 'center' },

  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
  },
  key: { width: '33.333%', height: 64, alignItems: 'center', justifyContent: 'center' },
  keyPressed: { opacity: 0.4 },
  keyText: { fontFamily: Typography.heading, fontSize: 26, color: Colors.textPrimary },

  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    borderRadius: Radius.full,
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { fontFamily: Typography.heading, fontSize: 16, color: Colors.textInverse },
});
