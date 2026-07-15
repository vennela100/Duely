import type { Customer, CollectionEntry, PaymentMethod, CustomerStatus } from '@/types';
import { calcDailyAmount, calcEndDate } from '@/utils/calc';
import { addDaysISO, today as todayISO } from '@/utils/date';
import { genId, replaceAll } from './localdb';

// DEV-ONLY demo data generator. Builds a realistic multi-month book of lending
// customers with daily collection entries (missed days, partials, top-ups, mixed
// statuses). Used to stress-test the 3 backup layers. Gated behind __DEV__ in UI.

const FIRST = ['Ramesh', 'Lakshmi', 'Suresh', 'Anjali', 'Imran', 'Priya', 'Venkatesh', 'Sunita', 'Karthik', 'Deepa', 'Arjun', 'Fatima', 'Rahul', 'Meena', 'Vijay', 'Kavya', 'Naveen', 'Pooja', 'Ganesh', 'Divya', 'Manoj', 'Sneha', 'Ravi', 'Asha', 'Kiran', 'Geetha', 'Sai', 'Nirmala', 'Prakash', 'Bhavani'];
const LAST = ['Kumar', 'Devi', 'Reddy', 'Sharma', 'Khan', 'Nair', 'Rao', 'Yadav', 'Iyer', 'Menon', 'Patel', 'Begum', 'Singh', 'Naidu', 'Gupta', 'Das'];
const METHODS: PaymentMethod[] = ['cash', 'cash', 'cash', 'upi', 'upi', 'other'];

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]): T => a[rand(a.length)];
const chance = (p: number) => Math.random() < p;

interface Plan { fill: CustomerStatus | 'completed'; deal: number; given: number; days: number; startedDaysAgo: number; topUp?: number }

const makePlan = (i: number): Plan => {
  const deal = 8000 + rand(55) * 1000;          // 8k–62k
  const given = Math.round(deal * (0.78 + Math.random() * 0.12)); // ~78–90%
  const days = 45 + rand(80);                    // 45–124 days
  const startedDaysAgo = 10 + rand(180);         // up to ~6 months
  const r = i % 10;
  const fill: Plan['fill'] =
    r === 0 ? 'defaulted' :
    r === 1 ? 'paused' :
    startedDaysAgo > days ? 'completed' : 'active';
  return { fill, deal, given, days, startedDaysAgo, topUp: chance(0.2) ? 1000 + rand(8) * 1000 : undefined };
};

export const seedDemoData = async (count = 55): Promise<{ customers: number; entries: number }> => {
  const todayStr = todayISO();
  const customers: Customer[] = [];
  const collections: CollectionEntry[] = [];

  for (let i = 0; i < count; i++) {
    const id = genId();
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const phone = `9${(100000000 + rand(899999999)).toString().slice(0, 9)}`;
    const p = makePlan(i);
    const startDate = addDaysISO(todayStr, -p.startedDaysAgo);
    let deal = p.deal;
    let given = p.given;
    const daily = calcDailyAmount(deal, p.days);

    let total = 0;
    let daysCollected = 0;
    let lastDate: string | undefined;
    const elapsed = Math.min(p.startedDaysAgo, p.days - 1);
    const stopAtDay =
      p.fill === 'defaulted' ? Math.floor(p.days * 0.4) :
      p.fill === 'paused' ? Math.floor(p.days * 0.55) :
      elapsed;

    for (let d = 0; d <= elapsed; d++) {
      const date = addDaysISO(startDate, d);
      if (date > todayStr) break;

      if (p.topUp && d === Math.floor(p.days * 0.3)) {
        deal += p.topUp;
        given += p.topUp;
        collections.push({
          id: genId(), customerId: id, customerName: name, amount: p.topUp, date,
          collectedAt: `${date}T08:30:00.000Z`, method: 'cash', smsSent: false,
          dayNumber: daysCollected, kind: 'given',
        });
      }

      if (d > stopAtDay) break;
      if (chance(0.12) && p.fill !== 'completed') continue;

      let amount = daily;
      if (chance(0.1)) amount = Math.round(daily * 0.5);
      else if (chance(0.08)) amount = Math.round(daily * 2);
      if (total + amount > deal) amount = deal - total;
      if (amount <= 0) break;

      total += amount;
      daysCollected += 1;
      lastDate = date;
      collections.push({
        id: genId(), customerId: id, customerName: name, amount, date,
        collectedAt: `${date}T${String(10 + (d % 8)).padStart(2, '0')}:15:00.000Z`,
        method: pick(METHODS), smsSent: chance(0.6), dayNumber: daysCollected, kind: 'received',
      });
      if (total >= deal) break;
    }

    if (p.fill === 'completed' && total < deal) {
      const amount = deal - total;
      const date = lastDate ?? addDaysISO(startDate, elapsed);
      total = deal; daysCollected += 1; lastDate = date;
      collections.push({
        id: genId(), customerId: id, customerName: name, amount, date,
        collectedAt: `${date}T18:00:00.000Z`, method: pick(METHODS), smsSent: true,
        dayNumber: daysCollected, kind: 'received',
      });
    }

    const status: CustomerStatus =
      p.fill === 'defaulted' ? 'defaulted' :
      p.fill === 'paused' ? 'paused' :
      total >= deal ? 'completed' : 'active';

    customers.push({
      id, name, phone: `+91${phone}`, phoneRaw: phone,
      dealAmount: deal, givenAmount: given, dailyAmount: daily, collectionDays: p.days,
      startDate, endDate: calcEndDate(startDate, p.days), status,
      totalCollected: total, daysCollected, lastCollectionDate: lastDate,
      createdAt: `${startDate}T07:00:00.000Z`, updatedAt: new Date().toISOString(),
    });
  }

  collections.sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
  await replaceAll(customers, collections);
  return { customers: customers.length, entries: collections.length };
};

export const clearAllData = (): Promise<void> => replaceAll([], []);
