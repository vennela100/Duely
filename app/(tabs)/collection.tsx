import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Feather } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors, Glass, Radius, Spacing, Typography } from '@/constants/theme';
import { useCustomers } from '@/hooks/useCustomers';
import { useTodayCollection } from '@/hooks/useCollection';
import { formatINR } from '@/utils/format';
import { formatLong, today } from '@/utils/date';
import { remainingAmount } from '@/utils/calc';
import { useT } from '@/utils/i18n';
import { BrandBar } from '@/components/ui/BrandBar';
import type { Customer } from '@/types';

type Tab = 'pending' | 'done';

function AllDone({ hasActive }: { hasActive: boolean }) {
  const t = useT();
  const scale = useSharedValue(0);
  const ring = useSharedValue(0);
  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.15, { damping: 8, stiffness: 160 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );
    ring.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [scale, ring]);
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + ring.value * 0.7 }],
    opacity: (1 - ring.value) * 0.4,
  }));
  return (
    <View style={styles.allDone}>
      <View style={styles.allDoneArt}>
        <Animated.View style={[styles.allDoneRing, ringStyle]} />
        <Animated.View style={[styles.allDoneCircle, checkStyle]}>
          <Feather name="check" size={40} color={Colors.textInverse} />
        </Animated.View>
      </View>
      <Text style={styles.allDoneTitle}>{hasActive ? t('collect.allCollected') : t('collect.nothingDue')}</Text>
      <Text style={styles.allDoneSub}>
        {hasActive ? t('collect.everyPaid') : t('customers.addCustomer')}
      </Text>
    </View>
  );
}

