import React, { useEffect } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '@/constants/theme';
import { formatINR } from '@/utils/format';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export interface AmountDisplayProps {
  amount: number;
  size?: number;
  color?: string;
  animate?: boolean;
  prefix?: string;
  bold?: boolean;
  mono?: boolean;
}

const formatValue = (value: number, prefix?: string): string => {
  'worklet';
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  let s = String(abs);
  if (abs >= 1000) {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    s = `${grouped},${last3}`;
  }
  const symbol = prefix !== undefined ? prefix : '₹';
  return `${sign}${symbol}${s}`;
};

export function AmountDisplay({
  amount,
  size = 28,
  color = Colors.textPrimary,
  animate = false,
  prefix,
  bold = true,
  mono = true,
}: AmountDisplayProps) {
  const value = useSharedValue(animate ? 0 : amount);

  useEffect(() => {
    if (animate) {
      value.value = withTiming(amount, { duration: 700 });
    } else {
      value.value = amount;
    }
  }, [amount, animate, value]);

  const animatedProps = useAnimatedProps(() => {
    return {
      text: formatValue(value.value, prefix),
      defaultValue: formatValue(value.value, prefix),
    } as Partial<{ text: string; defaultValue: string }>;
  });

  const fontFamily = mono
    ? bold
      ? 'GeistMono_700Bold'
      : 'GeistMono_500Medium'
    : bold
      ? 'Geist_800ExtraBold'
      : 'Geist_600SemiBold';

  const textStyle = [
    styles.text,
    {
      fontSize: size,
      color,
      fontFamily,
    },
  ];

  if (!animate) {
    const display =
      prefix !== undefined
        ? `${prefix}${formatINR(amount, false)}`
        : formatINR(amount, true);
    return <Text style={textStyle}>{display}</Text>;
  }

  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      style={textStyle}
      animatedProps={animatedProps}
      defaultValue={formatValue(amount, prefix)}
    />
  );
}

const styles = StyleSheet.create({
  text: {
    padding: 0,
    margin: 0,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
});
