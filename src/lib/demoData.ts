import { addDays, toISO } from "./dates";
import { buildBuckets, getRange, type DayRow, type Period, type Summary, type Totals } from "./summary";

/* SYNTHETIC DEMO DATA ONLY. Deterministic, never saved, never mixed with real records. */

interface DemoTxn {
  id: string;
  date: string;
  description: string;
  category: string;
  account: string;
  amountPaise: number;
  type: "income" | "expense";
}

export interface DemoGoal {
  id: string;
  name: string;
  targetPaise: number;
  savedPaise: number;
  targetDate: string;
}

export const DEMO_GOALS: DemoGoal[] = [
  { id: "g1", name: "Emergency fund", targetPaise: 15000000, savedPaise: 6200000, targetDate: "2027-06-30" },
  { id: "g2", name: "New laptop", targetPaise: 8000000, savedPaise: 5600000, targetDate: "2027-01-31" },
  { id: "g3", name: "Trip fund", targetPaise: 4000000, savedPaise: 900000, targetDate: "2027-09-15" },
];

const DEMO_DAYS = 800;

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FOOD = ["Lunch at café", "Groceries", "Dinner out", "Tea & snacks", "Food delivery"];
const TRANSPORT = ["Auto fare", "Metro recharge", "Fuel", "Cab ride"];
const SHOPPING = ["Online order", "Clothing", "Household items"];
const FUN = ["Movie tickets", "Game purchase", "Weekend outing"];

function generateDemo(today: Date): DemoTxn[] {
  const rng = mulberry32(20261029);
  const between = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  const pick = (list: string[]) => list[Math.floor(rng() * list.length)];
  const out: DemoTxn[] = [];
  let n = 0;

  const add = (d: Date, description: string, category: string, account: string, rupees: number, type: "income" | "expense") => {
    out.push({ id: `demo-${n++}`, date: toISO(d), description, category, account, amountPaise: rupees * 100, type });
  };

  for (let i = DEMO_DAYS - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const dom = d.getDate();
    if (dom === 1) add(d, "Monthly salary", "Salary", "Demo Savings", 65000, "income");
    if (dom === 3) add(d, "House rent", "Housing", "Demo Savings", 18000, "expense");
    if (dom === 5) add(d, "Broadband bill", "Utilities", "Demo Savings", 799, "expense");
    if (dom === 7) add(d, "Streaming subscription", "Subscriptions", "Demo Card", 199, "expense");
    if (dom === 15 && rng() < 0.4) add(d, "Freelance payment", "Freelance", "Demo Savings", between(5000, 15000), "income");
    if (rng() < 0.55) add(d, pick(FOOD), "Food & Dining", "Demo Card", between(80, 600), "expense");
    if (rng() < 0.25) add(d, pick(TRANSPORT), "Transport", "Demo Card", between(40, 400), "expense");
    if (rng() < 0.08) add(d, pick(SHOPPING), "Shopping", "Demo Card", between(300, 3000), "expense");
    if (rng() < 0.06) add(d, pick(FUN), "Entertainment", "Demo Card", between(150, 1200), "expense");
  }
  return out;
}

export function demoSummary(period: Period, today: Date): Summary {
  const txns = generateDemo(today);
  const range = getRange(period, today);
  const current: Totals = { income: 0, expense: 0, count: 0 };
  const previous: Totals = { income: 0, expense: 0, count: 0 };
  const byDay = new Map<string, DayRow>();
  const cats = new Map<string, number>();
  const inRange: DemoTxn[] = [];

  for (const t of txns) {
    if (t.date >= range.start && t.date <= range.end) {
      current.count++;
      inRange.push(t);
      const row = byDay.get(t.date) ?? { day: t.date, income: 0, expense: 0 };
      if (t.type === "income") {
        current.income += t.amountPaise;
        row.income += t.amountPaise;
      } else {
        current.expense += t.amountPaise;
        row.expense += t.amountPaise;
        cats.set(t.category, (cats.get(t.category) ?? 0) + t.amountPaise);
      }
      byDay.set(t.date, row);
    } else if (t.date >= range.prevStart && t.date <= range.prevEnd) {
      previous.count++;
      if (t.type === "income") previous.income += t.amountPaise;
      else previous.expense += t.amountPaise;
    }
  }

  inRange.sort((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1));

  return {
    current,
    previous,
    buckets: buildBuckets(period, Array.from(byDay.values()), range, today),
    categories: Array.from(cats.entries())
      .map(([name, paise]) => ({ name, paise }))
      .sort((a, b) => b.paise - a.paise),
    recent: inRange.slice(0, 8),
  };
}