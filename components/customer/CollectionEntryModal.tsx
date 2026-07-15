import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { useRecordCollection } from '@/hooks/useCollection';
import { useSMSAvailability } from '@/hooks/useSMS';
import { useUIStore } from '@/store/ui.store';
import { buildCollectionMessage } from '@/services/sms.service';
import { formatINR } from '@/utils/format';
import { today } from '@/utils/date';
import { remainingAmount } from '@/utils/calc';
import type { CollectionEntry, Customer, PaymentMethod } from '@/types';

export interface CollectionEntryModalProps {
  visible: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSuccess?: (entry: CollectionEntry) => void;
}

const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'upi', label: 'UPI' },
  { key: 'other', label: 'Other' },
];

const formatGrouped = (n: number): string => {
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const parseAmount = (raw: string): number => {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10);
};

interface AmountInputProps {
  value: string;
  onChange: (raw: string) => void;
  customer: Customer;
}

function BigAmountInput({ value, onChange, customer }: AmountInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 280);
    return () => clearTimeout(t);
  }, []);

  const display = useMemo(() => {
    const n = parseAmount(value);
    if (focused) return n === 0 ? '' : String(n);
    return formatGrouped(n);
  }, [value, focused]);

  const remaining = remainingAmount(customer);
  const dayNumber = customer.daysCollected + 1;

  return (
    <View style={amountStyles.wrap}>
      <View style={amountStyles.row}>
        <Text style={amountStyles.prefix}>₹</Text>
        <TextInput
          ref={inputRef}
          value={display}
          onChangeText={(t) => onChange(t.replace(/[^\d]/g, ''))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="numeric"
          style={amountStyles.input}
          placeholder="0"
          placeholderTextColor={Colors.textTertiary}
          maxLength={9}
          selectionColor={Colors.primary}
        />
      </View>
      <View style={amountStyles.metaRow}>
        <Text style={amountStyles.meta}>Daily: {formatINR(customer.dailyAmount)}</Text>
        <Text style={amountStyles.metaDot}>·</Text>
        <Text style={amountStyles.meta}>Remaining: {formatINR(remaining)}</Text>
        <Text style={amountStyles.metaDot}>·</Text>
        <Text style={amountStyles.meta}>
          Day {dayNumber}/{customer.collectionDays}
        </Text>
      </View>
    </View>
  );
}

