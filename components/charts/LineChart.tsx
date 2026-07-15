import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
  Line,
  Text as SvgText,
} from 'react-native-svg';
import { Colors, Typography } from '@/constants/theme';

export interface LinePoint {
  label: string;
  value: number;
}

export interface LineChartProps {
  data: LinePoint[];
  height?: number;
}

const PAD_L = 44;
const PAD_R = 14;
const PAD_T = 16;
const PAD_B = 26;

const shortINR = (n: number): string => {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 === 0 ? 0 : 1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(n % 1e5 === 0 ? 0 : 1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1)}k`;
  return `₹${Math.round(n)}`;
};

// nice round max for the y-axis
const niceMax = (v: number): number => {
  if (v <= 0) return 100;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
};

export function LineChart({ data, height = 200 }: LineChartProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== width) setWidth(w);
  };

  const max = useMemo(() => niceMax(Math.max(0, ...data.map((d) => d.value))), [data]);
  const plotW = Math.max(width - PAD_L - PAD_R, 1);
  const plotH = height - PAD_T - PAD_B;

  const pts = useMemo(() => {
    if (data.length === 0) return [];
    const n = data.length;
    return data.map((d, i) => {
      const x = PAD_L + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
      const y = PAD_T + plotH - (d.value / max) * plotH;
      return { x, y, ...d };
    });
  }, [data, plotW, plotH, max]);

  const linePath = useMemo(() => {
    if (pts.length === 0) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  }, [pts]);

  const areaPath = useMemo(() => {
    if (pts.length === 0) return '';
    const baseY = PAD_T + plotH;
    return `${linePath} L${pts[pts.length - 1].x},${baseY} L${pts[0].x},${baseY} Z`;
  }, [linePath, pts, plotH]);

  const yTicks = [0, 0.5, 1];
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <View onLayout={onLayout} style={styles.wrap}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={Colors.primary} stopOpacity={0.14} />
              <Stop offset="1" stopColor={Colors.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* grid + y labels */}
          {yTicks.map((t, i) => {
            const y = PAD_T + plotH * t;
            const val = max * (1 - t);
            return (
              <React.Fragment key={i}>
                <Line x1={PAD_L} x2={width - PAD_R} y1={y} y2={y} stroke={Colors.borderLight} strokeWidth={1} />
                <SvgText x={PAD_L - 6} y={y + 3} fontSize={9} fill={Colors.textTertiary} textAnchor="end" fontFamily={Typography.body}>
                  {shortINR(val)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* area + line */}
          {pts.length > 0 ? (
            <>
              <Path d={areaPath} fill="url(#areaFill)" />
              <Path d={linePath} stroke={Colors.primary} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, i) => {
                const isLast = i === pts.length - 1;
                return (
                  <Circle key={i} cx={p.x} cy={p.y} r={isLast ? 4 : 2.5} fill={Colors.surface} stroke={Colors.primary} strokeWidth={isLast ? 3 : 2} />
                );
              })}
            </>
          ) : null}

          {/* x labels */}
          {pts.map((p, i) =>
            i % labelEvery === 0 || i === pts.length - 1 ? (
              <SvgText key={`x${i}`} x={p.x} y={height - 8} fontSize={9} fill={Colors.textTertiary} textAnchor="middle" fontFamily={Typography.body}>
                {p.label}
              </SvgText>
            ) : null,
          )}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
});
