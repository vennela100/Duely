import {
  today,
  toISODate,
  addDaysISO,
  daysBetween,
  formatDisplay,
  formatLong,
  isISOToday,
  last7Days,
} from '@/utils/date';

describe('toISODate', () => {
  it('formats a Date to yyyy-MM-dd', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('normalises an ISO string', () => {
    expect(toISODate('2026-01-05')).toBe('2026-01-05');
  });
});

describe('addDaysISO', () => {
  it('adds days', () => {
    expect(addDaysISO('2026-01-01', 10)).toBe('2026-01-11');
  });

  it('crosses month boundaries', () => {
    expect(addDaysISO('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('subtracts with negatives', () => {
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('daysBetween', () => {
  it('counts calendar days from a to b', () => {
    expect(daysBetween('2026-01-01', '2026-01-11')).toBe(10);
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
    expect(daysBetween('2026-01-11', '2026-01-01')).toBe(-10);
  });
});

describe('formatDisplay / formatLong', () => {
  it('formats a short display date', () => {
    expect(formatDisplay('2026-01-05')).toBe('05 Jan 2026');
  });

  it('formats a long date with weekday', () => {
    expect(formatLong('2026-01-05')).toBe('Monday, 05 Jan 2026');
  });
});

describe('today / isISOToday', () => {
  it('today() returns an ISO date matching now', () => {
    expect(today()).toBe(toISODate(new Date()));
  });

  it('isISOToday is true for today and false otherwise', () => {
    expect(isISOToday(today())).toBe(true);
    expect(isISOToday('2000-01-01')).toBe(false);
  });
});

describe('last7Days', () => {
  it('returns 7 ascending dates ending today', () => {
    const days = last7Days();
    expect(days).toHaveLength(7);
    expect(days[6]).toBe(today());
    const sorted = [...days].sort();
    expect(days).toEqual(sorted);
  });
});
