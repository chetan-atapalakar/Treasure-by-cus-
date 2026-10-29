import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import QuoteLoader from "../components/ui/QuoteLoader";
import Modal from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import { formatINR, parseRupeesToPaise } from "../lib/currency";
import { fullDate, isValidISODate, parseISO, toISO, todayISO } from "../lib/dates";
import { errorMessage } from "../lib/net";
import { createEvent, deleteEvent, listEvents, setEventStatus } from "../services/calendar";
import type { CalendarEvent, EventKind, Recurrence } from "../types/platform";
import "./Dashboard.css";
import "./auth.css";
import "./data.css";
import "./planning.css";
import "./extra.css";

const KINDS: { value: EventKind; label: string }[] = [
  { value: "bill", label: "Bill" },
  { value: "emi", label: "EMI" },
  { value: "card_payment", label: "Credit-card payment" },
  { value: "subscription", label: "Subscription renewal" },
  { value: "sip", label: "SIP contribution" },
  { value: "fd_maturity", label: "FD maturity" },
  { value: "milestone", label: "Savings milestone" },
  { value: "other", label: "Other" },
];
const kindLabel = (k: EventKind) => KINDS.find((x) => x.value === k)?.label ?? k;

function nextDue(iso: string, rec: Recurrence): string {
  const d = parseISO(iso);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + (rec === "monthly" ? 1 : 12), 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return toISO(t);
}

function EventForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { notify } = useToast();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<EventKind>("bill");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFormError(null);
    const next: Record<string, string> = {};
    const t = title.trim();
    if (t.length < 1 || t.length > 120) next.title = "Enter a title up to 120 characters.";
    if (!isValidISODate(date)) next.date = "Choose a valid date.";
    const paise = amount.trim() === "" ? null : parseRupeesToPaise(amount);
    if (amount.trim() !== "" && paise === null) next.amount = "Enter an amount above zero, or leave it empty.";
    if (notes.trim().length > 500) next.notes = "Keep notes under 500 characters.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await createEvent({ title: t, kind, due_on: date, amount_paise: paise, recurrence, notes: notes.trim() || null });
      notify("success", "Event saved.");
      onSaved();
    } catch (err) {
      setFormError(errorMessage(err, "We could not save this event."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add calendar event"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="event-form" className="btn btn--sm" disabled={busy}>{busy ? "Saving..." : "Save event"}</button>
        </>
      }
    >
      <form id="event-form" onSubmit={onSubmit} noValidate>
        {formError && <p className="msg msg--error" role="alert">{formError}</p>}
        <div className="field">
          <label className="field__label" htmlFor="e-title">Title</label>
          <input id="e-title" className="input" type="text" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={Boolean(errors.title)} disabled={busy} data-autofocus />
          {errors.title && <p className="field__error" role="alert">{errors.title}</p>}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="e-kind">Type</label>
          <select id="e-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as EventKind)} disabled={busy}>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="e-date">Due date</label>
          <input id="e-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={Boolean(errors.date)} disabled={busy} />
          {errors.date && <p className="field__error" role="alert">{errors.date}</p>}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="e-amount">Planned amount (₹, optional)</label>
          <input id="e-amount" className="input" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={Boolean(errors.amount)} disabled={busy} />
          <p className="field__hint">An amount you expect, entered by you.</p>
          {errors.amount && <p className="field__error" role="alert">{errors.amount}</p>}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="e-rec">Repeats</label>
          <select id="e-rec" className="input" value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)} disabled={busy}>
            <option value="none">Does not repeat</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <p className="field__hint">When you mark a repeating event done, the next one is added.</p>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="e-notes">Notes (optional)</label>
          <input id="e-notes" className="input" type="text" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} />
          {errors.notes && <p className="field__error" role="alert">{errors.notes}</p>}
        </div>
      </form>
    </Modal>
  );
}

