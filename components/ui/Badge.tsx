import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors, Radius } from '@/constants/theme';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const VARIANT_COLORS: Record<BadgeVariant, { bg: string; fg: string }> = {
  success: { bg: Colors.successLight, fg: Colors.success },
  warning: { bg: Colors.warningLight, fg: Colors.warning },
  danger: { bg: Colors.dangerLight, fg: Colors.danger },
  info: { bg: Colors.primarySurface, fg: Colors.primary },
  neutral: { bg: Colors.surfaceElevated, fg: Colors.textSecondary },
};

export function Badge({ label, variant = 'neutral', size = 'md' }: BadgeProps) {
  const { bg, fg } = VARIANT_COLORS[variant];

  const containerStyle: ViewStyle =
    size === 'sm'
      ? { paddingHorizontal: 8, paddingVertical: 4 }
      : { paddingHorizontal: 12, paddingVertical: 6 };

  const fontSize = size === 'sm' ? 11 : 12;

  return (
    <View style={[styles.base, containerStyle, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg, fontSize }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'Geist_500Medium',
    letterSpacing: 0.2,
  },
});
