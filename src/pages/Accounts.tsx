import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import QuoteLoader from "../components/ui/QuoteLoader";
import Modal from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import { formatINR, parseRupeesToPaise } from "../lib/currency";
import { errorMessage } from "../lib/net";
import {
  accountFlows,
  createAccount,
  createCategory,
  ensureDefaultCategories,
  listAccounts,
  listCategories,
  setAccountArchived,
} from "../services/accounts";
import type { Account, AccountFlow, AccountKind, Category, TxnType } from "../types/finance";
import "./Dashboard.css";
import "./auth.css";
import "./data.css";

const KINDS: { value: AccountKind; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank account" },
  { value: "card", label: "Credit card" },
  { value: "wallet", label: "Wallet" },
  { value: "investment", label: "Investment" },
  { value: "loan", label: "Loan" },
];
const kindLabel = (k: AccountKind) => KINDS.find((x) => x.value === k)?.label ?? k;

function AccountForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { notify } = useToast();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("bank");
  const [opening, setOpening] = useState("");
  const [errors, setErrors] = useState<{ name?: string; opening?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFormError(null);

    const next: { name?: string; opening?: string } = {};
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 80) next.name = "Enter a name up to 80 characters.";
    const paise = opening.trim() === "" ? 0 : parseRupeesToPaise(opening, { allowZero: true });
    if (paise === null) next.opening = "Enter an amount like 5000 or 1,250.50, or leave it empty.";
    setErrors(next);
    if (next.name || next.opening || paise === null) return;

    setBusy(true);
    try {
      await createAccount({ name: trimmed, kind, opening_balance_paise: paise });
      notify("success", "Account created.");
      onSaved();
    } catch (err) {
      setFormError(errorMessage(err, "We could not create this account."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add account"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="acct-form" className="btn btn--sm" disabled={busy}>{busy ? "Saving..." : "Create account"}</button>
        </>
      }
    >
      <form id="acct-form" onSubmit={onSubmit} noValidate>
        {formError && <p className="msg msg--error" role="alert">{formError}</p>}
        <div className="field">
          <label className="field__label" htmlFor="a-name">Account name</label>
          <input id="a-name" className="input" type="text" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} disabled={busy} data-autofocus />
          {errors.name && <p className="field__error" role="alert">{errors.name}</p>}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="a-kind">Type</label>
          <select id="a-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as AccountKind)} disabled={busy}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="a-open">Opening balance (₹, optional)</label>
          <input id="a-open" className="input" type="text" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} aria-invalid={Boolean(errors.opening)} disabled={busy} />
          <p className="field__hint">Entered by you. It is not checked against any bank.</p>
          {errors.opening && <p className="field__error" role="alert">{errors.opening}</p>}
        </div>
      </form>
    </Modal>
  );
}