export default function Calendar() {
  const { demo } = useAuth();
  const { notify } = useToast();
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const start = toISO(cursor);
  const end = toISO(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    setStatus("loading");
    listEvents(start, end)
      .then((list) => {
        if (cancelled) return;
        setEvents(list);
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(errorMessage(e, "We could not load your calendar."));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [demo, start, end, reloadKey]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) m.set(e.due_on, [...(m.get(e.due_on) ?? []), e]);
    return Array.from(m.entries());
  }, [events]);

  async function act(e: CalendarEvent, action: "done" | "skip" | "delete") {
    if (busyId) return;
    setBusyId(e.id);
    try {
      if (action === "delete") {
        await deleteEvent(e.id);
        notify("success", "Event deleted.");
      } else {
        await setEventStatus(e.id, action === "done" ? "completed" : "skipped");
        if (action === "done" && e.recurrence !== "none") {
          await createEvent({
            title: e.title, kind: e.kind, due_on: nextDue(e.due_on, e.recurrence), amount_paise: e.amount_paise,
            recurrence: e.recurrence, notes: e.notes,
          });
        }
        notify("success", action === "done" ? "Marked as done by you." : "Marked as skipped.");
      }
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify("error", errorMessage(err, "We could not update this event."));
    } finally {
      setBusyId(null);
    }
  }

  if (demo) {
    return (
      <main className="dash">
        <section className="card dash__cta">
          <h1 className="card__title">Financial calendar</h1>
          <p>You are viewing demo data, which is never saved. Sign in to plan bills and reminders.</p>
          <Link to="/login" className="btn btn--sm" style={{ display: "inline-flex" }}>Go to sign in</Link>
        </section>
      </main>
    );
  }

  const today = todayISO();
  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <main className="dash" aria-labelledby="cal-title">
      <header className="toolbar">
        <div>
          <p className="dash__eyebrow">Planning</p>
          <h1 className="dash__title" id="cal-title">Financial calendar</h1>
        </div>
        <button type="button" className="btn btn--sm" onClick={() => setAdding(true)}>
          <Plus size={18} aria-hidden="true" style={{ marginRight: 6 }} /> Add event
        </button>
      </header>

      <div className="notice" role="note">
        <p style={{ margin: 0 }}>These are items you plan. Nothing is marked completed unless you mark it. Planned amounts are your own estimates.</p>
      </div>

      <div className="toolbar">
        <button type="button" className="link-btn" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} aria-hidden="true" /> Prev</button>
        <h2 className="card__title" style={{ margin: 0 }} aria-live="polite">{monthLabel}</h2>
        <button type="button" className="link-btn" onClick={() => shift(1)} aria-label="Next month">Next <ChevronRight size={16} aria-hidden="true" /></button>
      </div>

      {status === "loading" ? (
        <QuoteLoader message="Gathering your financial picture..." />
      ) : status === "error" ? (
        <div className="dash__error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--sm" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      ) : byDay.length === 0 ? (
        <section className="card dash__cta"><p>Nothing planned for {monthLabel}. Add a bill, EMI, subscription or milestone.</p></section>
      ) : (
        <div className="agenda">
          {byDay.map(([day, list]) => (
            <section className="agenda__day" key={day}>
              <h3>{fullDate(day)}</h3>
              <ul className="hist">
                {list.map((e) => {
                  const overdue = e.status === "scheduled" && e.due_on < today;
                  return (
                    <li className="hist__row" key={e.id} style={{ alignItems: "flex-start" }}>
                      <div>
                        <p><strong>{e.title}</strong> {e.amount_paise ? `· ${formatINR(e.amount_paise)} planned` : ""}</p>
                        <p className="hist__meta">
                          {kindLabel(e.kind)}{e.recurrence !== "none" ? ` · repeats ${e.recurrence}` : ""}{e.notes ? ` · ${e.notes}` : ""}
                        </p>
                        <p style={{ margin: "6px 0 0" }}>
                          <span className={`tag ${overdue ? "tag--over" : e.status === "completed" ? "tag--done" : ""}`}>
                            {overdue ? "Overdue" : e.status === "completed" ? "Done (marked by you)" : e.status === "skipped" ? "Skipped" : "Upcoming"}
                          </span>
                        </p>
                      </div>
                      <div className="plan__actions" style={{ marginTop: 0, justifyContent: "flex-end" }}>
                        {e.status === "scheduled" && (
                          <>
                            <button type="button" className="link-btn" onClick={() => act(e, "done")} disabled={busyId !== null}>Mark done</button>
                            <button type="button" className="link-btn" onClick={() => act(e, "skip")} disabled={busyId !== null}>Skip</button>
                          </>
                        )}
                        <button type="button" className="link-btn link-btn--danger" onClick={() => act(e, "delete")} disabled={busyId !== null} aria-label={`Delete ${e.title}`}>
                          <Trash2 size={14} aria-hidden="true" /> Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {adding && <EventForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); setReloadKey((k) => k + 1); }} />}
    </main>
  );
}