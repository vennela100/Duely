import {
  calcDailyAmount,
  calcEndDate,
  calcProfit,
  calcProfitPct,
  remainingAmount,
  progressPct,
  deriveStatus,
} from '@/utils/calc';

describe('calcDailyAmount', () => {
  it('divides deal across days and rounds to 2dp', () => {
    expect(calcDailyAmount(10000, 100)).toBe(100);
    expect(calcDailyAmount(1000, 3)).toBe(333.33);
  });

  it('returns 0 for non-positive days', () => {
    expect(calcDailyAmount(10000, 0)).toBe(0);
    expect(calcDailyAmount(10000, -5)).toBe(0);
  });
});

describe('calcEndDate', () => {
  it('is inclusive of the start day', () => {
    expect(calcEndDate('2026-01-01', 1)).toBe('2026-01-01');
    expect(calcEndDate('2026-01-01', 10)).toBe('2026-01-10');
  });

  it('does not go before the start for zero days', () => {
    expect(calcEndDate('2026-01-01', 0)).toBe('2026-01-01');
  });
});

describe('calcProfit / calcProfitPct', () => {
  it('computes absolute profit', () => {
    expect(calcProfit(12000, 10000)).toBe(2000);
    expect(calcProfit(10000, 10000)).toBe(0);
  });

  it('computes profit percentage on principal', () => {
    expect(calcProfitPct(12000, 10000)).toBe(20);
  });

  it('returns 0 pct when nothing was given', () => {
    expect(calcProfitPct(12000, 0)).toBe(0);
  });
});

describe('remainingAmount', () => {
  it('returns the outstanding balance', () => {
    expect(remainingAmount({ dealAmount: 10000, totalCollected: 3000 })).toBe(7000);
  });

  it('never goes negative', () => {
    expect(remainingAmount({ dealAmount: 10000, totalCollected: 12000 })).toBe(0);
  });
});

describe('progressPct', () => {
  it('returns percentage collected', () => {
    expect(progressPct({ dealAmount: 10000, totalCollected: 2500 })).toBe(25);
  });

  it('caps at 100', () => {
    expect(progressPct({ dealAmount: 10000, totalCollected: 15000 })).toBe(100);
  });

  it('returns 0 for a zero deal', () => {
    expect(progressPct({ dealAmount: 0, totalCollected: 5000 })).toBe(0);
  });
});

describe('deriveStatus', () => {
  it('keeps paused / defaulted regardless of balance', () => {
    expect(
      deriveStatus({ dealAmount: 100, totalCollected: 100, status: 'paused' }),
    ).toBe('paused');
    expect(
      deriveStatus({ dealAmount: 100, totalCollected: 0, status: 'defaulted' }),
    ).toBe('defaulted');
  });

  it('is completed once fully collected', () => {
    expect(
      deriveStatus({ dealAmount: 100, totalCollected: 100, status: 'active' }),
    ).toBe('completed');
    expect(
      deriveStatus({ dealAmount: 100, totalCollected: 120, status: 'active' }),
    ).toBe('completed');
  });

  it('is active while a balance remains', () => {
    expect(
      deriveStatus({ dealAmount: 100, totalCollected: 50, status: 'active' }),
    ).toBe('active');
  });
});