export default function CollectScreen() {
  const router = useRouter();
  const t = useT();
  const { customers, loading } = useCustomers();
  const { entries, total, wasCollected } = useTodayCollection();
  const [tab, setTab] = useState<Tab>('pending');
  const [txnOpen, setTxnOpen] = useState(false);

  const todayTxns = useMemo(
    () => [...entries].sort((a, b) => b.collectedAt.localeCompare(a.collectedAt)),
    [entries],
  );
  const timeOf = (iso: string) => {
    const d = new Date(iso);
    let h = d.getHours();
    const m = d.getMinutes();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
  };

  const active = useMemo(() => customers.filter((c) => c.status === 'active'), [customers]);
  const pending = useMemo(() => active.filter((c) => !wasCollected(c.id)), [active, wasCollected, entries]);
  const done = useMemo(() => active.filter((c) => wasCollected(c.id)), [active, wasCollected, entries]);
  const expected = useMemo(() => active.reduce((s, c) => s + c.dailyAmount, 0), [active]);
  const rawPct = expected > 0 ? Math.round((total / expected) * 100) : total > 0 ? 100 : 0;
  const fillPct = Math.min(rawPct, 100);
  const extra = total - expected;

  const headerDate = useMemo(() => formatLong(today()), []);
  const list = tab === 'pending' ? pending : done;

  const renderHeader = () => (
    <View>
      <BrandBar title={t('tab.collect')} />
      <Text style={[styles.subtitle, { marginTop: Spacing.sm }]}>{headerDate}</Text>

      <View style={styles.summary}>
        <Pressable style={{ flex: 1 }} onPress={() => total > 0 && setTxnOpen(true)}>
          <View style={styles.sumLabelRow}>
            <Text style={styles.sumLabel}>{t('collect.collectedToday')}</Text>
            {total > 0 ? <Feather name="chevron-right" size={13} color={Colors.textTertiary} /> : null}
          </View>
          <Text style={styles.sumValue}>{formatINR(total)}</Text>
          <Text style={[styles.sumMeta, extra > 0 && { color: Colors.success }]}>
            {extra > 0 ? `+${formatINR(extra)} ${t('collect.aboveTarget')}` : `${formatINR(expected)} ${t('collect.expected')}`}
          </Text>
        </Pressable>
        <View style={styles.pctRing}>
          <Text style={styles.pctText}>{rawPct}%</Text>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fillPct}%` }]} />
      </View>

      <View style={styles.tabs}>
        <Pressable onPress={() => setTab('pending')} style={[styles.tab, tab === 'pending' && styles.tabActive]}>
          <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>{t('collect.pending')} ({pending.length})</Text>
        </Pressable>
        <Pressable onPress={() => setTab('done')} style={[styles.tab, tab === 'done' && styles.tabActive]}>
          <Text style={[styles.tabText, tab === 'done' && styles.tabTextActive]}>{t('collect.done')} ({done.length})</Text>
        </Pressable>
      </View>
    </View>
  );

  if (loading && customers.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.content}>
          {renderHeader()}
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ marginTop: Spacing.sm }}>
              <Skeleton width="100%" height={60} radius={Radius.md} />
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlashList
        data={list}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        renderItem={({ item }: { item: Customer }) => {
          const collected = wasCollected(item.id);
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
              onPress={() =>
                collected
                  ? router.push(`/customer/${item.id}`)
                  : router.push(`/customer/txn/${item.id}?type=received`)
              }
            >
              <Avatar name={item.name} photo={item.photo} size={44} />
              <View style={styles.rowMid}>
                <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.rowSub}>{formatINR(remainingAmount(item))} {t('common.due').toLowerCase()}</Text>
              </View>
              {collected ? (
                <View style={styles.doneTag}>
                  <Feather name="check" size={14} color={Colors.amountPositive} />
                  <Text style={styles.doneText}>{t('collect.done')}</Text>
                </View>
              ) : (
                <View style={styles.collectBtn}>
                  <Feather name="arrow-down-left" size={13} color={Colors.amountNegative} />
                  <Text style={styles.collectText}>{formatINR(item.dailyAmount)}</Text>
                </View>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          tab === 'pending' ? (
            <AllDone hasActive={active.length > 0} />
          ) : (
            <Text style={styles.empty}>{t('collect.nothingCollected')}</Text>
          )
        }
      />

      <Modal visible={txnOpen} transparent animationType="slide" onRequestClose={() => setTxnOpen(false)}>
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setTxnOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetGrab} />
            <View style={styles.sheetHead}>
              <View>
                <Text style={styles.sheetTitle}>{t('collect.collectedToday')}</Text>
                <Text style={styles.sheetSub}>{todayTxns.length} {t('common.payments')} · {formatINR(total)}</Text>
              </View>
              <Pressable onPress={() => setTxnOpen(false)} hitSlop={10} style={styles.sheetClose}>
                <Feather name="x" size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
              {todayTxns.map((e, i) => (
                <View key={e.id}>
                  <Pressable style={styles.tRow} onPress={() => { setTxnOpen(false); router.push(`/customer/${e.customerId}`); }}>
                    <Avatar name={e.customerName} size={38} />
                    <View style={styles.tMid}>
                      <Text style={styles.tName} numberOfLines={1}>{e.customerName}</Text>
                      <Text style={styles.tTime}>{timeOf(e.collectedAt)}</Text>
                    </View>
                    <Text style={styles.tAmt}>+{formatINR(e.amount)}</Text>
                  </Pressable>
                  {i < todayTxns.length - 1 ? <View style={styles.tDivider} /> : null}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: 120 },
  title: { fontFamily: Typography.display, fontSize: 32, color: Colors.textPrimary, letterSpacing: -0.8, marginTop: Spacing.sm },
  subtitle: { fontFamily: Typography.body, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.lg, padding: Spacing.lg, borderRadius: Radius.xl, ...Glass },
  sumLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sumLabel: { fontFamily: Typography.body, fontSize: 12, color: Colors.textTertiary },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: Colors.overlay },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  sheetGrab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: Spacing.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  sheetTitle: { fontFamily: Typography.display, fontSize: 22, color: Colors.textPrimary, letterSpacing: -0.5 },
  sheetSub: { fontFamily: Typography.body, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  sheetClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  tRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  tMid: { flex: 1, minWidth: 0 },
  tName: { fontFamily: Typography.heading, fontSize: 15, color: Colors.textPrimary },
  tTime: { fontFamily: Typography.body, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  tAmt: { fontFamily: Typography.heading, fontSize: 16, color: Colors.amountPositive },
  tDivider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 50 },
  sumValue: { fontFamily: Typography.display, fontSize: 28, color: Colors.textPrimary, letterSpacing: -1, marginTop: 3 },
  sumMeta: { fontFamily: Typography.body, fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  pctRing: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  pctText: { fontFamily: Typography.heading, fontSize: 15, color: Colors.textInverse },
  track: { height: 5, backgroundColor: Colors.surfaceElevated, borderRadius: 3, marginTop: Spacing.sm, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },

  tabs: { flexDirection: 'row', backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md, padding: 4, marginTop: Spacing.lg, marginBottom: Spacing.xs },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: Radius.sm },
  tabActive: { ...Glass },
  tabText: { fontFamily: Typography.bodyMedium, fontSize: 14, color: Colors.textSecondary },
  tabTextActive: { color: Colors.textPrimary },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  rowMid: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: Typography.heading, fontSize: 16, color: Colors.textPrimary, letterSpacing: -0.3 },
  rowSub: { fontFamily: Typography.body, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  collectBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.dangerLight, borderRadius: Radius.full },
  collectText: { fontFamily: Typography.heading, fontSize: 13, color: Colors.amountNegative },
  doneTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.successLight, borderRadius: Radius.full },
  doneText: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.amountPositive },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 60 },
  empty: { fontFamily: Typography.body, fontSize: 14, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.xl },
  allDone: { alignItems: 'center', paddingTop: Spacing.xxl },
  allDoneArt: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  allDoneRing: { position: 'absolute', width: 104, height: 104, borderRadius: 52, borderWidth: 3, borderColor: Colors.success },
  allDoneCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center' },
  allDoneTitle: { fontFamily: Typography.display, fontSize: 18, color: Colors.textPrimary, marginTop: Spacing.lg, letterSpacing: -0.4 },
  allDoneSub: { fontFamily: Typography.body, fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
});