export default function Accounts() {
  const { demo } = useAuth();
  const { notify } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [flows, setFlows] = useState<AccountFlow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [catName, setCatName] = useState("");
  const [catKind, setCatKind] = useState<TxnType>("expense");
  const [catError, setCatError] = useState<string | null>(null);
  const [catBusy, setCatBusy] = useState(false);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        await ensureDefaultCategories();
        const [a, f, c] = await Promise.all([listAccounts(true), accountFlows(), listCategories()]);
        if (cancelled) return;
        setAccounts(a);
        setFlows(f);
        setCategories(c);
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setError(errorMessage(e, "We could not load your accounts. Make sure migration 0002 has been run."));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, reloadKey]);

  const flowById = useMemo(() => new Map(flows.map((f) => [f.account_id, f])), [flows]);

  async function toggleArchive(a: Account) {
    try {
      await setAccountArchived(a.id, !a.is_archived);
      notify("success", a.is_archived ? "Account restored." : "Account archived.");
      setReloadKey((k) => k + 1);
    } catch (e) {
      notify("error", errorMessage(e, "We could not update this account."));
    }
  }

  async function onAddCategory(e: FormEvent) {
    e.preventDefault();
    if (catBusy) return;
    setCatError(null);
    const trimmed = catName.trim();
    if (trimmed.length < 1 || trimmed.length > 60) {
      setCatError("Enter a category name up to 60 characters.");
      return;
    }
    setCatBusy(true);
    try {
      await createCategory(trimmed, catKind);
      setCatName("");
      notify("success", "Category added.");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setCatError(errorMessage(err, "We could not add this category."));
    } finally {
      setCatBusy(false);
    }
  }

  if (demo) {
    return (
      <main className="dash">
        <section className="card dash__cta">
          <h1 className="card__title">Accounts</h1>
          <p>You are viewing demo data, which is never saved. Sign in to add your own accounts.</p>
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

  const active = accounts.filter((a) => !a.is_archived);
  const archived = accounts.filter((a) => a.is_archived);

  const renderCard = (a: Account) => {
    const f = flowById.get(a.id);
    const balance = a.opening_balance_paise + (f?.income_paise ?? 0) - (f?.expense_paise ?? 0);
    return (
      <article className="card" key={a.id}>
        <p className="acct__kind">{kindLabel(a.kind)}</p>
        <h3 className="acct__name">{a.name}</h3>
        <p className="acct__bal">{formatINR(balance)}</p>
        <p className="acct__note">Recorded balance: opening balance plus your entries. Not bank-verified.</p>
        <button type="button" className="link-btn" onClick={() => toggleArchive(a)}>
          {a.is_archived ? "Restore" : "Archive"}
        </button>
      </article>
    );
  };

  return (
    <main className="dash" aria-labelledby="acct-title">
      <header className="toolbar">
        <div>
          <p className="dash__eyebrow">Records</p>
          <h1 className="dash__title" id="acct-title">Accounts</h1>
        </div>
        <button type="button" className="btn btn--sm" onClick={() => setAdding(true)}>
          <Plus size={18} aria-hidden="true" style={{ marginRight: 6 }} />
          Add account
        </button>
      </header>

      {active.length === 0 ? (
        <section className="card dash__cta">
          <p>No accounts yet. Add one (for example “Cash” or “Savings account”) to start recording transactions.</p>
        </section>
      ) : (
        <div className="acct-grid">{active.map(renderCard)}</div>
      )}

      {archived.length > 0 && (
        <section aria-label="Archived accounts">
          <h2 className="card__title">Archived</h2>
          <div className="acct-grid">{archived.map(renderCard)}</div>
        </section>
      )}

      <section className="card" aria-labelledby="cat-title">
        <h2 className="card__title" id="cat-title">Categories</h2>
        <p className="acct__note" style={{ marginTop: 0 }}>Expense</p>
        <ul className="chips">
          {categories.filter((c) => c.kind === "expense").map((c) => (
            <li className="chip" key={c.id}>{c.name}</li>
          ))}
        </ul>
        <p className="acct__note">Income</p>
        <ul className="chips">
          {categories.filter((c) => c.kind === "income").map((c) => (
            <li className="chip" key={c.id}>{c.name}</li>
          ))}
        </ul>

        <form className="inline-form" onSubmit={onAddCategory} noValidate>
          <div className="field" style={{ flex: "1 1 160px", marginBottom: 0 }}>
            <label className="field__label" htmlFor="c-name">New category</label>
            <input id="c-name" className="input" type="text" maxLength={60} value={catName} onChange={(e) => setCatName(e.target.value)} aria-invalid={Boolean(catError)} disabled={catBusy} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field__label" htmlFor="c-kind">Kind</label>
            <select id="c-kind" className="input" value={catKind} onChange={(e) => setCatKind(e.target.value as TxnType)} disabled={catBusy}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <button type="submit" className="btn btn--sm" disabled={catBusy}>{catBusy ? "Adding..." : "Add"}</button>
        </form>
        {catError && <p className="field__error" role="alert" style={{ marginTop: 8 }}>{catError}</p>}
      </section>

      {adding && (
        <AccountForm
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </main>
  );
}