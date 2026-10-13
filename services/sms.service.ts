import { formatINR } from '@/utils/format';
import type { Lang } from '@/utils/i18n';
import { isDirectSmsAvailable, sendDirectSms } from './directSms';

// SMS is sent via an HTTP gateway (no native module, no composer popup, works in
// Expo Go). Default provider: Fast2SMS (India). Add a free key to enable real
// sending; with no key the collection still records, just without an SMS.
//
// Get a key: https://www.fast2sms.com  → Dev API → copy "Authorization" key.
const FAST2SMS_KEY = '';
const FAST2SMS_URL = 'https://www.fast2sms.com/dev/bulkV2';

interface SMSParams {
  customerName: string;
  phone: string;
  amountCollected: number;
  totalCollected: number;
  dealAmount: number;
  dayNumber: number;
  totalDays: number;
  date: string;
  lang?: Lang;
  simSubscriptionId?: number | null;
}

// Receipt labels for the supported languages. Hindi and Telugu receipts also
// include English; the English option sends one concise English receipt.
const SMS_LABELS: Record<Lang, {
  greeting: string;
  received: string;
  date: string;
  totalPaid: string;
  of: string;
  day: string;
  remaining: string;
}> = {
  en: { greeting: 'Dear', received: 'Payment received', date: 'Date', totalPaid: 'Total Paid', of: 'of', day: 'Day', remaining: 'Remaining' },
  hi: { greeting: 'प्रिय', received: 'भुगतान प्राप्त', date: 'दिनांक', totalPaid: 'कुल भुगतान', of: '/', day: 'दिन', remaining: 'शेष' },
  te: { greeting: 'ప్రియ', received: 'చెల్లింపు అందింది', date: 'తేదీ', totalPaid: 'మొత్తం చెల్లించారు', of: '/', day: 'రోజు', remaining: 'మిగిలింది' },
};

export const buildCollectionMessage = (p: SMSParams, lang: Lang = p.lang ?? 'en'): string => {
  const remaining = Math.max(p.dealAmount - p.totalCollected, 0);
  const labels = SMS_LABELS[lang];
  const locale = lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-IN';
  const date = new Date(`${p.date}T00:00:00`).toLocaleDateString(locale, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const localized = [
    `${labels.greeting} ${p.customerName},`,
    `${labels.received}: ${formatINR(p.amountCollected)}`,
    `${labels.date}: ${date}`,
    `${labels.totalPaid}: ${formatINR(p.totalCollected)} ${labels.of} ${formatINR(p.dealAmount)}`,
    `${labels.day}: ${p.dayNumber}/${p.totalDays}`,
    `${labels.remaining}: ${formatINR(remaining)}`,
  ].join('\n');
  if (lang === 'en') return `${localized}\n\n- Duely`;
  const en = SMS_LABELS.en;
  const english = [
    `${en.greeting} ${p.customerName},`,
    `${en.received}: ${formatINR(p.amountCollected)}`,
    `${en.date}: ${date}`,
    `${en.totalPaid}: ${formatINR(p.totalCollected)} ${en.of} ${formatINR(p.dealAmount)}`,
    `${en.day}: ${p.dayNumber}/${p.totalDays}`,
    `${en.remaining}: ${formatINR(remaining)}`,
  ].join('\n');
  return `${localized}\n\n${english}\n\n- Duely`;
};

// Fast2SMS wants a bare 10-digit Indian number.
const toLocalNumber = (phone: string): string => {
  const digits = phone.replace(/[^\d]/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

export const sendCollectionSMS = async (
  p: SMSParams,
): Promise<{ ok: boolean; reason?: string }> => {
  const message = buildCollectionMessage(p, p.lang);

  // 1) Device SIM (Android dev build) — sends directly, no composer.
  if (isDirectSmsAvailable()) {
    return sendDirectSms(p.phone, message, p.simSubscriptionId ?? null);
  }

  // 2) Fall back to HTTP gateway if a key is configured.
  if (!FAST2SMS_KEY) {
    return { ok: false, reason: 'No SMS method available (device SMS needs a dev build; or set a gateway key)' };
  }
  const number = toLocalNumber(p.phone);
  try {
    const res = await fetch(FAST2SMS_URL, {
      method: 'POST',
      headers: {
        authorization: FAST2SMS_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'q',
        message,
        // The bilingual receipt includes Telugu, so it must use Unicode.
        language: 'unicode',
        flash: 0,
        numbers: number,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { return?: boolean; message?: unknown };
    if (res.ok && data.return) return { ok: true };
    const reason = Array.isArray(data.message)
      ? String(data.message[0])
      : String(data.message ?? `HTTP ${res.status}`);
    return { ok: false, reason };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
};

// SMS is possible if the device can send directly (Android dev build) or a
// gateway key is configured. Drives the modal's "Send SMS" toggle.
export const isSMSAvailable = async (): Promise<boolean> =>
  isDirectSmsAvailable() || FAST2SMS_KEY.length > 0;

export const isSMSConfigured = (): boolean =>
  isDirectSmsAvailable() || FAST2SMS_KEY.length > 0;
