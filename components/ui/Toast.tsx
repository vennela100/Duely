import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { useUIStore } from '@/store/ui.store';

const TYPE_COLORS = {
  success: Colors.success,
  error: Colors.danger,
  info: Colors.primary,
} as const;

const AUTO_DISMISS_MS = 2500;

export function Toast() {
  const toast = useUIStore((s) => s.toast);
  const hideToast = useUIStore((s) => s.hideToast);
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (toast) {
      translateY.value = withTiming(0, { duration: 240 });
      opacity.value = withTiming(1, { duration: 200 });
      const timer = setTimeout(() => {
        hideToast();
      }, AUTO_DISMISS_MS);
      return () => clearTimeout(timer);
    }
    translateY.value = withTiming(-120, { duration: 200 });
    opacity.value = withTiming(0, { duration: 160 });
    return undefined;
  }, [toast, hideToast, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!toast) {
    return null;
  }

  const bg = TYPE_COLORS[toast.type];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { top: insets.top + Spacing.sm },
        animatedStyle,
      ]}
    >
      <View style={[styles.card, { backgroundColor: bg }]}>
        <Text style={styles.text} numberOfLines={2}>
          {toast.message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 9999,
  },
  card: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    ...Shadow.md,
  },
  text: {
    color: Colors.textInverse,
    fontFamily: 'Geist_500Medium',
    fontSize: 14,
  },
});
