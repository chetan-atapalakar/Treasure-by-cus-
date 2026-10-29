import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import QuoteLoader from "../components/ui/QuoteLoader";
import { compactINR, formatINR } from "../lib/currency";
import { shortDate } from "../lib/dates";
import { DEMO_GOALS, demoSummary } from "../lib/demoData";
import { errorMessage } from "../lib/net";
import {
  PERIOD_LABEL,
  type Period,
  type Summary,
} from "../lib/summary";
import { fetchSummary } from "../services/transactions";
import "./Dashboard.css";
import "./auth.css";
import "./data.css";

function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(query).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setReduced(mq.matches);

    mq.addEventListener("change", handler);

    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

function pctChange(
  current: number,
  previous: number
): number | null {
  if (previous === 0) return null;

  return ((current - previous) / previous) * 100;
}

function Delta({
  current,
  previous,
  higherIsGood,
}: {
  current: number;
  previous: number;
  higherIsGood: boolean;
}) {
  const change = pctChange(current, previous);

  if (change === null) {
    return <p className="delta">No earlier data to compare</p>;
  }

  const rounded = Math.round(change * 10) / 10;
  const good = higherIsGood ? rounded >= 0 : rounded <= 0;
  const Icon = rounded >= 0 ? TrendingUp : TrendingDown;

  return (
    <p className={`delta ${good ? "delta--good" : "delta--bad"}`}>
      <Icon
        size={12}
        aria-hidden="true"
        style={{
          verticalAlign: "-2px",
          marginRight: 4,
        }}
      />
      {rounded >= 0 ? "+" : ""}
      {rounded}% vs previous period
    </p>
  );
}

interface TipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    dataKey?: string | number;
    value?: number;
  }>;
}

function ChartTooltip({
  active,
  label,
  payload,
}: TipProps) {
  if (!active || !payload?.length) return null;

  const income =
    payload.find((p) => p.dataKey === "income")?.value ?? 0;

  const expense =
    payload.find((p) => p.dataKey === "expense")?.value ?? 0;

  return (
    <div className="tooltip">
      <p className="tooltip__label">{label}</p>
      <p>Income: {formatINR(income)}</p>
      <p>Expenses: {formatINR(expense)}</p>
    </div>
  );
}

