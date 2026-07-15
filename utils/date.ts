import {
  addDays,
  differenceInCalendarDays,
  format,
  isToday,
  parseISO,
  startOfDay,
} from 'date-fns';

export const today = (): string => format(startOfDay(new Date()), 'yyyy-MM-dd');

export const toISODate = (d: Date | string): string =>
  format(typeof d === 'string' ? parseISO(d) : d, 'yyyy-MM-dd');

export const addDaysISO = (iso: string, days: number): string =>
  toISODate(addDays(parseISO(iso), days));

export const daysBetween = (a: string, b: string): number =>
  differenceInCalendarDays(parseISO(b), parseISO(a));

export const formatDisplay = (iso: string): string =>
  format(parseISO(iso), 'dd MMM yyyy');

export const formatLong = (iso: string): string =>
  format(parseISO(iso), 'EEEE, dd MMM yyyy');

export const isISOToday = (iso: string): boolean => isToday(parseISO(iso));

export const last7Days = (): string[] => {
  const out: string[] = [];
  const base = startOfDay(new Date());
  for (let i = 6; i >= 0; i--) out.push(toISODate(addDays(base, -i)));
  return out;
};
