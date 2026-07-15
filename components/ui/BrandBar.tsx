import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { LanguageModal } from './LanguageModal';

// Duely wordmark — distinctive lowercase logotype with a green accent dot.
export function BrandWordmark({ size = 26 }: { size?: number }) {
  return (
    <View style={styles.brand}>
      <Text style={[styles.brandText, { fontSize: size }]}>duely</Text>
      <View style={[styles.dot, { width: size * 0.16, height: size * 0.16, borderRadius: size * 0.08 }]} />
    </View>
  );
}

// Top bar on every page: big brand left, page name centered, language switch right.
export function BrandBar({ title }: { title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.bar}>
      <BrandWordmark size={26} />
      {title ? (
        <View style={styles.titleWrap} pointerEvents="none">
          <Text style={styles.pageTitle}>{title}</Text>
        </View>
      ) : null}
      <Pressable style={styles.langBtn} onPress={() => setOpen(true)} hitSlop={8}>
        <Feather name="globe" size={16} color={Colors.textSecondary} />
      </Pressable>
      <LanguageModal visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 46 },
  titleWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontFamily: Typography.heading, fontSize: 15, color: Colors.textSecondary, letterSpacing: -0.2 },
  brand: { flexDirection: 'row', alignItems: 'flex-end' },
  brandText: {
    fontFamily: Typography.display,
    color: Colors.textPrimary,
    letterSpacing: -1.2,
  },
  dot: { backgroundColor: Colors.success, marginLeft: 2, marginBottom: 6 },
  langBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
