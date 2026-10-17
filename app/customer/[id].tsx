import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { TransactionLedger } from '@/components/customer/TransactionLedger';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useCustomer } from '@/hooks/useCustomer';
import { useRecordCollection } from '@/hooks/useCollection';
import { useSMSAvailability } from '@/hooks/useSMS';
import { useUIStore } from '@/store/ui.store';
import { deleteCustomer } from '@/services/customers.service';
import { getPreferredSmsSubscriptionId } from '@/services/directSms';
import { canUseBiometric, promptBiometric } from '@/services/biometric';
import { verifyPin } from '@/services/localAuth';
import { remainingAmount } from '@/utils/calc';
import { formatINR } from '@/utils/format';
import { useT } from '@/utils/i18n';

export default function CustomerDetailScreen() {
  const router = useRouter();
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useCustomer(id);
  const user = useUIStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const msgLang = useUIStore((s) => s.msgLang);
  const recordCollection = useRecordCollection();
  const { available: smsAvailable } = useSMSAvailability();

  // Delete box: shows the remaining balance, then Clear → fingerprint/PIN → Delete.
  const [settleOpen, setSettleOpen] = useState(false);
  const [askPin, setAskPin] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [verified, setVerified] = useState(false);
  const [settling, setSettling] = useState(false);

  if (!customer) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState
          emoji="🔍"
          title={t('common.customerNotFound')}
          message={t('detail.mayBeDeleted')}
          cta={{ label: t('common.back'), onPress: () => router.back() }}
        />
      </SafeAreaView>
    );
  }

  const due = remainingAmount(customer);

  const removeAccount = async () => {
    if (!user) return;
    await deleteCustomer(user.uid, customer.id);
    showToast(t('detail.deleted'), 'success');
    router.back();
  };

  const markVerified = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setAskPin(false);
    setPin('');
    setPinError(false);
    setVerified(true);
  };

  // Clear: confirm it's the owner (fingerprint, or the app PIN) before Delete is enabled.
  const clearPressed = async () => {
    if (verified) return;
    setAskPin(true);
    if (await canUseBiometric()) {
      if (await promptBiometric()) markVerified();
    }
  };

  const onPinChange = async (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    setPinError(false);
    if (digits.length < 4) return;
    if (await verifyPin(digits)) {
      markVerified();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setPin('');
      setPinError(true);
    }
  };

  // Delete: record any remaining balance as received (so it reaches ₹0 and
  // totals/reports include it), then remove the account.
  const settleAndDelete = async () => {
    if (!verified || settling || !user) return;
    setSettling(true);
    try {
      if (due > 0) {
        await recordCollection({
          customer,
          amount: due,
          method: 'cash',
          sendSMS: smsAvailable === true,
          simSubscriptionId: await getPreferredSmsSubscriptionId(),
          lang: msgLang,
        });
      }
      setSettleOpen(false);
      await removeAccount();
    } catch (e) {
      showToast(t('detail.deleteFailed'), 'error');
      setSettling(false);
    }
  };

  const closeSettle = () => {
    if (settling) return;
    setSettleOpen(false);
  };

  const confirmDelete = () => {
    setAskPin(false);
    setPin('');
    setPinError(false);
    setVerified(false);
    setSettling(false);
    setSettleOpen(true);
  };

  const go = (type: 'received' | 'given') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(`/customer/txn/${customer.id}?type=${type}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.hBtn}>
          <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Avatar name={customer.name} photo={customer.photo} size={40} />
        <Pressable style={styles.hMid} onPress={() => router.push(`/customer/profile/${customer.id}`)}>
          <Text style={styles.hName} numberOfLines={1}>{customer.name}</Text>
          <Text style={styles.hProfile}>{t('detail.viewProfile')}</Text>
        </Pressable>
        <Pressable onPress={() => router.push(`/customer/edit/${customer.id}`)} hitSlop={10} style={styles.hBtn}>
          <Feather name="edit-2" size={19} color={Colors.textPrimary} />
        </Pressable>
        <Pressable onPress={confirmDelete} hitSlop={10} style={styles.hBtn}>
          <Feather name="trash-2" size={19} color={Colors.textPrimary} />
        </Pressable>
      </View>

      {/* Chat ledger */}
      <View style={styles.ledger}>
        <TransactionLedger customerId={customer.id} />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.quickRow}>
          <Pressable
            style={styles.quickBtn}
            onPress={() => Linking.openURL(`tel:${customer.phone}`)}
          >
            <Feather name="phone" size={16} color={Colors.textPrimary} />
            <Text style={styles.quickText}>{t('detail.call')}</Text>
          </Pressable>
          <Pressable
            style={styles.quickBtn}
            onPress={() => Linking.openURL(`sms:${customer.phone}`)}
          >
            <Feather name="bell" size={16} color={Colors.textPrimary} />
            <Text style={styles.quickText}>{t('detail.remind')}</Text>
          </Pressable>
          <View style={styles.balanceWrap}>
            <Text style={styles.balanceLabel}>{t('detail.balanceDue')}</Text>
            <Text style={styles.balanceValue}>{formatINR(due)}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.actBtn, styles.received, pressed && { opacity: 0.85 }]}
            onPress={() => go('received')}
          >
            <Feather name="arrow-down" size={18} color={Colors.textInverse} />
            <Text style={styles.actText}>{t('common.received')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actBtn, styles.given, pressed && { opacity: 0.85 }]}
            onPress={() => go('given')}
          >
            <Feather name="arrow-up" size={18} color={Colors.textInverse} />
            <Text style={styles.actText}>{t('common.given')}</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={settleOpen} transparent animationType="fade" onRequestClose={closeSettle}>
        <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('detail.settleTitle').replace('{name}', customer.name)}</Text>
            <Text style={styles.sheetHint}>{due > 0 ? t('detail.settleHint') : t('detail.settleNoDue')}</Text>

            {/* Remaining balance, filled in automatically */}
            <Text style={styles.sheetLabel}>{t('detail.settleRemaining')}</Text>
            <TextInput
              style={[styles.sheetInput, styles.sheetAmount]}
              value={formatINR(due)}
              editable={false}
            />

            {/* Step 1: Clear → fingerprint, or the app PIN */}
            <Pressable
              style={[styles.sheetClear, verified && styles.sheetClearDone]}
              disabled={verified || settling}
              onPress={clearPressed}
            >
              <Feather
                name={verified ? 'check-circle' : 'shield'}
                size={17}
                color={verified ? Colors.amountPositive : Colors.textPrimary}
              />
              <Text style={[styles.sheetClearText, verified && { color: Colors.amountPositive }]}>
                {verified ? t('detail.settleVerified') : t('detail.settleClear')}
              </Text>
            </Pressable>

            {askPin && !verified ? (
              <View>
                <Text style={styles.sheetLabel}>{t('detail.settlePin')}</Text>
                <View style={styles.pinRow}>
                  <TextInput
                    style={[styles.sheetInput, styles.pinInput, pinError && styles.sheetInputError]}
                    value={pin}
                    onChangeText={onPinChange}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                    placeholder="••••"
                    placeholderTextColor={Colors.textTertiary}
                  />
                  <Pressable style={styles.bioBtn} onPress={clearPressed} hitSlop={8}>
                    <Text style={styles.bioIcon}>☝</Text>
                  </Pressable>
                </View>
                {pinError ? <Text style={styles.sheetError}>{t('detail.settleWrongPin')}</Text> : null}
              </View>
            ) : null}

            {/* Step 2: Delete, enabled only after verification */}
            <View style={styles.sheetActions}>
              <Pressable
                style={[styles.sheetBtn, styles.sheetCancel]}
                disabled={settling}
                onPress={closeSettle}
              >
                <Text style={styles.sheetCancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.sheetBtn, styles.sheetConfirm, (!verified || settling) && styles.sheetDisabled]}
                disabled={!verified || settling}
                onPress={settleAndDelete}
              >
                <Feather name="trash-2" size={16} color={Colors.textInverse} />
                <Text style={styles.sheetConfirmText}>{t('common.delete')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  hBtn: { padding: 2 },
  hMid: { flex: 1, minWidth: 0 },
  hName: { fontFamily: Typography.heading, fontSize: 17, color: Colors.textPrimary, letterSpacing: -0.3 },
  hProfile: { fontFamily: Typography.body, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },

  ledger: { flex: 1 },

  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
  },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickText: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.textPrimary },
  balanceWrap: { flex: 1, alignItems: 'flex-end' },
  balanceLabel: { fontFamily: Typography.body, fontSize: 11, color: Colors.textTertiary },
  balanceValue: { fontFamily: Typography.display, fontSize: 20, color: Colors.amountNegative, letterSpacing: -0.5, marginTop: 1 },

  actions: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.sm },
  actBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: Radius.full,
  },
  received: { backgroundColor: Colors.amountPositive },
  given: { backgroundColor: Colors.amountNegative },
  actText: { fontFamily: Typography.heading, fontSize: 16, color: Colors.textInverse },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  sheetTitle: { fontFamily: Typography.heading, fontSize: 18, color: Colors.textPrimary },
  sheetHint: { fontFamily: Typography.body, fontSize: 14, color: Colors.textSecondary, marginTop: Spacing.sm, lineHeight: 20 },
  sheetLabel: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary, marginTop: Spacing.md },
  sheetAmount: { fontFamily: Typography.display, fontSize: 22, color: Colors.amountNegative, marginTop: Spacing.xs },
  // Full-width button on its own row (not flex: 1, which collapses its height here).
  sheetClear: {
    flexDirection: 'row',
    gap: 8,
    height: 48,
    marginTop: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetClearDone: { borderColor: Colors.amountPositive },
  sheetClearText: { fontFamily: Typography.heading, fontSize: 15, color: Colors.textPrimary },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pinInput: { flex: 1, letterSpacing: 8, textAlign: 'center', marginTop: Spacing.xs },
  bioBtn: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs },
  bioIcon: { fontSize: 26, color: Colors.primary },
  sheetDisabled: { opacity: 0.35 },
  sheetInput: {
    height: 52,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    fontFamily: Typography.body,
    fontSize: 18,
    color: Colors.textPrimary,
  },
  sheetInputError: { borderColor: Colors.danger },
  sheetError: { fontFamily: Typography.body, fontSize: 13, color: Colors.danger, marginTop: Spacing.xs },
  sheetActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  sheetBtn: { flex: 1, height: 48, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  sheetCancel: { borderWidth: 1, borderColor: Colors.border },
  sheetCancelText: { fontFamily: Typography.bodyMedium, fontSize: 15, color: Colors.textPrimary },
  sheetConfirm: { flexDirection: 'row', gap: 6, backgroundColor: Colors.amountNegative },
  sheetConfirmText: { fontFamily: Typography.heading, fontSize: 15, color: Colors.textInverse },
});
