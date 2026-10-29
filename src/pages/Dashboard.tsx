import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Info,
  Percent,
  PiggyBank,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import "./Dashboard.css";

/* ==========================================================
   Types
   Money is stored as INTEGER PAISE (₹1 = 100 paise) so sums
   never suffer floating-point drift.
   ========================================================== */
type Period = "week" | "month" | "year";
type TxnType = "income" | "expense";

interface Txn {
  id: string;
  date: string; // YYYY-MM-DD (local)
  description: string;
  category: string;
  account: string;
  amountPaise: number;
  type: TxnType;
}

interface Bucket {
  key: string;
  label: string;
  income: number;
  expense: number;
}

interface Goal {
  id: string;
  name: string;
  targetPaise: number;
  savedPaise: number;
  targetDate: string;
}

/* ==========================================================
   Formatting (Indian number system). These move to
   src/lib/currency.ts when that file is created.
   ========================================================== */
function formatINR(paise: number): string {
  const whole = paise % 100 === 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

function compactINR(paise: number): string {
  const r = Math.round(paise / 100);
  if (r >= 100000) return `₹${(r / 100000).toFixed(r % 100000 === 0 ? 0 : 1)}L`;
  if (r >= 1000) return `₹${(r / 1000).toFixed(r % 1000 === 0 ? 0 : 1)}K`;
  return `₹${r}`;
}

/* ==========================================================
   Date helpers (local dates, ISO strings sort lexicographically)
   ========================================================== */
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function shortDate(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/* ==========================================================
   SYNTHETIC DEMO DATA — deterministic, clearly labelled in the UI.
   Replaced by persisted user data in Phase 2.
   ========================================================== */
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

function generateDemo(today: Date): Txn[] {
  const rng = mulberry32(20261029);
  const between = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  const pick = (list: string[]) => list[Math.floor(rng() * list.length)];
  const out: Txn[] = [];
  let n = 0;

  const add = (
    d: Date,
    description: string,
    category: string,
    account: string,
    rupees: number,
    type: TxnType,
  ) => {
    out.push({
      id: `demo-${n++}`,
      date: toISO(d),
      description,
      category,
      account,
      amountPaise: rupees * 100,
      type,
    });
  };

  for (let i = DEMO_DAYS - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const dom = d.getDate();
    if (dom === 1) add(d, "Monthly salary", "Salary", "Demo Savings", 65000, "income");
    if (dom === 3) add(d, "House rent", "Housing", "Demo Savings", 18000, "expense");
    if (dom === 5) add(d, "Broadband bill", "Utilities", "Demo Savings", 799, "expense");
    if (dom === 7) add(d, "Streaming subscription", "Subscriptions", "Demo Card", 199, "expense");
    if (dom === 15 && rng() < 0.4) {
      add(d, "Freelance payment", "Freelance", "Demo Savings", between(5000, 15000), "income");
    }
    if (rng() < 0.55) add(d, pick(FOOD), "Food & Dining", "Demo Card", between(80, 600), "expense");
    if (rng() < 0.25) add(d, pick(TRANSPORT), "Transport", "Demo Card", between(40, 400), "expense");
    if (rng() < 0.08) add(d, pick(SHOPPING), "Shopping", "Demo Card", between(300, 3000), "expense");
    if (rng() < 0.06) add(d, pick(FUN), "Entertainment", "Demo Card", between(150, 1200), "expense");
  }
  return out;
}

const DEMO_GOALS: Goal[] = [
  { id: "g1", name: "Emergency fund", targetPaise: 15000000, savedPaise: 6200000, targetDate: "2027-06-30" },
  { id: "g2", name: "New laptop", targetPaise: 8000000, savedPaise: 5600000, targetDate: "2027-01-31" },
  { id: "g3", name: "Trip fund", targetPaise: 4000000, savedPaise: 900000, targetDate: "2027-09-15" },
];

/* ==========================================================
   Period maths
   ========================================================== */
const PERIOD_LABEL: Record<Period, string> = {
  week: "Last 7 days",
  month: "Last 30 days",
  year: "Last 12 months",
};

interface Range {
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
}

function getRange(period: Period, today: Date): Range {
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

function sumBetween(txns: Txn[], start: string, end: string) {
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const t of txns) {
    if (t.date < start || t.date > end) continue;
    count++;
    if (t.type === "income") income += t.amountPaise;
    else expense += t.amountPaise;
  }
  return { income, expense, count };
}

function buildBuckets(period: Period, txns: Txn[], range: Range, today: Date): Bucket[] {
  const map = new Map<string, Bucket>();
  const keyOf = (iso: string) => (period === "year" ? iso.slice(0, 7) : iso);

  if (period === "year") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = toISO(d).slice(0, 7);
      const label = d.toLocaleDateString("en-IN", { month: "short" });
      map.set(key, { key, label, income: 0, expense: 0 });
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

  for (const t of txns) {
    if (t.date < range.start || t.date > range.end) continue;
    const b = map.get(keyOf(t.date));
    if (!b) continue;
    if (t.type === "income") b.income += t.amountPaise;
    else b.expense += t.amountPaise;
  }
  return Array.from(map.values());
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/* ==========================================================
   Small hooks / components
   ========================================================== */
function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function Delta({ current, previous, higherIsGood }: { current: number; previous: number; higherIsGood: boolean }) {
  const change = pctChange(current, previous);
  if (change === null) return <p className="delta">No earlier data to compare</p>;
  const rounded = Math.round(change * 10) / 10;
  const good = higherIsGood ? rounded >= 0 : rounded <= 0;
  const Icon = rounded >= 0 ? TrendingUp : TrendingDown;
  return (
    <p className={`delta ${good ? "delta--good" : "delta--bad"}`}>
      <Icon size={12} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
      {rounded >= 0 ? "+" : ""}
      {rounded}% vs previous period
    </p>
  );
}

interface TipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ dataKey?: string | number; value?: number }>;
}

function ChartTooltip({ active, label, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const income = payload.find((p) => p.dataKey === "income")?.value ?? 0;
  const expense = payload.find((p) => p.dataKey === "expense")?.value ?? 0;
  return (
    <div className="tooltip">
      <p className="tooltip__label">{label}</p>
      <p>Income: {formatINR(income)}</p>
      <p>Expenses: {formatINR(expense)}</p>
    </div>
  );
}

/* ==========================================================
   Page
   ========================================================== */
export default function Dashboard() {
  const [today] = useState(() => new Date());
  const [period, setPeriod] = useState<Period>("month");
  const [query, setQuery] = useState("");
  const reducedMotion = useReducedMotion();

  const txns = useMemo(() => generateDemo(today), [today]);

  const view = useMemo(() => {
    const range = getRange(period, today);
    const current = sumBetween(txns, range.start, range.end);
    const previous = sumBetween(txns, range.prevStart, range.prevEnd);
    const buckets = buildBuckets(period, txns, range, today);

    const byCategory = new Map<string, number>();
    const inRange: Txn[] = [];
    for (const t of txns) {
      if (t.date < range.start || t.date > range.end) continue;
      inRange.push(t);
      if (t.type === "expense") {
        byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amountPaise);
      }
    }
    const categories = Array.from(byCategory.entries())
      .map(([name, paise]) => ({ name, paise }))
      .sort((a, b) => b.paise - a.paise);

    inRange.sort((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1));
    return { range, current, previous, buckets, categories, inRange };
  }, [txns, period, today]);

  const { current, previous } = view;
  const net = current.income - current.expense;
  const prevNet = previous.income - previous.expense;
  const savingsRatePct = current.income > 0 ? Math.round((net * 1000) / current.income) / 10 : null;

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? view.inRange.filter(
        (t) =>
          t.description.toLowerCase().includes(needle) ||
          t.category.toLowerCase().includes(needle) ||
          t.account.toLowerCase().includes(needle),
      )
    : view.inRange;
  const shown = matches.slice(0, 8);

  const topExpense = view.categories[0]?.paise ?? 0;
  const chartSummary =
    `${PERIOD_LABEL[period]}: income ${formatINR(current.income)}, ` + `expenses ${formatINR(current.expense)}.`;

  return (
    <main className="dash" aria-labelledby="dash-title">
      <header className="dash__header">
        <div>
          <p className="dash__eyebrow">Overview</p>
          <h1 className="dash__title" id="dash-title">
            Your financial picture
          </h1>
          <p className="dash__meta">
            <span className="badge badge--demo">Demo data</span>{" "}
            Last updated{" "}
            {today.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>

        <div className="seg" role="group" aria-label="Reporting period">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              className="seg__btn"
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
            >
              {p === "week" ? "Week" : p === "month" ? "Month" : "Year"}
            </button>
          ))}
        </div>
      </header>

      <div className="notice" role="note">
        <Info size={18} aria-hidden="true" />
        <p style={{ margin: 0 }}>
          Everything on this screen is synthetic sample data for design review. Real figures appear only
          from records you enter or import, and recorded balances are never presented as bank-verified.
        </p>
      </div>

      <section className="stats" aria-label={`Summary, ${PERIOD_LABEL[period]}`} key={period}>
        <article className="card stat">
          <p className="stat__label">
            <ArrowDownLeft size={16} aria-hidden="true" /> Recorded income
          </p>
          <p className="stat__value stat__value--income">{formatINR(current.income)}</p>
          <Delta current={current.income} previous={previous.income} higherIsGood />
        </article>

        <article className="card stat">
          <p className="stat__label">
            <ArrowUpRight size={16} aria-hidden="true" /> Recorded expenses
          </p>
          <p className="stat__value stat__value--expense">{formatINR(current.expense)}</p>
          <Delta current={current.expense} previous={previous.expense} higherIsGood={false} />
        </article>

        <article className="card stat">
          <p className="stat__label">
            <PiggyBank size={16} aria-hidden="true" /> Savings
          </p>
          <p className={`stat__value ${net >= 0 ? "stat__value--income" : "stat__value--expense"}`}>
            {net < 0 ? "−" : ""}
            {formatINR(Math.abs(net))}
          </p>
          <Delta current={net} previous={prevNet} higherIsGood />
        </article>

        <article className="card stat">
          <p className="stat__label">
            <Percent size={16} aria-hidden="true" /> Savings rate
          </p>
          <p className="stat__value">{savingsRatePct === null ? "—" : `${savingsRatePct}%`}</p>
          <p className="delta">
            {savingsRatePct === null ? "Needs recorded income" : "Of recorded income this period"}
          </p>
        </article>

        <article className="card stat stat--muted">
          <p className="stat__label">Available balance &amp; net worth</p>
          <p className="stat__value">Not available yet</p>
          <p className="delta">Shown once accounts and liabilities are added.</p>
        </article>
      </section>

      <div className="dash__grid">
        <section className="card" aria-labelledby="cashflow-title">
          <h2 className="card__title" id="cashflow-title">
            Cash flow · {PERIOD_LABEL[period]}
          </h2>
          <ul className="legend" aria-hidden="true">
            <li>
              <span className="legend__dot" style={{ background: "var(--color-income)" }} />
              Income
            </li>
            <li>
              <span className="legend__dot" style={{ background: "var(--color-expense)" }} />
              Expenses
            </li>
          </ul>
          <div className="chart" role="img" aria-label={chartSummary}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={view.buckets} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="var(--color-date)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={period === "month" ? 4 : 0}
                  tick={{ fontSize: 11, fill: "#596079" }}
                />
                <YAxis
                  width={52}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={compactINR}
                  tick={{ fontSize: 11, fill: "#596079" }}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(62,195,213,0.12)" }} />
                <Bar
                  dataKey="income"
                  fill="var(--color-income)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={!reducedMotion}
                  animationDuration={500}
                />
                <Bar
                  dataKey="expense"
                  fill="var(--color-expense)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={!reducedMotion}
                  animationDuration={500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card" aria-labelledby="cats-title">
          <h2 className="card__title" id="cats-title">
            Where it went
          </h2>
          {view.categories.length === 0 ? (
            <p className="empty">No expenses recorded in this period.</p>
          ) : (
            <ul className="cats" key={period}>
              {view.categories.map((c) => (
                <li key={c.name}>
                  <div className="cat__top">
                    <span className="cat__name">{c.name}</span>
                    <span className="cat__amount">{formatINR(c.paise)}</span>
                  </div>
                  <div
                    className="track"
                    role="progressbar"
                    aria-label={`${c.name} share of spending`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round((c.paise * 100) / current.expense)}
                  >
                    <div
                      className="track__fill"
                      style={{ width: `${Math.max(3, Math.floor((c.paise * 100) / topExpense))}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="txn-title">
          <h2 className="card__title" id="txn-title">
            Recent transactions
          </h2>
          <div className="search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search description, category or account"
              aria-label="Search transactions in this period"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {shown.length === 0 ? (
            <p className="empty">
              {needle ? "No transactions match your search." : "No transactions recorded in this period."}
            </p>
          ) : (
            <ul className="txns">
              {shown.map((t) => (
                <li className="txn" key={t.id}>
                  <span className={`txn__icon txn__icon--${t.type}`} aria-hidden="true">
                    {t.type === "income" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />