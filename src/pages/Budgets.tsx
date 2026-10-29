import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import QuoteLoader from "../components/ui/QuoteLoader";
import Modal from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import { formatINR, parseRupeesToPaise } from "../lib/currency";
import { fullDate, isValidISODate, parseISO, toISO, todayISO } from "../lib/dates";
import { errorMessage } from "../lib/net";
import { ensureDefaultCategories, listCategories } from "../services/accounts";
import { budgetProgress, createBudget, deleteBudget, listBudgets, syncBudgetAlerts } from "../services/budgets";
import type { Category } from "../types/finance";
import type { Budget, BudgetProgress } from "../types/planning";
import "./Dashboard.css";
import "./auth.css";
import "./data.css";
import "./planning.css";

type Level = "ok" | "near" | "over";

function level(amount: number, spent: number, threshold: number): Level {
  if (spent > amount) return "over";
  if (spent * 100 >= amount * threshold) return "near";
  return "ok";
}

function BudgetForm({
  categories,
  onClose,
  onSaved,
}: {
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify } = useToast();
  const [categoryId, setCategoryId] = useState("");
  const [period, setPeriod] = useState<"monthly" | "custom">("monthly");
  const [amount, setAmount] = useState("");
  const [threshold, setThreshold] = useState("80");
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFormError(null);

    const next: Record<string, string> = {};
    const paise = parseRupeesToPaise(amount);
    if (paise === null) next.amount = "Enter an amount above zero, like 4000.";
    const pct = Number(threshold);
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) next.threshold = "Enter a whole number from 1 to 100.";
    if (period === "custom") {
      if (!isValidISODate(start)) next.start = "Choose a valid start date.";
      if (!isValidISODate(end)) next.end = "Choose a valid end date.";
      else if (isValidISODate(start) && end < start) next.end = "The end date must be on or after the start date.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || paise === null) return;

    const monthStart = toISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

    setBusy(true);
    try {
      await createBudget({
        category_id: categoryId || null,
        period,
        starts_on: period === "monthly" ? monthStart : start,
        ends_on: period === "custom" ? end : null,
        amount_paise: paise,
        alert_threshold_pct: pct,
      });
      notify("success", "Budget saved.");
      onSaved();
    } catch (err) {
      setFormError(errorMessage(err, "We could not save this budget."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Create budget"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="budget-form" className="btn btn--sm" disabled={busy}>{busy ? "Saving..." : "Save budget"}</button>
        </>
      }
    >
      <form id="budget-form" onSubmit={onSubmit} noValidate>
        {formError && <p className="msg msg--error" role="alert">{formError}</p>}

        <div className="seg" role="group" aria-label="Budget period" style={{ marginBottom: 16 }}>
          <button type="button" className="seg__btn" aria-pressed={period === "monthly"} onClick={() => setPeriod("monthly")}>Monthly</button>
          <button type="button" className="seg__btn" aria-pressed={period === "custom"} onClick={() => setPeriod("custom")}>Custom dates</button>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="b-cat">Applies to</label>
          <select id="b-cat" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={busy} data-autofocus>
            <option value="">All spending</option>
            {categories.filter((c) => c.kind === "expense").map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="b-amount">Budget amount (₹)</label>
          <input id="b-amount" className="input" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={Boolean(errors.amount)} disabled={busy} />
          {errors.amount && <p className="field__error" role="alert">{errors.amount}</p>}
        </div>

        {period === "custom" && (
          <>
            <div className="field">
              <label className="field__label" htmlFor="b-start">Start date</label>
              <input id="b-start" className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={Boolean(errors.start)} disabled={busy} />
              {errors.start && <p className="field__error" role="alert">{errors.start}</p>}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="b-end">End date</label>
              <input id="b-end" className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} aria-invalid={Boolean(errors.end)} disabled={busy} />
              {errors.end && <p className="field__error" role="alert">{errors.end}</p>}
            </div>
          </>
        )}

        <div className="field">
          <label className="field__label" htmlFor="b-threshold">Heads-up when used (%)</label>
          <input id="b-threshold" className="input" type="text" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} aria-invalid={Boolean(errors.threshold)} disabled={busy} />
          <p className="field__hint">You will get a notification when recorded spending reaches this share of the budget.</p>
          {errors.threshold && <p className="field__error" role="alert">{errors.threshold}</p>}
        </div>
      </form>
    </Modal>
  );
}

