import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';
import { format, parseISO } from 'date-fns';
import { Colors, Typography } from '@/constants/theme';
import { today as todayISO } from '@/utils/date';
import { formatINR } from '@/utils/format';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export interface CollectionChartProps {
  data: { date: string; total: number }[];
  height?: number;
  barColor?: string;
  highlightToday?: boolean;
  onBarPress?: (date: string) => void;
}

const PADDING_TOP = 16;
const PADDING_BOTTOM = 28;
const PADDING_HORIZONTAL = 8;
const LABEL_HEIGHT = 18;
const BAR_RADIUS = 6;
const MIN_BAR_HEIGHT = 2;

interface AnimatedBarProps {
  x: number;
  width: number;
  fullHeight: number;
  baseY: number;
  color: string;
  delay: number;
  onPress?: () => void;
}

function AnimatedBar({
  x,
  width,
  fullHeight,
  baseY,
  color,
  delay,
  onPress,
}: AnimatedBarProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress, delay, fullHeight]);

  const animatedProps = useAnimatedProps(() => {
    const h = Math.max(fullHeight * progress.value, 0);
    return {
      height: h,
      y: baseY - h,
    };
  });

  const rect = (
    <AnimatedRect
      x={x}
      width={width}
      rx={BAR_RADIUS}
      ry={BAR_RADIUS}
      fill={color}
      animatedProps={animatedProps}
    />
  );

  if (!onPress) return rect;
  return rect;
}

export function CollectionChart({
  data,
  height = 160,
  barColor = Colors.primary,
  highlightToday = false,
  onBarPress,
}: CollectionChartProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== width) setWidth(w);
  };

  const todayStr = todayISO();

  const maxValue = useMemo(() => {
    const m = data.reduce((acc, d) => (d.total > acc ? d.total : acc), 0);
    return m > 0 ? m : 1;
  }, [data]);

  const chartTop = PADDING_TOP;
  const chartBottom = height - PADDING_BOTTOM;
  const chartHeight = Math.max(chartBottom - chartTop, 1);

  const innerWidth = Math.max(width - PADDING_HORIZONTAL * 2, 0);
  const slotWidth = data.length > 0 ? innerWidth / data.length : 0;
  const barWidth = Math.min(Math.max(slotWidth * 0.55, 8), 18);

  const showEveryOther = data.length > 7 || slotWidth < 36;

  const gridYs = [chartTop, chartTop + chartHeight / 2, chartBottom];

  return (
    <View onLayout={onLayout} style={styles.container}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {gridYs.map((y, i) => (
            <Line
              key={`grid-${i}`}
              x1={PADDING_HORIZONTAL}
              x2={width - PADDING_HORIZONTAL}
              y1={y}
              y2={y}
              stroke={Colors.borderLight}
              strokeWidth={1}
            />
          ))}
          {data.map((d, i) => {
            const isToday = d.date === todayStr;
            const color =
              highlightToday && !isToday
                ? `${barColor}99`
                : barColor;
            const ratio = d.total / maxValue;
            const fullHeight =
              d.total > 0
                ? Math.max(chartHeight * ratio, MIN_BAR_HEIGHT)
                : MIN_BAR_HEIGHT;
            const slotX = PADDING_HORIZONTAL + i * slotWidth;
            const x = slotX + (slotWidth - barWidth) / 2;
            return (
              <AnimatedBar
                key={`bar-${d.date}`}
                x={x}
                width={barWidth}
                fullHeight={fullHeight}
                baseY={chartBottom}
                color={color}
                delay={i * 40}
              />
            );
          })}
        </Svg>
      ) : null}

      {width > 0 && onBarPress ? (
        <View style={[styles.overlay, { height }]} pointerEvents="box-none">
          {data.map((d, i) => {
            const slotX = PADDING_HORIZONTAL + i * slotWidth;
            return (
              <Pressable
                key={`hit-${d.date}`}
                onPress={() => onBarPress(d.date)}
                accessibilityRole="button"
                accessibilityLabel={`${d.date}: ${formatINR(d.total)}`}
                style={[
                  styles.hit,
                  {
                    left: slotX,
                    width: slotWidth,
                    top: chartTop,
                    height: chartHeight,
                  },
                ]}
              />
            );
          })}
        </View>
      ) : null}

      {width > 0 ? (
        <View
          style={[
            styles.labels,
            { height: LABEL_HEIGHT, paddingHorizontal: PADDING_HORIZONTAL },
          ]}
          pointerEvents="none"
        >
          {data.map((d, i) => {
            const slotX = i * slotWidth;
            const visible = !showEveryOther || i % 2 === 0;
            const isToday = d.date === todayStr;
            return (
              <View
                key={`label-${d.date}`}
                style={[
                  styles.labelSlot,
                  { left: slotX, width: slotWidth },
                ]}
              >
                {visible ? (
                  <Text
                    style={[
                      styles.labelText,
                      isToday && styles.labelToday,
                    ]}
                    numberOfLines={1}
                  >
                    {format(parseISO(d.date), 'EEE d')}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  hit: {
    position: 'absolute',
  },
  labels: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 4,
  },
  labelSlot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.textTertiary,
  },
  labelToday: {
    color: Colors.primary,
    fontFamily: Typography.bodyMedium,
  },
});
