import {
  formatINR,
  formatINRDecimal,
  normalizePhone,
  initialsOf,
  truncate,
} from '@/utils/format';

describe('formatINR', () => {
  it('groups in Indian style (lakh/crore)', () => {
    expect(formatINR(1000)).toBe('₹1,000');
    expect(formatINR(100000)).toBe('₹1,00,000');
    expect(formatINR(10000000)).toBe('₹1,00,00,000');
    expect(formatINR(12345678)).toBe('₹1,23,45,678');
  });

  it('handles small numbers without separators', () => {
    expect(formatINR(0)).toBe('₹0');
    expect(formatINR(5)).toBe('₹5');
    expect(formatINR(999)).toBe('₹999');
  });

  it('rounds to whole rupees', () => {
    expect(formatINR(19.4)).toBe('₹19');
    expect(formatINR(19.5)).toBe('₹20');
  });

  it('handles negatives', () => {
    expect(formatINR(-1500)).toBe('-₹1,500');
  });

  it('omits symbol when asked', () => {
    expect(formatINR(1500, false)).toBe('1,500');
  });

  it('falls back to 0 for non-finite input', () => {
    expect(formatINR(NaN)).toBe('₹0');
    expect(formatINR(Infinity)).toBe('₹0');
  });
});

describe('formatINRDecimal', () => {
  it('keeps two decimal places', () => {
    expect(formatINRDecimal(1234.5)).toBe('₹1,234.50');
    expect(formatINRDecimal(100000.99)).toBe('₹1,00,000.99');
    expect(formatINRDecimal(0)).toBe('₹0.00');
  });

  it('handles negatives', () => {
    expect(formatINRDecimal(-12.34)).toBe('-₹12.34');
  });

  it('falls back to 0 for non-finite input', () => {
    expect(formatINRDecimal(NaN)).toBe('₹0.00');
  });
});

describe('normalizePhone', () => {
  it('prefixes +91 for bare 10-digit numbers', () => {
    expect(normalizePhone('9876543210')).toBe('+919876543210');
  });

  it('adds + for 12-digit 91-prefixed numbers', () => {
    expect(normalizePhone('919876543210')).toBe('+919876543210');
  });

  it('keeps existing + numbers', () => {
    expect(normalizePhone('+14155550123')).toBe('+14155550123');
  });

  it('strips formatting characters', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210');
    expect(normalizePhone('(987) 654-3210')).toBe('+919876543210');
  });

  it('returns digits as-is when no rule matches', () => {
    expect(normalizePhone('12345')).toBe('12345');
  });
});

describe('initialsOf', () => {
  it('takes first + last initial for multi-word names', () => {
    expect(initialsOf('Ravi Kumar')).toBe('RK');
    expect(initialsOf('Ravi Shankar Kumar')).toBe('RK');
  });

  it('takes first two letters of single names', () => {
    expect(initialsOf('Ravi')).toBe('RA');
  });

  it('collapses extra whitespace', () => {
    expect(initialsOf('  Ravi   Kumar  ')).toBe('RK');
  });

  it('returns ? for empty input', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf('   ')).toBe('?');
  });
});

describe('truncate', () => {
  it('shortens long strings with an ellipsis', () => {
    expect(truncate('Hello World', 5)).toBe('Hell…');
  });

  it('leaves short strings untouched', () => {
    expect(truncate('Hi', 5)).toBe('Hi');
    expect(truncate('Hello', 5)).toBe('Hello');
  });
});
