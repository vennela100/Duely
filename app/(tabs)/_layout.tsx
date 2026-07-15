import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useT } from '@/utils/i18n';

type TabKey = 'index' | 'customers' | 'collection' | 'profile';
type FeatherName = React.ComponentProps<typeof Feather>['name'];

interface TabMeta {
  name: TabKey;
  labelKey: string;
  icon: FeatherName;
}

const TABS: readonly TabMeta[] = [
  { name: 'customers', labelKey: 'tab.customers', icon: 'users' },
  { name: 'collection', labelKey: 'tab.collect', icon: 'dollar-sign' },
  { name: 'index', labelKey: 'tab.reports', icon: 'bar-chart-2' },
  { name: 'profile', labelKey: 'tab.profile', icon: 'user' },
];

function TabButton({
  meta,
  focused,
  onPress,
}: {
  meta: TabMeta;
  focused: boolean;
  onPress: () => void;
}) {
  const t = useT();
  const p = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(focused ? 1 : 0, { duration: 200 });
  }, [focused, p]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.9 + p.value * 0.1 }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      onPress={onPress}
      style={styles.tab}
      hitSlop={6}
    >
      <Animated.View style={[styles.pill, pillStyle]} />
      <Feather name={meta.icon} size={22} color={focused ? Colors.textPrimary : Colors.textTertiary} />
      <Text style={[styles.label, { color: focused ? Colors.textPrimary : Colors.textTertiary }]}>
        {t(meta.labelKey)}
      </Text>
    </Pressable>
  );
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, Spacing.md);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: bottomOffset }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const meta = TABS.find((t) => t.name === route.name) ?? TABS[index];
          const focused = state.index === index;
          const onPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return <TabButton key={route.key} meta={meta} focused={focused} onPress={onPress} />;
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="customers"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="customers" options={{ title: 'Customers' }} />
      <Tabs.Screen name="collection" options={{ title: 'Collect' }} />
      <Tabs.Screen name="index" options={{ title: 'Reports' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  tab: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    ...StyleSheet.absoluteFill,
    marginVertical: 2,
    marginHorizontal: 6,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceElevated,
  },
  label: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    marginTop: 3,
  },
});
