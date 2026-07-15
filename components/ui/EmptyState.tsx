import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { Button } from './Button';

export interface EmptyStateProps {
  emoji: string;
  title: string;
  message: string;
  cta?: { label: string; onPress: () => void };
}

export function EmptyState({ emoji, title, message, cta }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {cta ? (
        <View style={styles.cta}>
          <Button title={cta.label} onPress={cta.onPress} variant="outline" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  emoji: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  message: {
    fontFamily: 'Geist_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  cta: {
    marginTop: Spacing.lg,
  },
});
