import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { TransactionLedger } from '@/components/customer/TransactionLedger';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useCustomer } from '@/hooks/useCustomer';
import { useUIStore } from '@/store/ui.store';
import { deleteCustomer } from '@/services/customers.service';
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

  if (!customer) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState
          emoji="🔍"
          title="Customer not found"
          message="This account may have been deleted."
          cta={{ label: 'Go back', onPress: () => router.back() }}
        />
      </SafeAreaView>
    );
  }

  const due = remainingAmount(customer);

  const confirmDelete = () => {
    Alert.alert('Delete account', `Delete ${customer.name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          try {
            await deleteCustomer(user.uid, customer.id);
            showToast('Account deleted', 'success');
            router.back();
          } catch (e) {
            showToast(e instanceof Error ? e.message : 'Delete failed', 'error');
          }
        },
      },
    ]);
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
});
