import { useState, type FormEvent, type ReactNode } from "react";
import Modal from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { paiseToInput, parseRupeesToPaise } from "../../lib/currency";
import { isValidISODate, todayISO } from "../../lib/dates";
import { errorMessage } from "../../lib/net";
import { createTransaction, updateTransaction } from "../../services/transactions";
import type { Account, Category, Transaction, TxnInput, TxnType } from "../../types/finance";

interface Props {
  initial?: Transaction;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="field__hint">{hint}</p>}
      {error && (
        <p className="field__error" id={`${id}-err`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function TransactionForm({ initial, accounts, categories, onClose, onSaved }: Props) {
  const { notify } = useToast();
  const editing = Boolean(initial);

  const [type, setType] = useState<TxnType>(initial?.type ?? "expense");
  const [amount, setAmount] = useState(initial ? paiseToInput(initial.amount_paise) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [date, setDate] = useState(initial?.occurred_on ?? todayISO());
  const [accountId, setAccountId] = useState(initial?.account_id ?? accounts.find((a) => !a.is_archived)?.id ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [merchant, setMerchant] = useState(initial?.merchant ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accountOptions = accounts.filter((a) => !a.is_archived || a.id === initial?.account_id);
  const categoryOptions = categories.filter((c) => c.kind === type);

  function chooseType(next: TxnType) {
    setType(next);
    const current = categories.find((c) => c.id === categoryId);
    if (current && current.kind !== next) setCategoryId("");
  }

  function validate() {
    const e: Record<string, string> = {};
    const paise = parseRupeesToPaise(amount);
    if (paise === null) e.amount = "Enter an amount above zero, like 1500 or 1,250.50.";

    const desc = description.trim();
    if (desc.length < 1) e.description = "Add a short description.";
    else if (desc.length > 200) e.description = "Keep the description under 200 characters.";

    if (!isValidISODate(date)) e.date = "Choose a valid date.";
    else if (date > todayISO()) e.date = "The date cannot be in the future.";
    else if (date < "2000-01-01") e.date = "Choose a date from the year 2000 onward.";

    if (!accountId) e.account = "Choose an account.";
    if (merchant.trim().length > 120) e.merchant = "Keep the merchant under 120 characters.";
    if (notes.trim().length > 1000) e.notes = "Keep notes under 1000 characters.";
    return { e, paise };
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (busy) return; // blocks accidental double submission
    setFormError(null);

    const { e, paise } = validate();
    setErrors(e);
    const firstKey = Object.keys(e)[0];
    if (firstKey || paise === null) {
      if (firstKey) document.getElementById(`tf-${firstKey}`)?.focus();
      return;
    }

    const input: TxnInput = {
      account_id: accountId,
      category_id: categoryId || null,
      type,
      amount_paise: paise,
      occurred_on: date,
      description: description.trim(),
      merchant: merchant.trim() || null,
      notes: notes.trim() || null,
    };

    setBusy(true);
    try {
      if (initial) await updateTransaction(initial.id, input);
      else await createTransaction(input);
      notify("success", editing ? "Transaction updated." : "Transaction saved.");
      onSaved();
    } catch (err) {
      setFormError(errorMessage(err, "We could not save this transaction. Please try again."));
      notify("error", "Transaction failed to save.");
    } finally {
      setBusy(false);
    }
  }

  const describedBy = (key: string) => (errors[key] ? `tf-${key}-err` : undefined);

  return (
    <Modal
      title={editing ? "Edit transaction" : "Add transaction"}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="txn-form" className="btn btn--sm" disabled={busy}>
            {busy ? "Saving..." : editing ? "Save changes" : "Save transaction"}
          </button>
        </>
      }
    >
      <form id="txn-form" onSubmit={onSubmit} noValidate>
        {formError && (
          <p className="msg msg--error" role="alert">
            {formError}
          </p>
        )}

        <div className="seg" role="group" aria-label="Transaction type" style={{ marginBottom: 16 }}>
          <button type="button" className="seg__btn" aria-pressed={type === "expense"} onClick={() => chooseType("expense")}>
            Expense
          </button>
          <button type="button" className="seg__btn" aria-pressed={type === "income"} onClick={() => chooseType("income")}>
            Income
          </button>
        </div>

        <Field id="tf-amount" label="Amount (₹)" error={errors.amount}>
          <input
            id="tf-amount"
            className="input"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={describedBy("amount")}
            disabled={busy}
            data-autofocus
          />
        </Field>

        <Field id="tf-description" label="Description" error={errors.description}>
          <input
            id="tf-description"
            className="input"
            type="text"
            maxLength={200}
            placeholder="e.g. Groceries"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={describedBy("description")}
            disabled={busy}
          />
        </Field>

        <Field id="tf-date" label="Date" error={errors.date}>
          <input
            id="tf-date"
            className="input"
            type="date"
            max={todayISO()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={Boolean(errors.date)}
            aria-describedby={describedBy("date")}
            disabled={busy}
          />
        </Field>

        <Field id="tf-account" label="Account" error={errors.account}>
          <select
            id="tf-account"
            className="input"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            aria-invalid={Boolean(errors.account)}
            aria-describedby={describedBy("account")}
            disabled={busy}
          >
            <option value="">Choose an account</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>

        <Field id="tf-category" label="Category (optional)">
          <select id="tf-category" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={busy}>
            <option value="">Uncategorised</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field id="tf-merchant" label="Merchant (optional)" error={errors.merchant}>
          <input
            id="tf-merchant"
            className="input"
            type="text"
            maxLength={120}
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            aria-describedby={describedBy("merchant")}
            disabled={busy}
          />
        </Field>

        <Field id="tf-notes" label="Notes (optional)" error={errors.notes}>
          <textarea
            id="tf-notes"
            className="input input--area"
            rows={3}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-describedby={describedBy("notes")}
            disabled={busy}
          />
        </Field>
      </form>
    </Modal>
  );
}