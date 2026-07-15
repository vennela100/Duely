import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { initialsOf } from '@/utils/format';

export interface AvatarProps {
  name: string;
  photo?: string;
  size?: number;
}

const PALETTE = [
  '#4F46E5',
  '#6366F1',
  '#8B5CF6',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
];

const hashName = (name: string): number => {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h << 5) - h + name.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

export function Avatar({ name, photo, size = 40 }: AvatarProps) {
  const radius = size / 2;

  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={[
          styles.image,
          { width: size, height: size, borderRadius: radius },
        ]}
      />
    );
  }

  const bg = PALETTE[hashName(name) % PALETTE.length];
  const initials = initialsOf(name);

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: bg,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#E2E8F0',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontFamily: 'Geist_600SemiBold',
    letterSpacing: 0.3,
  },
});