export default function Budgets() {
  const { demo } = useAuth();
  const { notify } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [progress, setProgress] = useState<BudgetProgress[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        await ensureDefaultCategories();
        const [c, b, p] = await Promise.all([listCategories(), listBudgets(), budgetProgress()]);
        if (cancelled) return;
        setCategories(c);
        setBudgets(b);
        setProgress(p);
        setStatus("ready");
        try {
          const added = await syncBudgetAlerts();
          if (added > 0 && !cancelled) notify("info", "A budget alert was added to your notifications.");
        } catch {
          // Alerts are best-effort; the budget screen itself still works.
        }
      } catch (e) {
        if (cancelled) return;
        setError(errorMessage(e, "We could not load your budgets."));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, reloadKey, notify]);

  const progressById = useMemo(() => new Map(progress.map((p) => [p.budget_id, p])), [progress]);
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  async function confirmDelete() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteBudget(deleting.id);
      notify("success", "Budget deleted.");
      setDeleting(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      notify("error", errorMessage(e, "We could not delete this budget."));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (demo) {
    return (
      <main className="dash">
        <section className="card dash__cta">
          <h1 className="card__title">Budgets</h1>
          <p>You are viewing demo data, which is never saved. Sign in to create budgets.</p>
          <Link to="/login" className="btn btn--sm" style={{ display: "inline-flex" }}>Go to sign in</Link>
        </section>
      </main>
    );
  }

  if (status === "loading") {
    return (
      <main className="dash">
        <QuoteLoader message="Reviewing your spending patterns..." />
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="dash">
        <div className="dash__error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--sm" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      </main>
    );
  }

  const today = todayISO();

  return (
    <main className="dash" aria-labelledby="budget-title">
      <header className="toolbar">
        <div>
          <p className="dash__eyebrow">Planning</p>
          <h1 className="dash__title" id="budget-title">Budgets</h1>
        </div>
        <button type="button" className="btn btn--sm" onClick={() => setAdding(true)}>
          <Plus size={18} aria-hidden="true" style={{ marginRight: 6 }} />
          Create budget
        </button>
      </header>

      <div className="notice" role="note">
        <p style={{ margin: 0 }}>Budgets compare against the expenses you have recorded. Transfers are not counted as spending.</p>
      </div>

      {budgets.length === 0 ? (
        <section className="card dash__cta">
          <p>No budgets yet. Create one, for example a monthly limit for Food &amp; Dining.</p>
        </section>
      ) : (
        <div className="plan-grid">
          {budgets.map((b) => {
            const p = progressById.get(b.id);
            const spent = p?.spent_paise ?? 0;
            const lvl = level(b.amount_paise, spent, b.alert_threshold_pct);
            const pct = Math.min(100, Math.floor((spent * 100) / b.amount_paise));
            const name = b.category_id ? (categoryName.get(b.category_id) ?? "Category") : "All spending";
            const windowLabel =
              b.period === "monthly"
                ? parseISO(p?.window_start ?? b.starts_on).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
                : `${fullDate(b.starts_on)} – ${fullDate(b.ends_on ?? b.starts_on)}${b.ends_on && b.ends_on < today ? " (ended)" : ""}`;
            const remaining = b.amount_paise - spent;

            return (
              <article className="card" key={b.id}>
                <div className="plan__head">
                  <div>
                    <h2 className="plan__title">{name}</h2>
                    <p className="plan__sub">{b.period === "monthly" ? "Monthly" : "Custom"} · {windowLabel}</p>
                  </div>
                </div>

                <p className="plan__amounts">
                  <span className="plan__spent">{formatINR(spent)}</span>
                  <span className="plan__of">of {formatINR(b.amount_paise)}</span>
                </p>

                <div className="track" role="progressbar" aria-label={`${name} budget used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                  <div className={`track__fill${lvl === "over" ? " track__fill--over" : ""}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>

                <p className={`plan__line plan__line--${lvl}`}>
                  {lvl === "over"
                    ? `${formatINR(spent - b.amount_paise)} over this budget`
                    : lvl === "near"
                      ? `${formatINR(remaining)} left · past your ${b.alert_threshold_pct}% heads-up level`
                      : `${formatINR(remaining)} left`}
                </p>
                <p className="plan__note">Heads-up at {b.alert_threshold_pct}% used.</p>

                <div className="plan__actions">
                  <button type="button" className="link-btn link-btn--danger" onClick={() => setDeleting(b)} aria-label={`Delete ${name} budget`}>
                    <Trash2 size={14} aria-hidden="true" /> Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {adding && (
        <BudgetForm
          categories={categories}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {deleting && (
        <Modal
          title="Delete this budget?"
          onClose={() => setDeleting(null)}
          busy={deleteBusy}
          footer={
            <>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDeleting(null)} disabled={deleteBusy}>Keep it</button>
              <button type="button" className="btn btn--danger btn--sm" onClick={confirmDelete} disabled={deleteBusy}>{deleteBusy ? "Deleting..." : "Delete"}</button>
            </>
          }
        >
          <p style={{ margin: 0, fontSize: "var(--text-sm)" }} data-autofocus tabIndex={-1}>
            This removes the budget only. Your transactions are not affected.
          </p>
        </Modal>
      )}
    </main>
  );
}