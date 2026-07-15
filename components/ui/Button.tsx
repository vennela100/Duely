import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Shadow } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'outline' | 'text' | 'danger';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
}: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isDisabled = disabled || loading;

  const handlePressIn = () => {
    if (isDisabled) return;
    scale.value = withSpring(0.97, { damping: 18, stiffness: 320 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 320 });
  };

  const handlePress = () => {
    if (isDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const height = size === 'lg' ? 52 : 44;
  const variantStyle = VARIANT_STYLES[variant];
  const textColor = VARIANT_TEXT[variant];

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        variantStyle,
        { height },
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text style={[styles.label, { color: textColor }]}>{title}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const VARIANT_STYLES: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: Colors.primary,
    ...Shadow.md,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  text: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.danger,
    ...Shadow.md,
  },
};

const VARIANT_TEXT: Record<ButtonVariant, string> = {
  primary: Colors.textInverse,
  outline: Colors.primary,
  text: Colors.primary,
  danger: Colors.textInverse,
};

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  label: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 16,
    letterSpacing: 0.1,
  },
});
