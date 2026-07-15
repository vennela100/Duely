import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card } from '@/components/ui/Card';
import { Colors, Spacing, Typography } from '@/constants/theme';

export type StatTrend = 'up' | 'down' | 'flat';

export interface StatItem {
  label: string;
  value: string;
  trend?: StatTrend;
  color?: string;
}

export interface SummaryStatsProps {
  stats: StatItem[];
  columns?: 2 | 3;
}

const TREND_GLYPH: Record<StatTrend, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};

const TREND_COLOR: Record<StatTrend, string> = {
  up: Colors.success,
  down: Colors.danger,
  flat: Colors.textTertiary,
};

export function SummaryStats({ stats, columns = 3 }: SummaryStatsProps) {
  const gap = Spacing.sm;
  return (
    <View style={[styles.grid, { marginHorizontal: -gap / 2 }]}>
      {stats.map((s, i) => (
        <Animated.View
          key={`${s.label}-${i}`}
          entering={FadeInDown.delay(i * 80).duration(360)}
          style={[
            styles.cell,
            {
              flexBasis: `${100 / columns}%`,
              paddingHorizontal: gap / 2,
              marginBottom: gap,
            },
          ]}
        >
          <Card padding="md" style={styles.card}>
            <Text style={styles.label} numberOfLines={1}>
              {s.label}
            </Text>
            <View style={styles.valueRow}>
              <Text
                style={[
                  styles.value,
                  { color: s.color ?? Colors.textPrimary },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {s.value}
              </Text>
              {s.trend ? (
                <Text
                  style={[
                    styles.trend,
                    { color: TREND_COLOR[s.trend] },
                  ]}
                >
                  {TREND_GLYPH[s.trend]}
                </Text>
              ) : null}
            </View>
          </Card>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {},
  card: {
    minHeight: 78,
  },
  label: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontFamily: Typography.display,
    fontSize: 20,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  trend: {
    marginLeft: 6,
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
  },
});