export default function Dashboard() {
  const { demo } = useAuth();

  const [today] = useState(() => new Date());
  const [period, setPeriod] = useState<Period>("month");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const [status, setStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");

  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;

    setStatus("loading");
    setError(null);

    const run = demo
      ? Promise.resolve().then(() => demoSummary(period, today))
      : fetchSummary(period, today);

    run
      .then((s) => {
        if (cancelled) return;

        setSummary(s);
        setUpdatedAt(new Date());
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;

        setError(
          errorMessage(e, "We could not load your overview.")
        );

        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [demo, period, today, reloadKey]);

  const header = (
    <header className="dash__header">
      <div>
        <p className="dash__eyebrow">Overview</p>

        <h1 className="dash__title" id="dash-title">
          Your financial picture
        </h1>

        <p className="dash__meta">
          {demo ? (
            <span className="badge badge--demo">Demo data</span>
          ) : (
            <span className="badge">Your recorded data</span>
          )}{" "}
          {updatedAt && (
            <>
              Last updated{" "}
              {updatedAt.toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </>
          )}
        </p>
      </div>

      <div
        className="seg"
        role="group"
        aria-label="Reporting period"
      >
        {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            className="seg__btn"
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
          >
            {p === "week"
              ? "Week"
              : p === "month"
                ? "Month"
                : "Year"}
          </button>
        ))}
      </div>
    </header>
  );

  if (!summary) {
    return (
      <main className="dash" aria-labelledby="dash-title">
        {header}

        {status === "error" ? (
          <div className="dash__error" role="alert">
            <p>{error}</p>

            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Try again
            </button>
          </div>
        ) : (
          <QuoteLoader message="Gathering your financial picture..." />
        )}
      </main>
    );
  }

  const { current, previous, buckets, categories, recent } = summary;

  const net = current.income - current.expense;
  const prevNet = previous.income - previous.expense;

  const savingsRatePct =
    current.income > 0
      ? Math.round((net * 1000) / current.income) / 10
      : null;

  const topExpense = categories[0]?.paise ?? 0;

  const isEmpty =
    !demo && current.count === 0 && previous.count === 0;

  const chartSummary =
    `${PERIOD_LABEL[period]}: income ${formatINR(current.income)}, ` +
    `expenses ${formatINR(current.expense)}.`;

  return (
    <main
      className="dash"
      aria-labelledby="dash-title"
      aria-busy={status === "loading"}
    >
      {header}

      {status === "error" && (
        <div className="dash__error" role="alert">
          <p>{error} Showing the last loaded figures.</p>

          <button
            type="button"
            className="btn btn--sm"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Try again
          </button>
        </div>
      )}

      <div className="notice" role="note">
        <Info size={18} aria-hidden="true" />

        <p style={{ margin: 0 }}>
          {demo
            ? "Everything on this screen is synthetic sample data for design review. Nothing here is saved or real."
            : "Totals are calculated from the transactions you have recorded. They are not verified against any bank."}
        </p>
      </div>

      {isEmpty ? (
        <section className="card dash__cta">
          <p>
            No transactions yet. Add your first one to see your
            income, expenses and spending patterns.
          </p>

          <Link
            to="/transactions"
            className="btn btn--sm"
            style={{ display: "inline-flex" }}
          >
            Add a transaction
          </Link>
        </section>
      ) : (
        <>
          <section
            className="stats"
            aria-label={`Summary, ${PERIOD_LABEL[period]}`}
            key={period}
          >
            <article className="card stat">
              <p className="stat__label">
                <ArrowDownLeft size={16} aria-hidden="true" />
                Recorded income
              </p>

              <p className="stat__value stat__value--income">
                {formatINR(current.income)}
              </p>

              <Delta
                current={current.income}
                previous={previous.income}
                higherIsGood
              />
            </article>

            <article className="card stat">
              <p className="stat__label">
                <ArrowUpRight size={16} aria-hidden="true" />
                Recorded expenses
              </p>

              <p className="stat__value stat__value--expense">
                {formatINR(current.expense)}
              </p>

              <Delta
                current={current.expense}
                previous={previous.expense}
                higherIsGood={false}
              />
            </article>

            <article className="card stat">
              <p className="stat__label">
                <PiggyBank size={16} aria-hidden="true" />
                Savings
              </p>

              <p
                className={`stat__value ${
                  net >= 0
                    ? "stat__value--income"
                    : "stat__value--expense"
                }`}
              >
                {net < 0 ? "−" : ""}
                {formatINR(Math.abs(net))}
              </p>

              <Delta
                current={net}
                previous={prevNet}
                higherIsGood
              />
            </article>

            <article className="card stat">
              <p className="stat__label">
                <Percent size={16} aria-hidden="true" />
                Savings rate
              </p>

              <p className="stat__value">
                {savingsRatePct === null
                  ? "—"
                  : `${savingsRatePct}%`}
              </p>

              <p className="delta">
                {savingsRatePct === null
                  ? "Needs recorded income"
                  : "Of recorded income this period"}
              </p>
            </article>

            <article className="card stat stat--muted">
              <p className="stat__label">Net worth</p>
              <p className="stat__value">Not available yet</p>
              <p className="delta">
                Shown once assets and liabilities are recorded.
              </p>
            </article>
          </section>

          <div className="dash__grid">
            <section
              className="card"
              aria-labelledby="cashflow-title"
            >
              <h2 className="card__title" id="cashflow-title">
                Cash flow · {PERIOD_LABEL[period]}
              </h2>

              <ul className="legend" aria-hidden="true">
                <li>
                  <span
                    className="legend__dot"
                    style={{ background: "var(--color-income)" }}
                  />
                  Income
                </li>

                <li>
                  <span
                    className="legend__dot"
                    style={{ background: "var(--color-expense)" }}
                  />
                  Expenses
                </li>
              </ul>

              <div
                className="chart"
                role="img"
                aria-label={chartSummary}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={buckets}
                    margin={{
                      top: 4,
                      right: 4,
                      left: 0,
                      bottom: 0,
                    }}
                    barGap={2}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--color-date)"
                    />

                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      interval={period === "month" ? 4 : 0}
                      tick={{
                        fontSize: 11,
                        fill: "#596079",
                      }}
                    />

                    <YAxis
                      width={52}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={compactINR}
                      tick={{
                        fontSize: 11,
                        fill: "#596079",
                      }}
                    />

                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{
                        fill: "rgba(62,195,213,0.12)",
                      }}
                    />

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

            <section
              className="card"
              aria-labelledby="cats-title"
            >
              <h2 className="card__title" id="cats-title">
                Where it went
              </h2>

              {categories.length === 0 ? (
                <p className="empty">
                  No expenses recorded in this period.
                </p>
              ) : (
                <ul className="cats" key={period}>
                  {categories.map((c) => (
                    <li key={c.name}>
                      <div className="cat__top">
                        <span className="cat__name">
                          {c.name}
                        </span>

                        <span className="cat__amount">
                          {formatINR(c.paise)}
                        </span>
                      </div>

                      <div
                        className="track"
                        role="progressbar"
                        aria-label={`${c.name} share of spending`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(
                          (c.paise * 100) / current.expense
                        )}
                      >
                        <div
                          className="track__fill"
                          style={{
                            width: `${
                              Math.max(
                                3,
                                Math.floor(
                                  (c.paise * 100) / topExpense
                                )
                              )
                            }%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              className="card"
              aria-labelledby="txn-title"
            >
              <h2 className="card__title" id="txn-title">
                Recent transactions
              </h2>

              {recent.length === 0 ? (
                <p className="empty">
                  No transactions recorded in this period.
                </p>
              ) : (
                <ul className="txns">
                  {recent.map((t) => (
                    <li className="txn" key={t.id}>
                      <span
                        className={`txn__icon txn__icon--${t.type}`}
                        aria-hidden="true"
                      >
                        {t.type === "income" ? (
                          <ArrowDownLeft size={18} />
                        ) : (
                          <ArrowUpRight size={18} />
                        )}
                      </span>

                      <div>
                        <p className="txn__desc">
                          {t.description}
                        </p>

                        <p className="txn__sub">
                          {t.category} · {t.account} ·{" "}
                          {shortDate(t.date)}
                        </p>
                      </div>

                      <span
                        className={`txn__amount txn__amount--${t.type}`}
                      >
                        <span className="sr-only">
                          {t.type === "income"
                            ? "Income "
                            : "Expense "}
                        </span>

                        {t.type === "income" ? "+" : "−"}
                        {formatINR(t.amountPaise)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {!demo && (
                <p className="list-foot">
                  <Link to="/transactions">
                    View all transactions, search and filters
                  </Link>
                </p>
              )}
            </section>

            <section
              className="card"
              aria-labelledby="goals-title"
            >
              <h2 className="card__title" id="goals-title">
                <Target
                  size={18}
                  aria-hidden="true"
                  style={{
                    verticalAlign: "-3px",
                    marginRight: 8,
                  }}
                />
                Savings goals
              </h2>

              {demo ? (
                <ul className="goals">
                  {DEMO_GOALS.map((g) => {
                    const pct = Math.min(
                      100,
                      Math.floor(
                        (g.savedPaise * 100) / g.targetPaise
                      )
                    );

                    return (
                      <li key={g.id}>
                        <div className="goal__top">
                          <span className="goal__name">
                            {g.name}
                          </span>
                          <span>{pct}%</span>
                        </div>

                        <div
                          className="track"
                          role="progressbar"
                          aria-label={`${g.name} progress`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={pct}
                        >
                          <div
                            className="track__fill"
                            style={{
                              width: `${Math.max(pct, 2)}%`,
                            }}
                          />
                        </div>

                        <p className="goal__sub">
                          {formatINR(g.savedPaise)} of{" "}
                          {formatINR(g.targetPaise)} ·{" "}
                          {formatINR(
                            g.targetPaise - g.savedPaise
                          )}{" "}
                          to go · by {shortDate(g.targetDate)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="empty">
                  Savings goals are not available yet. They
                  arrive in a later batch.
         