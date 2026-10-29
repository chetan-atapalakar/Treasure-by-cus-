import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { History, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import QuoteLoader from "../components/ui/QuoteLoader";
import Modal from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import { formatINR, parseRupeesToPaise } from "../lib/currency";
import { fullDate, isValidISODate, parseISO, todayISO } from "../lib/dates";
import { errorMessage } from "../lib/net";
import { addContribution, createGoal, deleteContribution, deleteGoal, goalProgress, listContributions, listGoals } from "../services/goals";
import type { Contribution, Goal, GoalProgress } from "../types/planning";
import "./Dashboard.css";
import "./auth.css";
import "./data.css";
import "./planning.css";

/** Whole months from today to the target date (at least 1), or 0 if the date has passed. */
function monthsLeft(targetISO: string): number {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.ceil((parseISO(targetISO).getTime() - startOfToday) / 86400000);
  if (days <= 0) return 0;
  return Math.max(1, Math.ceil(days / 30));
}

function GoalForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { notify } = useToast();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFormError(null);

    const next: Record<string, string> = {};
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 80) next.name = "Enter a name up to 80 characters.";
    const paise = parseRupeesToPaise(target);
    if (paise === null) next.target = "Enter a target above zero, like 50000.";
    if (date && (!isValidISODate(date) || date < todayISO())) next.date = "Choose a date that is today or later, or leave it empty.";
    setErrors(next);
    if (Object.keys(next).length > 0 || paise === null) return;

    setBusy(true);
    try {
      await createGoal({ name: trimmed, target_paise: paise, target_date: date || null });
      notify("success", "Goal created.");
      onSaved();
    } catch (err) {
      setFormError(errorMessage(err, "We could not save this goal."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Create savings goal"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="goal-form" className="btn btn--sm" disabled={busy}>{busy ? "Saving..." : "Create goal"}</button>
        </>
      }
    >
      <form id="goal-form" onSubmit={onSubmit} noValidate>
        {formError && <p className="msg msg--error" role="alert">{formError}</p>}
        <div className="field">
          <label className="field__label" htmlFor="g-name">Goal name</label>
          <input id="g-name" className="input" type="text" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} disabled={busy} data-autofocus />
          {errors.name && <p className="field__error" role="alert">{errors.name}</p>}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="g-target">Target amount (₹)</label>
          <input id="g-target" className="input" type="text" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} aria-invalid={Boolean(errors.target)} disabled={busy} />
          {errors.target && <p className="field__error" role="alert">{errors.target}</p>}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="g-date">Target date (optional)</label>
          <input id="g-date" className="input" type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={Boolean(errors.date)} disabled={busy} />
          {errors.date && <p className="field__error" role="alert">{errors.date}</p>}
        </div>
      </form>
    </Modal>
  );
}

