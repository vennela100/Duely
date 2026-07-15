import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { CustomerCard } from '@/components/customer/CustomerCard';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { useCustomers } from '@/hooks/useCustomers';
import { updateCustomer } from '@/services/customers.service';
import { daysBetween } from '@/utils/date';
import { remainingAmount } from '@/utils/calc';
import { formatINR } from '@/utils/format';
import { useT } from '@/utils/i18n';
import { BrandBar } from '@/components/ui/BrandBar';
import type { Customer, CustomerStatus } from '@/types';

type Filter = 'all' | CustomerStatus;
type SortKey = 'name' | 'amount' | 'endDate' | 'daysRemaining';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'defaulted', label: 'Defaulted' },
  { key: 'paused', label: 'Paused' },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'amount', label: 'Amount' },
  { key: 'endDate', label: 'End Date' },
  { key: 'daysRemaining', label: 'Days Remaining' },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function CustomersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { customers, loading, refresh } = useCustomers();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOpen, setSortOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuFor, setMenuFor] = useState<Customer | null>(null);

  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const activeCount = useMemo(
    () => customers.filter((c) => c.status === 'active').length,
    [customers],
  );

  const totalDue = useMemo(
    () =>
      customers
        .filter((c) => c.status === 'active')
        .reduce((sum, c) => sum + remainingAmount(c), 0),
    [customers],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = customers;
    if (filter !== 'all') {
      list = list.filter((c) => c.status === filter);
    }
    if (q.length > 0) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.phoneRaw.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'amount':
          return b.dealAmount - a.dealAmount;
        case 'endDate':
          return a.endDate.localeCompare(b.endDate);
        case 'daysRemaining':
          return remainingDays(a) - remainingDays(b);
        default:
          return 0;
      }
    });
    return sorted;
  }, [customers, search, filter, sortKey]);

  // Long-press a card → quick status change without opening the editor.
  const onCardLongPress = (c: Customer) => setMenuFor(c);

  const menuSetStatus = (status: CustomerStatus) => {
    if (menuFor) updateCustomer('local', menuFor.id, { status });
    setMenuFor(null);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const onFabPressIn = () => {
    fabScale.value = withSpring(0.92, { damping: 18, stiffness: 320 });
  };
  const onFabPressOut = () => {
    fabScale.value = withSpring(1, { damping: 18, stiffness: 320 });
  };
  const onFabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/customer/add');
  };

  const renderHeader = () => (
    <View>
      <BrandBar title={t('tab.customers')} />

      <View style={[styles.netBalance, { marginTop: Spacing.sm }]}>
        <View>
          <Text style={styles.netLabel}>{t('common.totalOutstanding')}</Text>
          <Text style={styles.netSub}>{activeCount} {t('customers.activeAccounts')}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', flexShrink: 1, marginLeft: Spacing.md }}>
          <Text style={styles.netAmount} numberOfLines={1} adjustsFontSizeToFit>
            {formatINR(totalDue)}
          </Text>
          <Text style={styles.netSub}>{t('common.youGet')}</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Feather name="search" size={16} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t('customers.search')}
          placeholderTextColor={Colors.textTertiary}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>{t('customers.sortBy')}</Text>
        <Pressable
          onPress={() => setSortOpen(true)}
          style={styles.sortButton}
          accessibilityRole="button"
        >
          <Text style={styles.sortValue}>
            {SORT_OPTIONS.find((o) => o.key === sortKey)?.label}
          </Text>
          <Feather name="chevron-down" size={14} color={Colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );

  const fabBottom = Math.max(insets.bottom, Spacing.md) + 76;

  if (loading && customers.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
        {renderHeader()}
        <View style={styles.skeletonList}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.skeletonCard}>
              <Skeleton width="100%" height={104} radius={Radius.lg} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
      <FlashList
        data={filtered}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
        renderItem={({ item }) => (
          <CustomerCard
            customer={item}
            onPress={() => router.push(`/customer/${item.id}`)}
            onLongPress={() => onCardLongPress(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              emoji="👥"
              title="No customers yet"
              message="Add your first customer to get started"
              cta={{
                label: 'Add Customer',
                onPress: () => router.push('/customer/add'),
              }}
            />
          </View>
        }
        refreshing={refreshing}
        onRefresh={onRefresh}
      />

      <AnimatedPressable
        onPress={onFabPress}
        onPressIn={onFabPressIn}
        onPressOut={onFabPressOut}
        style={[styles.fab, { bottom: fabBottom }, fabStyle]}
        accessibilityRole="button"
        accessibilityLabel="Add customer"
      >
        <Feather name="plus" size={26} color={Colors.textInverse} />
      </AnimatedPressable>

      <Modal
        visible={sortOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSortOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSortOpen(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sort by</Text>
            {SORT_OPTIONS.map((o) => {
              const active = sortKey === o.key;
              return (
                <Pressable
                  key={o.key}
                  onPress={() => {
                    setSortKey(o.key);
                    setSortOpen(false);
                  }}
                  style={[styles.modalRow, active && styles.modalRowActive]}
                >
                  <Text
                    style={[
                      styles.modalRowLabel,
                      active && styles.modalRowLabelActive,
                    ]}
                  >
                    {o.label}
                  </Text>
                  {active ? <Text style={styles.modalCheck}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Long-press status menu — dismiss by tapping outside or Cancel */}
      <Modal
        visible={!!menuFor}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuFor(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuFor(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle} numberOfLines={1}>{menuFor?.name}</Text>
            {menuFor?.status === 'paused' ? (
              <MenuItem icon="play" label="Resume (Active)" onPress={() => menuSetStatus('active')} />
            ) : (
              <MenuItem icon="pause" label="Pause" onPress={() => menuSetStatus('paused')} />
            )}
            {menuFor?.status === 'defaulted' ? (
              <MenuItem icon="rotate-ccw" label="Clear Defaulted" onPress={() => menuSetStatus('active')} />
            ) : (
              <MenuItem icon="alert-triangle" label="Mark Defaulted" danger onPress={() => menuSetStatus('defaulted')} />
            )}
            <MenuItem icon="edit-2" label="Edit details" onPress={() => { const id = menuFor?.id; setMenuFor(null); if (id) router.push(`/customer/edit/${id}`); }} />
            <Pressable style={styles.menuCancel} onPress={() => setMenuFor(null)}>
              <Text style={styles.menuCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuItem({ icon, label, danger, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]} onPress={onPress}>
      <Feather name={icon} size={18} color={danger ? Colors.danger : Colors.textPrimary} />
      <Text style={[styles.menuItemText, danger && { color: Colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

const remainingDays = (c: Customer): number => {
  const todayISO = new Date().toISOString().slice(0, 10);
  return Math.max(daysBetween(todayISO, c.endDate), 0);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 160,
  },
  headerTop: {
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: Typography.display,
    fontSize: 32,
    color: Colors.textPrimary,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  netBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  netLabel: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.textSecondary },
  netSub: { fontFamily: Typography.body, fontSize: 11, color: Colors.textTertiary, marginTop: 3 },
  netAmount: { fontFamily: Typography.display, fontSize: 22, color: Colors.amountNegative, letterSpacing: -0.5 },
  rowDivider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 64 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 44,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textPrimary,
    padding: 0,
  },
  searchIcon: {
    fontSize: 16,
  },
  chipsRow: {
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
  },
  chipActive: {
    backgroundColor: Colors.primary,
  },
  chipLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  chipLabelActive: {
    color: Colors.textInverse,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sortLabel: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textTertiary,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  sortValue: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  sortChevron: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  skeletonList: {
    paddingHorizontal: Spacing.lg,
  },
  skeletonCard: {
    marginBottom: Spacing.sm,
  },
  emptyWrap: {
    paddingTop: Spacing.xl,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
  },
  fabIcon: {
    fontSize: 28,
    color: Colors.textInverse,
    lineHeight: 30,
    fontFamily: Typography.heading,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    ...Shadow.lg,
  },
  modalTitle: {
    fontFamily: Typography.heading,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm },
  menuItemText: { fontFamily: Typography.bodyMedium, fontSize: 15, color: Colors.textPrimary },
  menuCancel: { marginTop: Spacing.sm, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: Radius.md, backgroundColor: Colors.surfaceElevated },
  menuCancelText: { fontFamily: Typography.bodyMedium, fontSize: 15, color: Colors.textSecondary },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  modalRowActive: {
    backgroundColor: Colors.primarySurface,
  },
  modalRowLabel: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  modalRowLabelActive: {
    color: Colors.primary,
    fontFamily: Typography.bodyMedium,
  },
  modalCheck: {
    fontSize: 16,
    color: Colors.primary,
  },
});
