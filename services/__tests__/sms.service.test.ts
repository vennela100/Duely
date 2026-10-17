jest.mock('../directSms', () => ({
  isDirectSmsAvailable: () => false,
  sendDirectSms: jest.fn(),
}));

import { buildCollectionMessage } from '../sms.service';

const params = {
  customerName: 'Ravi',
  phone: '9876543210',
  amountCollected: 500,
  totalCollected: 2500,
  dealAmount: 10000,
  dayNumber: 5,
  totalDays: 100,
  date: '2026-10-17',
};

describe('buildCollectionMessage', () => {
  it('sends Telugu and English when English is selected', () => {
    const msg = buildCollectionMessage({ ...params, lang: 'en' });
    expect(msg).toContain('ప్రియ Ravi,');
    expect(msg).toContain('Dear Ravi,');
  });

  it('sends Telugu and English when Telugu is selected', () => {
    const msg = buildCollectionMessage({ ...params, lang: 'te' });
    expect(msg).toContain('మిగిలింది: ₹7,500');
    expect(msg).toContain('Remaining: ₹7,500');
  });

  it('defaults to Telugu and English when no language is given', () => {
    const msg = buildCollectionMessage(params);
    expect(msg).toContain('ప్రియ Ravi,');
    expect(msg).toContain('Dear Ravi,');
  });
});