export function CollectionEntryModal({
  visible,
  customer,
  onClose,
  onSuccess,
}: CollectionEntryModalProps) {
  const recordCollection = useRecordCollection();
  const { available: smsAvailable } = useSMSAvailability();
  const showToast = useUIStore((s) => s.showToast);
  const msgLang = useUIStore((s) => s.msgLang);

  const [amountRaw, setAmountRaw] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [sendSMS, setSendSMS] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const sheetY = useSharedValue(600);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible && customer) {
      sheetY.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.8 });
      backdropOpacity.value = withTiming(1, { duration: 220 });
      setAmountRaw(String(Math.round(customer.dailyAmount)));
      setMethod('cash');
      setNotes('');
      setSendSMS(smsAvailable !== false);
      setSubmitting(false);
    } else {
      sheetY.value = withTiming(600, { duration: 220 });
      backdropOpacity.value = withTiming(0, { duration: 180 });
    }
  }, [visible, customer, smsAvailable, sheetY, backdropOpacity]);

  useEffect(() => {
    if (smsAvailable === false) setSendSMS(false);
  }, [smsAvailable]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const amount = parseAmount(amountRaw);

  const previewMessage = useMemo(() => {
    if (!customer) return '';
    const projectedTotal = customer.totalCollected + amount;
    const projectedDay = customer.daysCollected + 1;
    return buildCollectionMessage({
      customerName: customer.name,
      phone: customer.phone,
      amountCollected: amount,
      totalCollected: projectedTotal,
      dealAmount: customer.dealAmount,
      dayNumber: projectedDay,
      totalDays: customer.collectionDays,
      date: today(),
      lang: msgLang,
    });
  }, [customer, amount, msgLang]);

  if (!customer) return null;

  const remaining = remainingAmount(customer);
  const overpayment = amount > remaining ? amount - remaining : 0;
  const lowAmount = amount > 0 && amount < customer.dailyAmount * 0.5;

  const canSubmit = amount > 0 && !submitting;
  const willSendSMS = sendSMS && smsAvailable === true;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSubmitting(true);
    try {
      const result = await recordCollection({
        customer,
        amount,
        method,
        notes: notes.trim() ? notes.trim() : undefined,
        sendSMS: willSendSMS,
      });
      showToast(`${formatINR(amount)} collected`, 'success');
      onSuccess?.(result.entry);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not record collection';
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kbWrap}
          pointerEvents="box-none"
        >
          <Animated.View style={[styles.sheet, sheetStyle]}>
            <View style={styles.grabber} />

            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerLabel}>Record collection</Text>
                <Text style={styles.headerName} numberOfLines={1}>
                  {customer.name}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.closeIcon}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
            >
              <BigAmountInput
                value={amountRaw}
                onChange={setAmountRaw}
                customer={customer}
              />

              {overpayment > 0 ? (
                <Text style={styles.warningRed}>
                  Overpayment by {formatINR(overpayment)}
                </Text>
              ) : null}
              {lowAmount && overpayment === 0 ? (
                <Text style={styles.warningYellow}>Less than daily amount</Text>
              ) : null}

              <Text style={styles.sectionLabel}>Payment method</Text>
              <View style={styles.segments}>
                {METHODS.map((m) => {
                  const active = m.key === method;
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => setMethod(m.key)}
                      style={[styles.segment, active && styles.segmentActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          styles.segmentLabel,
                          active && styles.segmentLabelActive,
                        ]}
                      >
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.notesWrap}>
                <Input
                  label="Notes (optional)"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </View>

              <Text style={styles.sectionLabel}>SMS Preview</Text>
              <Card padding="md" style={styles.smsCard}>
                <Text style={styles.smsText}>{previewMessage}</Text>
              </Card>

              <Pressable
                onPress={() => {
                  if (smsAvailable === false) return;
                  setSendSMS((v) => !v);
                }}
                style={styles.toggleRow}
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: willSendSMS,
                  disabled: smsAvailable === false,
                }}
              >
                <View
                  style={[
                    styles.checkbox,
                    willSendSMS && styles.checkboxChecked,
                    smsAvailable === false && styles.checkboxDisabled,
                  ]}
                >
                  {willSendSMS ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <View style={styles.toggleTextCol}>
                  <Text style={styles.toggleLabel}>Send SMS to customer</Text>
                  {smsAvailable === false ? (
                    <Text style={styles.toggleNote}>
                      SMS not available on this device
                    </Text>
                  ) : null}
                </View>
              </Pressable>

              <View style={styles.submitWrap}>
                <Button
                  title={
                    willSendSMS ? 'Collect & Send SMS' : 'Collect'
                  }
                  onPress={handleSubmit}
                  fullWidth
                  size="lg"
                  loading={submitting}
                  disabled={!canSubmit}
                />
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.overlay,
  },
  kbWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    maxHeight: '92%',
    ...Shadow.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerLabel: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textTertiary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  headerName: {
    fontFamily: Typography.display,
    fontSize: 20,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  scroll: {
    paddingBottom: Spacing.lg,
  },
  warningRed: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.danger,
    textAlign: 'center',
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
  warningYellow: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.warning,
    textAlign: 'center',
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontFamily: Typography.heading,
    fontSize: 12,
    letterSpacing: 0.6,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  segments: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  segmentActive: {
    backgroundColor: Colors.surface,
    ...Shadow.sm,
  },
  segmentLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  segmentLabelActive: {
    color: Colors.primary,
  },
  notesWrap: {
    marginTop: Spacing.md,
  },
  smsCard: {
    backgroundColor: Colors.primarySurface,
    borderWidth: 0,
  },
  smsText: {
    fontFamily: Typography.mono,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textPrimary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxDisabled: {
    opacity: 0.4,
  },
  checkmark: {
    color: Colors.textInverse,
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    lineHeight: 14,
  },
  toggleTextCol: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  toggleLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  toggleNote: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  submitWrap: {
    marginTop: Spacing.lg,
  },
});

const amountStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefix: {
    fontFamily: Typography.monoBold,
    fontSize: 36,
    color: Colors.textTertiary,
    marginRight: 4,
  },
  input: {
    fontFamily: Typography.monoBold,
    fontSize: 48,
    color: Colors.textPrimary,
    textAlign: 'center',
    minWidth: 120,
    padding: 0,
    includeFontPadding: false,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  meta: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  metaDot: {
    marginHorizontal: 6,
    color: Colors.textTertiary,
  },
});
