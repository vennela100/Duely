import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import type { Customer } from '@/types';
import { formatINR } from '@/utils/format';
import { formatDisplay, today } from '@/utils/date';
import { remainingAmount } from '@/utils/calc';
import { useT } from '@/utils/i18n';

export interface CustomerCardProps {
  customer: Customer;
  onPress?: () => void;
  onLongPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CustomerCard({ customer, onPress, onLongPress }: CustomerCardProps) {
  const t = useT();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const remaining = remainingAmount(customer);
  const settled = remaining <= 0 || customer.status === 'completed';
  const overdue = !settled && customer.status === 'active' && customer.endDate < today();

  const badge = settled
    ? { label: t('common.completed'), fg: Colors.success, bg: Colors.successLight }
    : overdue
      ? { label: t('common.overdue'), fg: Colors.danger, bg: Colors.dangerLight }
      : customer.status === 'paused'
        ? { label: t('common.paused'), fg: Colors.warning, bg: Colors.warningLight }
        : { label: t('common.active'), fg: Colors.textSecondary, bg: Colors.surfaceElevated };

  const sub = customer.lastCollectionDate
    ? `${t('customers.lastPaid')} ${formatDisplay(customer.lastCollectionDate)}`
    : `${formatINR(customer.dailyAmount)}/day · Day ${customer.daysCollected}/${customer.collectionDays}`;

  const handleLongPress = () => {
    if (!onLongPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onLongPress();
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress ? handleLongPress : undefined}
      onPressIn={() => {
        scale.value = withSpring(0.99, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 18, stiffness: 320 });
      }}
      style={[styles.row, animatedStyle]}
    >
      <Avatar name={customer.name} photo={customer.photo} size={48} />
      <View style={styles.mid}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{customer.name}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
          </View>
        </View>
        <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
      </View>
      <View style={styles.right}>
        {settled ? (
          <>
            <Text style={styles.settled} numberOfLines={1}>{t('common.settled')}</Text>
            <Text style={styles.rightLabel}>{t('common.completed')}</Text>
          </>
        ) : (
          <>
            <Text style={styles.amount} numberOfLines={1}>{formatINR(remaining)}</Text>
            <Text style={styles.rightLabel}>{t('common.due')}</Text>
          </>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  mid: { flex: 1, minWidth: 0, flexShrink: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { fontFamily: Typography.heading, fontSize: 16, color: Colors.textPrimary, letterSpacing: -0.3, flexShrink: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  badgeText: { fontFamily: Typography.bodyMedium, fontSize: 10, letterSpacing: 0.2 },
  sub: { fontFamily: Typography.body, fontSize: 13, color: Colors.textSecondary, marginTop: 3 },
  right: { alignItems: 'flex-end', minWidth: 76, marginLeft: Spacing.sm },
  amount: { fontFamily: Typography.heading, fontSize: 17, color: Colors.amountNegative, letterSpacing: -0.3 },
  settled: { fontFamily: Typography.heading, fontSize: 15, color: Colors.amountPositive },
  rightLabel: { fontFamily: Typography.body, fontSize: 11, color: Colors.textTertiary, marginTop: 3 },
});
