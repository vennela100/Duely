import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  isSameDay,
  parseISO,
  startOfMonth,
} from 'date-fns';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { toISODate } from '@/utils/date';

export interface CalendarProps {
  value: string; // ISO yyyy-mm-dd
  onSelect: (iso: string) => void;
  maxDate?: string; // disable dates after this (default today)
}

type ViewMode = 'days' | 'months' | 'years';
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function Calendar({ value, onSelect, maxDate }: CalendarProps) {
  const selected = value ? parseISO(value) : new Date();
  const max = maxDate ? parseISO(maxDate) : new Date();
  const [month, setMonth] = useState(() => startOfMonth(selected));
  const [view, setView] = useState<ViewMode>('days');

  const maxYear = max.getFullYear();
  const maxMonthIdx = max.getFullYear() * 12 + max.getMonth();
  const curMonthIdx = month.getFullYear() * 12 + month.getMonth();

  // ---- Days view ----
  const renderDays = () => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days = eachDayOfInterval({ start, end });
    const lead = start.getDay();
    return (
      <>
        <View style={styles.head}>
          <Pressable
            onPress={() => setMonth((m) => addMonths(m, -1))}
            hitSlop={10}
            style={styles.nav}
          >
            <Feather name="chevron-left" size={20} color={Colors.textPrimary} />
          </Pressable>
          <Pressable onPress={() => setView('months')} hitSlop={8}>
            <Text style={styles.title}>{format(month, 'MMMM yyyy')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setMonth((m) => addMonths(m, 1))}
            hitSlop={10}
            style={styles.nav}
            disabled={curMonthIdx >= maxMonthIdx}
          >
            <Feather name="chevron-right" size={20} color={curMonthIdx >= maxMonthIdx ? Colors.textTertiary : Colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.weekRow}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={styles.weekday}>{w}</Text>
          ))}
        </View>
        <View style={styles.grid}>
          {Array.from({ length: lead }).map((_, i) => (
            <View key={`e${i}`} style={styles.cell} />
          ))}
          {days.map((d) => {
            const iso = toISODate(d);
            const isSel = value ? isSameDay(d, selected) : false;
            const disabled = isAfter(d, max);
            return (
              <Pressable key={iso} disabled={disabled} onPress={() => onSelect(iso)} style={styles.cell}>
                <View style={[styles.day, isSel && styles.daySel]}>
                  <Text style={[styles.dayText, isSel && styles.dayTextSel, disabled && styles.dayDisabled]}>
                    {d.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  };

  // ---- Months view ----
  const renderMonths = () => (
    <>
      <View style={styles.head}>
        <View style={styles.nav} />
        <Pressable onPress={() => setView('years')} hitSlop={8}>
          <Text style={styles.title}>{month.getFullYear()}</Text>
        </Pressable>
        <View style={styles.nav} />
      </View>
      <View style={styles.gridBig}>
        {MONTHS.map((m, i) => {
          const idx = month.getFullYear() * 12 + i;
          const disabled = idx > maxMonthIdx;
          const isSel = i === month.getMonth();
          return (
            <Pressable
              key={m}
              disabled={disabled}
              onPress={() => {
                setMonth(new Date(month.getFullYear(), i, 1));
                setView('days');
              }}
              style={styles.bigCell}
            >
              <View style={[styles.bigChip, isSel && styles.bigChipSel]}>
                <Text style={[styles.bigText, isSel && styles.dayTextSel, disabled && styles.dayDisabled]}>{m}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
  );

  // ---- Years view ----
  const renderYears = () => {
    const base = month.getFullYear() - 6;
    const years = Array.from({ length: 12 }, (_, i) => base + i);
    return (
      <>
        <View style={styles.head}>
          <View style={styles.nav} />
          <Text style={styles.title}>Select year</Text>
          <View style={styles.nav} />
        </View>
        <View style={styles.gridBig}>
          {years.map((y) => {
            const disabled = y > maxYear;
            const isSel = y === month.getFullYear();
            return (
              <Pressable
                key={y}
                disabled={disabled}
                onPress={() => {
                  setMonth(new Date(y, month.getMonth(), 1));
                  setView('months');
                }}
                style={styles.bigCell}
              >
                <View style={[styles.bigChip, isSel && styles.bigChipSel]}>
                  <Text style={[styles.bigText, isSel && styles.dayTextSel, disabled && styles.dayDisabled]}>{y}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  };

  return (
    <View style={styles.wrap}>
      {view === 'days' ? renderDays() : view === 'months' ? renderMonths() : renderYears()}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  nav: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceElevated },
  title: { fontFamily: Typography.heading, fontSize: 16, color: Colors.textPrimary, letterSpacing: -0.3 },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textTertiary, marginBottom: Spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  daySel: { backgroundColor: Colors.primary },
  dayText: { fontFamily: Typography.bodyMedium, fontSize: 14, color: Colors.textPrimary },
  dayTextSel: { color: Colors.textInverse },
  dayDisabled: { color: Colors.border },
  gridBig: { flexDirection: 'row', flexWrap: 'wrap' },
  bigCell: { width: '33.333%', paddingVertical: Spacing.xs, alignItems: 'center' },
  bigChip: { width: '92%', paddingVertical: Spacing.md, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.surfaceElevated },
  bigChipSel: { backgroundColor: Colors.primary },
  bigText: { fontFamily: Typography.bodyMedium, fontSize: 15, color: Colors.textPrimary },
});
