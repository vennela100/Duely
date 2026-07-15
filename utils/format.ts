// Manual Indian grouping — toLocaleString('en-IN') is unreliable on Hermes and
// inserts stray spaces (the "₹19 , 512" bug). This is deterministic everywhere.
const groupIndian = (digits: string): string => {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
};

export const formatINR = (amount: number, withSymbol = true): string => {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  const sign = safe < 0 ? '-' : '';
  const grouped = groupIndian(Math.abs(safe).toString());
  return `${sign}${withSymbol ? '₹' : ''}${grouped}`;
};

export const formatINRDecimal = (amount: number): string => {
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  const intPart = Math.floor(abs).toString();
  const dec = Math.round((abs - Math.floor(abs)) * 100)
    .toString()
    .padStart(2, '0');
  return `${sign}₹${groupIndian(intPart)}.${dec}`;
};

export const normalizePhone = (raw: string): string => {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return digits;
};

export const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const truncate = (s: string, n: number): string =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;