function ContributionForm({ goal, onClose, onSaved }: { goal: Goal; onClose: () => void; onSaved: () => void }) {
  const { notify } = useToast();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFormError(null);

    const next: Record<string, string> = {};
    const paise = parseRupeesToPaise(amount);
    if (paise === null) next.amount = "Enter an amount above zero.";
    if (!isValidISODate(date) || date > todayISO() || date < "2000-01-01") next.date = "Choose a valid date that is not in the future.";
    if (note.trim().length > 300) next.note = "Keep the note under 300 characters.";
    setErrors(next);
    if (Object.keys(next).length > 0 || paise === null) return;

    setBusy(true);
    try {
      await addContribution({ goal_id: goal.id, amount_paise: paise, contributed_on: date, note: note.trim() || null });
      notify("success", "Contribution recorded.");
      onSaved();
    } catch (err) {
      setFormError(errorMessage(err, "We could not save this contribution."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Add to ${goal.name}`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="contrib-form" className="btn btn--sm" disabled={busy}>{busy ? "Saving..." : "Save contribution"}</button>
        </>
      }
    >
      <form id="contrib-form" onSubmit={onSubmit} noValidate>
        {formError && <p className="msg msg--error" role="alert">{formError}</p>}
        <p className="field__hint" style={{ marginBottom: 12 }}>
          This records an amount you set aside. It does not move any money or change your account balances.
        </p>
        <div className="field">
          <label className="field__label" htmlFor="c-amount">Amount (₹)</label>
          <input id="c-amount" className="input" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={Boolean(errors.amount)} disabled={busy} data-autofocus />
          {errors.amount && <p className="field__error" role="alert">{errors.amount}</p>}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="c-date">Date</label>
          <input id="c-date" className="input" type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={Boolean(errors.date)} disabled={busy} />
          {errors.date && <p className="field__error" role="alert">{errors.date}</p>}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="c-note">Note (optional)</label>
          <input id="c-note" className="input" type="text" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={Boolean(errors.note)} disabled={busy} />
          {errors.note && <p className="field__error" role="alert">{errors.note}</p>}
        </div>
      </form>
    </Modal>
  );
}

function HistoryModal({ goal, onClose, onChanged }: { goal: Goal; onClose: () => void; onChanged: () => void }) {
  const { notify } = useToast();
  const [items, setItems] = useState<Contribution[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    listContributions(goal.id)
      .then((list) => {
        if (cancelled) return;
        setItems(list);
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(errorMessage(e, "We could not load contributions."));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [goal.id, reloadKey]);

  async function remove(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      await deleteContribution(id);
      notify("success", "Contribution deleted.");
      setConfirmId(null);
      setReloadKey((k) => k + 1);
      onChanged();
    } catch (e) {
      notify("error", errorMessage(e, "We could not delete this contribution."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal title={`${goal.name} · history`} onClose={onClose} busy={busyId !== null}>
      {status === "loading" ? (
        <QuoteLoader size="sm" message="Gathering your financial picture..." />
      ) : status === "error" ? (
        <div className="dash__error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--sm" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      ) : items.length === 0 ? (
        <p className="empty" data-autofocus tabIndex={-1}>No contributions recorded yet.</p>
      ) : (
        <ul className="hist">
          {items.map((c) => (
            <li className="hist__row" key={c.id}>
              <div>
                <p><strong>{formatINR(c.amount_paise)}</strong></p>
                <p className="hist__meta">{fullDate(c.contributed_on)}{c.note ? ` · ${c.note}` : ""}</p>
              </div>
              {confirmId === c.id ? (
                <button type="button" className="link-btn link-btn--danger" onClick={() => remove(c.id)} disabled={busyId !== null}>
                  {busyId === c.id ? "Deleting..." : "Confirm delete"}
                </button>
              ) : (
                <button type="button" className="link-btn link-btn--danger" onClick={() => setConfirmId(c.id)} aria-label={`Delete contribution of ${formatINR(c.amount_paise)}`}>
                  <Trash2 size={14} aria-hidden="true" /> Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export default function Goals() {
  const { demo } = useAuth();
  const { notify } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [progress, setProgress] = useState<GoalProgress[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [contributing, setContributing] = useState<Goal | null>(null);
  const [viewing, setViewing] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    setStatus("loading");
    Promise.all([listGoals(), goalProgress()])
      .then(([g, p]) => {
        if (cancelled) return;
        setGoals(g);
        setProgress(p);
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(errorMessage(e, "We could not load your goals."));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [demo, reloadKey]);

  const savedById = useMemo(() => new Map(progress.map((p) => [p.goal_id, p.saved_paise])), [progress]);

  async function confirmDelete() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteGoal(deleting.id);
      notify("success", "Goal deleted.");
      setDeleting(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      notify("error", errorMessage(e, "We could not delete this goal."));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (demo) {
    return (
      <main className="dash">
        <section className="card dash__cta">
          <h1 className="card__title">Savings goals</h1>
          <p>You are viewing demo data, which is never saved. Sign in to create goals.</p>
          <Link to="/login" className="btn btn--sm" style={{ display: "inline-flex" }}>Go to sign in</Link>
        </section>
      </main>
    );
  }

  if (status === "loading") {
    return (
      <main className="dash">
        <QuoteLoader message="Gathering your financial picture..." />
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

  return (
    <main className="dash" aria-labelledby="goals-page-title">
      <header className="toolbar">
        <div>
          <p className="dash__eyebrow">Planning</p>
          <h1 className="dash__title" id="goals-page-title">Savings goals</h1>
        </div>
        <button type="button" className="btn btn--sm" onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden="true" style={{ marginRight: 6 }} />
          Create goal
        </button>
      </header>

      {goals.length === 0 ? (
        <section className="card dash__cta">
          <p>No goals yet. Create one, such as an emergency fund, and record contributions as you set money aside.</p>
        </section>
      ) : (
        <div className="plan-grid">
          {goals.map((g) => {
            const saved = savedById.get(g.id) ?? 0;
            const remaining = Math.max(0, g.target_paise - saved);
            const reached = saved >= g.target_paise;
            const pct = Math.min(100, Math.floor((saved * 100) / g.target_paise));
            const months = g.target_date ? monthsLeft(g.target_date) : null;

            let paceLine: string | null = null;
            if (!reached && g.target_date) {
              paceLine =
                months === 0
                  ? "The target date has passed. You can keep contributing at your own pace."
                  : `About ${formatINR(Math.ceil(remaining / (months ?? 1)))} a month would reach it by ${fullDate(g.target_date)}.`;
            }

            return (
              <article className="card" key={g.id}>
                <div className="plan__head">
                  <div>
                    <h2 className="plan__title">{g.name}</h2>
                    <p className="plan__sub">{g.target_date ? `Target date ${fullDate(g.target_date)}` : "No target date"}</p>
                  </div>
                </div>

                <p className="plan__amounts">
                  <span className="plan__spent">{formatINR(saved)}</span>
                  <span className="plan__of">of {formatINR(g.target_paise)}</span>
                </p>

                <div className="track" role="progressbar" aria-label={`${g.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                  <div className={`track__fill${reached ? " track__fill--done" : ""}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>

                <p className={`plan__line ${reached ? "plan__line--ok" : ""}`}>
                  {reached ? "Goal reached" : `${formatINR(remaining)} to go · ${pct}%`}
                </p>
                {paceLine && <p className="plan__note">{paceLine} Calculated from your recorded contributions, not a prediction.</p>}

                <div className="plan__actions">
                  <button type="button" className="link-btn" onClick={() => setContributing(g)}>
                    <Plus size={14} aria-hidden="true" /> Add contribution
                  </button>
                  <button type="button" className="link-btn" onClick={() => setViewing(g)}>
                    <History size={14} aria-hidden="true" /> History
                  </button>
                  <button type="button" className="link-btn link-btn--danger" onClick={() => setDeleting(g)} aria-label={`Delete ${g.name}`}>
                    <Trash2 size={14} aria-hidden="true" /> Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {creating && (
        <GoalForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {contributing && (
        <ContributionForm
          goal={contributing}
          onClose={() => setContributing(null)}
          onSaved={() => {
            setContributing(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {viewing && <HistoryModal goal={viewing} onClose={() => setViewing(null)} onChanged={() => setReloadKey((k) => k + 1)} />}

      {deleting && (
        <Modal
          title="Delete this goal?"
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
            “{deleting.name}” and all of its recorded contributions will be removed. This cannot be undone.
          </p>
        </Modal>
      )}
    </main>
  );
}