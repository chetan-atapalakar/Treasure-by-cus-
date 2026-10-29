import { addDays, parseISO, toISO } from "./dates";

export type Period = "week" | "month" | "year";

export const PERIOD_LABEL: Record<Period, string> = {
  week: "Last 7 days",
  month: "Last 30 days",
  year: "Last 12 months",
};

export interface Range {
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
}

export interface Totals {
  income: number;
  expense: number;
  count: number;
}

export interface DayRow {
  day: string;
  income: number;
  expense: number;
}

export interface Bucket {
  key: string;
  label: string;
  income: number;
  expense: number;
}

export interface CategoryTotal {
  name: string;
  paise: number;
}

export interface RecentTxn {
  id: string;
  date: string;
  description: string;
  category: string;
  account: string;
  amountPaise: number;
  type: "income" | "expense";
}

export interface Summary {
  current: Totals;
  previous: Totals;
  buckets: Bucket[];
  categories: CategoryTotal[];
  recent: RecentTxn[];
}

export function getRange(period: Period, today: Date): Range {
  const end = toISO(today);
  if (period === "year") {
    const start = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    const prevEnd = addDays(start, -1);
    const prevStart = new Date(today.getFullYear(), today.getMonth() - 23, 1);
    return { start: toISO(start), end, prevStart: toISO(prevStart), prevEnd: toISO(prevEnd) };
  }
  const n = period === "week" ? 7 : 30;
  const start = addDays(today, -(n - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(n - 1));
  return { start: toISO(start), end, prevStart: toISO(prevStart), prevEnd: toISO(prevEnd) };
}

/** Turns aggregated rows into chart buckets, including empty days/months. */
export function buildBuckets(period: Period, rows: DayRow[], range: Range, today: Date): Bucket[] {
  const map = new Map<string, Bucket>();

  if (period === "year") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = toISO(d).slice(0, 7);
      map.set(key, { key, label: d.toLocaleDateString("en-IN", { month: "short" }), income: 0, expense: 0 });
    }
  } else {
    let d = parseISO(range.start);
    const last = parseISO(range.end);
    while (d <= last) {
      const key = toISO(d);
      const label =
        period === "week"
          ? d.toLocaleDateString("en-IN", { weekday: "short" })
          : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      map.set(key, { key, label, income: 0, expense: 0 });
      d = addDays(d, 1);
    }
  }

  for (const r of rows) {
    const b = map.get(period === "year" ? r.day.slice(0, 7) : r.day);
    if (!b) continue;
    b.income += r.income;
    b.expense += r.expense;
  }
  return Array.from(map.values());
}