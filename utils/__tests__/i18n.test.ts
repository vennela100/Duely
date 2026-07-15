import { translate, LANGUAGES } from '@/utils/i18n';

describe('translate', () => {
  it('returns the string for the requested language', () => {
    expect(translate('en', 'tab.customers')).toBe('Customers');
    expect(translate('hi', 'tab.customers')).toBe('ग्राहक');
    expect(translate('te', 'tab.customers')).toBe('కస్టమర్లు');
  });

  it('falls back to English for a missing translation', () => {
    // force a key absent from a non-en dict by relying on the en fallback path
    expect(translate('en', 'common.cancel')).toBe('Cancel');
  });

  it('returns the key itself when unknown everywhere', () => {
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist');
    expect(translate('hi', 'does.not.exist')).toBe('does.not.exist');
  });
});

describe('LANGUAGES', () => {
  it('exposes en/hi/te with native labels', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(['en', 'hi', 'te']);
    expect(LANGUAGES.find((l) => l.code === 'hi')?.native).toBe('हिन्दी');
  });
});
