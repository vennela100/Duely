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
import {
  getPreferredSmsSubscriptionId,
  getSmsSubscriptions,
  setPreferredSmsSubscriptionId,
  type SmsSubscription,
} from '@/services/directSms';
import { formatINR } from '@/utils/format';
import { today } from '@/utils/date';
import { remainingAmount } from '@/utils/calc';
import type { CollectionEntry, Customer, PaymentMethod } from '@/types';
import { useT } from '@/utils/i18n';

export interface CollectionEntryModalProps {
  visible: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSuccess?: (entry: CollectionEntry) => void;
}

const METHODS: PaymentMethod[] = ['cash', 'upi', 'other'];

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
  const t = useT();
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
        <Text style={amountStyles.meta}>{t('collection.daily')}: {formatINR(customer.dailyAmount)}</Text>
        <Text style={amountStyles.metaDot}>·</Text>
        <Text style={amountStyles.meta}>{t('collection.remaining')}: {formatINR(remaining)}</Text>
        <Text style={amountStyles.metaDot}>·</Text>
        <Text style={amountStyles.meta}>
          {t('common.day')} {dayNumber}/{customer.collectionDays}
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
  const t = useT();

  const [amountRaw, setAmountRaw] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [sendSMS, setSendSMS] = useState(true);
  const [smsSubscriptions, setSmsSubscriptions] = useState<SmsSubscription[]>([]);
  const [selectedSimId, setSelectedSimId] = useState<number | null>(null);
  const [loadingSmsSubscriptions, setLoadingSmsSubscriptions] = useState(false);
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
      setSmsSubscriptions([]);
      setSelectedSimId(null);
      setSubmitting(false);
    } else {
      sheetY.value = withTiming(600, { duration: 220 });
      backdropOpacity.value = withTiming(0, { duration: 180 });
    }
  }, [visible, customer, smsAvailable, sheetY, backdropOpacity]);

  useEffect(() => {
    if (!visible || smsAvailable !== true) return;
    let active = true;
    setLoadingSmsSubscriptions(true);
    Promise.all([getSmsSubscriptions(), getPreferredSmsSubscriptionId()])
      .then(([subscriptions, preferredSubscriptionId]) => {
        if (!active) return;
        setSmsSubscriptions(subscriptions);
        const preferred = subscriptions.find((sim) => sim.subscriptionId === preferredSubscriptionId);
        const selected = preferred ?? subscriptions.find((sim) => sim.isDefault) ?? subscriptions[0] ?? null;
        setSelectedSimId(selected?.subscriptionId ?? null);
        if (selected) void setPreferredSmsSubscriptionId(selected.subscriptionId);
      })
      .finally(() => {
        if (active) setLoadingSmsSubscriptions(false);
      });
    return () => {
      active = false;
    };
  }, [visible, smsAvailable]);

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

  const needsSimChoice = smsSubscriptions.length > 1 && selectedSimId === null;
  const waitingForSim = sendSMS && smsAvailable === true && (loadingSmsSubscriptions || needsSimChoice);
  const canSubmit = amount > 0 && !submitting && !waitingForSim;
  const willSendSMS =
    sendSMS && smsAvailable === true && !loadingSmsSubscriptions;
  const selectedSim = smsSubscriptions.find((sim) => sim.subscriptionId === selectedSimId);

  const chooseSim = (subscriptionId: number) => {
    setSelectedSimId(subscriptionId);
    void setPreferredSmsSubscriptionId(subscriptionId);
  };

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
        simSubscriptionId: selectedSimId,
        lang: msgLang,
      });
      showToast(
        result.smsResult?.ok === false
          ? t('collection.collectedSmsFailed').replace('{amount}', formatINR(amount))
          : t('collection.collected').replace('{amount}', formatINR(amount)),
        result.smsResult?.ok === false ? 'error' : 'success',
      );
      onSuccess?.(result.entry);
      onClose();
    } catch (err) {
      showToast(t('collection.couldNotRecord'), 'error');
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
                <Text style={styles.headerLabel}>{t('collection.record')}</Text>
                <Text style={styles.headerName} numberOfLines={1}>
                  {customer.name}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
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
                  {t('collection.overpayment').replace('{amount}', formatINR(overpayment))}
                </Text>
              ) : null}
              {lowAmount && overpayment === 0 ? (
                <Text style={styles.warningYellow}>{t('collection.lessThanDaily')}</Text>
              ) : null}

              <Text style={styles.sectionLabel}>{t('collection.paymentMethod')}</Text>
              <View style={styles.segments}>
                {METHODS.map((m) => {
                  const active = m === method;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setMethod(m)}
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
                        {m === 'cash' ? t('collection.cash') : m === 'upi' ? 'UPI' : t('collection.other')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.notesWrap}>
                <Input
                  label={t('addCustomer.notesOptional')}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </View>

              <Text style={styles.sectionLabel}>{t('collection.smsPreview')}</Text>
              <Card padding="md" style={styles.smsCard}>
                <Text style={styles.smsText}>{previewMessage}</Text>
              </Card>

              {selectedSim ? (
                <View style={styles.simPickerWrap}>
                  <Text style={styles.toggleNote}>
                    {t('collection.automaticSim').replace('{number}', String(selectedSim.slotIndex + 1))}
                    {selectedSim.carrierName ? ` · ${selectedSim.carrierName}` : ''}.
                  </Text>
                </View>
              ) : smsSubscriptions.length > 1 ? (
                <View style={styles.simPickerWrap}>
                  <Text style={styles.sectionLabel}>{t('collection.chooseSimSms')}</Text>
                  <View style={styles.simOptions}>
                    {smsSubscriptions.map((sim) => {
                      const selected = selectedSimId === sim.subscriptionId;
                      const label = sim.label || sim.carrierName || `SIM ${sim.slotIndex + 1}`;
                      return (
                        <Pressable
                          key={sim.subscriptionId}
                          onPress={() => chooseSim(sim.subscriptionId)}
                          style={[styles.simOption, selected && styles.simOptionSelected]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                        >
                          <Text style={[styles.simOptionText, selected && styles.simOptionTextSelected]}>
                            SIM {sim.slotIndex + 1} · {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {needsSimChoice ? (
                    <Text style={styles.toggleNote}>{t('collection.chooseSimBeforeReceipt')}</Text>
                  ) : null}
                </View>
              ) : loadingSmsSubscriptions ? (
                <Text style={styles.toggleNote}>{t('collection.checkingSims')}</Text>
              ) : null}

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
                  <Text style={styles.toggleLabel}>{t('collection.sendSms')}</Text>
                  {smsAvailable === false ? (
                    <Text style={styles.toggleNote}>
                      {t('collection.smsUnavailable')}
                    </Text>
                  ) : null}
                </View>
              </Pressable>

              <View style={styles.submitWrap}>
                <Button
                  title={
                    waitingForSim
                      ? loadingSmsSubscriptions
                        ? t('collection.checkingSimsShort')
                        : t('collection.chooseSim')
                      : willSendSMS
                        ? t('collection.collectSendSms')
                        : t('collection.collect')
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
  simPickerWrap: {
    marginTop: Spacing.md,
  },
  simOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  simOption: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  simOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySurface,
  },
  simOptionText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  simOptionTextSelected: {
    color: Colors.primary,
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
