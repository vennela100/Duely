import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { formatINR } from '@/utils/format';

export interface SuccessOverlayProps {
  visible: boolean;
  amount: number;
  label: string; // e.g. "received" / "given"
  color?: string;
  onDone: () => void;
}

export function SuccessOverlay({ visible, amount, label, color = Colors.success, onDone }: SuccessOverlayProps) {
  const scale = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      scale.value = 0;
      ring.value = 0;
      return;
    }
    ring.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    scale.value = withSequence(
      withSpring(1.15, { damping: 8, stiffness: 160 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );
    const t = setTimeout(onDone, 1150);
    return () => clearTimeout(t);
  }, [visible, scale, ring, onDone]);

  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + ring.value * 0.7 }],
    opacity: (1 - ring.value) * 0.5,
  }));

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.root}>
        <View style={styles.center}>
          <Animated.View style={[styles.ring, { borderColor: color }, ringStyle]} />
          <Animated.View style={[styles.circle, { backgroundColor: color }, checkStyle]}>
            <Feather name="check" size={48} color={Colors.textInverse} />
          </Animated.View>
        </View>
        <Animated.Text entering={FadeIn.delay(200).duration(300)} style={styles.amount}>
          {formatINR(amount)}
        </Animated.Text>
        <Animated.Text entering={FadeIn.delay(280).duration(300)} style={styles.label}>
          {label}
        </Animated.Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(255,255,255,0.97)', alignItems: 'center', justifyContent: 'center' },
  center: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 3 },
  circle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  amount: { fontFamily: Typography.display, fontSize: 30, color: Colors.textPrimary, letterSpacing: -1, marginTop: Spacing.lg },
  label: { fontFamily: Typography.bodyMedium, fontSize: 15, color: Colors.textSecondary, marginTop: Spacing.xs, textTransform: 'capitalize' },
});
