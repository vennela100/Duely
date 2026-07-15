import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardTypeOptions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Radius } from '@/constants/theme';

export interface InputProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  rightElement?: React.ReactNode;
  multiline?: boolean;
  prefix?: string;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  error,
  rightElement,
  multiline,
  prefix,
}: InputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const focusProgress = useSharedValue(value ? 1 : 0);
  const borderProgress = useSharedValue(0);

  useEffect(() => {
    const shouldFloat = focused || value.length > 0;
    focusProgress.value = withTiming(shouldFloat ? 1 : 0, { duration: 180 });
  }, [focused, value, focusProgress]);

  useEffect(() => {
    borderProgress.value = withTiming(focused ? 1 : 0, { duration: 180 });
  }, [focused, borderProgress]);

  const labelStyle = useAnimatedStyle(() => {
    const translateY = interpolate(focusProgress.value, [0, 1], [18, 6]);
    const fontSize = interpolate(focusProgress.value, [0, 1], [16, 12]);
    const color = interpolateColor(
      focusProgress.value,
      [0, 1],
      [Colors.textTertiary, Colors.primary],
    );
    return {
      transform: [{ translateY }],
      fontSize,
      color,
    };
  });

  const borderStyle = useAnimatedStyle(() => {
    if (error) {
      return { borderColor: Colors.danger };
    }
    const borderColor = interpolateColor(
      borderProgress.value,
      [0, 1],
      [Colors.border, Colors.primary],
    );
    return { borderColor };
  });

  const focusInput = () => {
    inputRef.current?.focus();
  };

  return (
    <View>
      <Pressable onPress={focusInput}>
        <Animated.View
          style={[
            styles.container,
            multiline && styles.containerMultiline,
            borderStyle,
          ]}
        >
          <Animated.Text style={[styles.label, labelStyle]}>
            {label}
          </Animated.Text>
          <View style={styles.row}>
            {/* Only show the prefix once the label has floated up, else they overlap. */}
            {prefix && (focused || value.length > 0) ? <Text style={styles.prefix}>{prefix}</Text> : null}
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChangeText}
              placeholder={focused ? placeholder : undefined}
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry={secureTextEntry}
              keyboardType={keyboardType}
              autoCapitalize={autoCapitalize}
              multiline={multiline}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={[styles.input, multiline && styles.inputMultiline]}
            />
            {rightElement ? (
              <View style={styles.right}>{rightElement}</View>
            ) : null}
          </View>
        </Animated.View>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 58,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 6,
  },
  containerMultiline: {
    minHeight: 96,
    paddingTop: 26,
    paddingBottom: 12,
  },
  label: {
    position: 'absolute',
    left: 16,
    top: 0,
    fontFamily: 'Geist_500Medium',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefix: {
    fontFamily: 'Geist_500Medium',
    fontSize: 16,
    color: Colors.textSecondary,
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontFamily: 'Geist_400Regular',
    fontSize: 16,
    color: Colors.textPrimary,
    padding: 0,
    margin: 0,
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  right: {
    marginLeft: 8,
  },
  error: {
    marginTop: 6,
    fontFamily: 'Geist_400Regular',
    fontSize: 12,
    color: Colors.danger,
  },
});
