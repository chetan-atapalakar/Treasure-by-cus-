import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import QuoteLoader from "../components/ui/QuoteLoader";
import Modal from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import TransactionForm from "../components/transactions/TransactionForm";
import { formatINR, parseRupeesToPaise } from "../lib/currency";
import { fullDate, isValidISODate } from "../lib/dates";
import { errorMessage } from "../lib/net";
import { ensureDefaultCategories, listAccounts, listCategories } from "../services/accounts";
import { deleteTransaction, listTransactions } from "../services/transactions";
import type { Account, Category, SortKey, Transaction, TxnFilters, TxnType } from "../types/finance";
import "./Dashboard.css";
import "./auth.css";
import "./data.css";

const PAGE_SIZE = 20;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function Transactions() {
  const { demo } = useAuth();
  const { notify } = useToast();

  // Reference data (accounts + categories)
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [refStatus, setRefStatus] = useState<"loading" | "ready" | "error">("loading");
  const [refError, setRefError] = useState<string | null>(null);
  const [refKey, setRefKey] = useState(0);

  // Filters
  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebounced(searchText, 350);
  const [type, setType] = useState<"" | TxnType>("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");
  const [sort, setSort] = useState<SortKey>("date_desc");
  const [page, setPage] = useState(0);

  // List
  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [listStatus, setListStatus] = useState<"loading" | "ready" | "error">("loading");
  const [listError, setListError] = useState<string | null>(null);
  const [listKey, setListKey] = useState(0);

  // Dialogs
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    setRefStatus("loading");
    (async () => {
      try {
        await ensureDefaultCategories();
        const [a, c] = await Promise.all([listAccounts(true), listCategories()]);
        if (cancelled) return;
        setAccounts(a);
        setCategories(c);
        setRefStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setRefError(errorMessage(e, "We could not load your accounts and categories."));
        setRefStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, refKey]);

  const minPaise = minText.trim() === "" ? null : parseRupeesToPaise(minText, { allowZero: true });
  const maxPaise = maxText.trim() === "" ? null : parseRupeesToPaise(maxText, { allowZero: true });
  const minInvalid = minText.trim() !== "" && minPaise === null;
  const maxInvalid = maxText.trim() !== "" && maxPaise === null;
  const rangeInvalid = isValidISODate(from) && isValidISODate(to) && from > to;

  const query: TxnFilters = useMemo(
    () => ({
      search: debouncedSearch,
      type,
      accountId,
      categoryId,
      from: isValidISODate(from) ? from : "",
      to: isValidISODate(to) ? to : "",
      minPaise,
      maxPaise,
      sort,
      page,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, type, accountId, categoryId, from, to, minPaise, maxPaise, sort, page],
  );

  useEffect(() => {
    if (demo || refStatus !== "ready") return;
    let cancelled = false;
    setListStatus("loading");
    setListError(null);
    listTransactions(query)
      .then((res) => {
        if (cancelled) return;
        if (res.rows.length === 0 && res.total > 0 && query.page > 0) {
          setPage(Math.ceil(res.total / PAGE_SIZE) - 1);
          return;
        }
        setRows(res.rows);
        setTotal(res.total);
        setListStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setListError(errorMessage(e, "We could not load your transactions."));
        setListStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [demo, refStatus, query, listKey]);

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const activeFilterCount =
    [type, accountId, categoryId, from, to, minText.trim(), maxText.trim()].filter(Boolean).length + (sort !== "date_desc" ? 1 : 0);
  const hasFilters = activeFilterCount > 0 || searchText.trim() !== "";

  function clearFilters() {
    setSearchText("");
    setType("");
    setAccountId("");
    setCategoryId("");
    setFrom("");
    setTo("");
    setMinText("");
    setMaxText("");
    setSort("date_desc");
    setPage(0);
  }

  async function confirmDelete() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteTransaction(deleting.id);
      notify("success", "Transaction deleted.");
      setDeleting(null);
      setListKey((k) => k + 1);
    } catch (e) {
      notify("error", errorMessage(e, "We could not delete this transaction."));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (demo) {
    return (
      <main className="dash">
        <section className="card dash__cta">
          <h1 className="card__title">Transactions</h1>
          <p>You are viewing demo data, which is never saved. Sign in with your mobile number to record real transactions.</p>
          <Link to="/login" className="btn btn--sm" style={{ display: "inline-flex" }}>
            Go to sign in
          </Link>
        </section>
      </main>
    );
  }

  if (refStatus === "loading") {
    return (
      <main className="dash">
        <QuoteLoader message="Gathering your financial picture..." />
      </main>
    );
  }

  if (refStatus === "error") {
    return (
      <main className="dash">
        <div className="dash__error" role="alert">
          <p>{refError}</p>
          <button type="button" className="btn btn--sm" onClick={() => setRefKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  const activeAccounts = accounts.filter((a) => !a.is_archived);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="dash" aria-labelledby="txn-page-title">
      <header className="toolbar">
        <div>
          <p className="dash__eyebrow">Records</p>
          <h1 className="dash__title" id="txn-page-title">
            Transactions
          </h1>
        </div>
        <button type="button" className="btn btn--sm" onClick={() => setCreating(true)} disabled={activeAccounts.length === 0}>
          <Plus size={18} aria-hidden="true" style={{ marginRight: 6 }} />
          Add transaction
        </button>
      </header>

      {activeAccounts.length === 0 && (
        <div className="notice" role="note">
          <p style={{ margin: 0 }}>
            Create an account first so transactions have somewhere to live. <Link to="/accounts">Go to Accounts</Link>
          </p>
        </div>
      )}

      <section className="card" aria-label="Transaction list">
        <div className="search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search description or merchant"
            aria-label="Search transactions"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setPage(0);
            }}
          />
        </div>

        <details className="filters">
          <summary>Filters &amp; sorting{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</summary>
          <div className="filters__grid">
            <div className="field">
              <label className="field__label" htmlFor="f-type">Type</label>
              <select id="f-type" className="input" value={type} onChange={(e) => { setType(e.target.value as "" | TxnType); setPage(0); }}>
                <option value="">All</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="f-account">Account</label>
              <select id="f-account" className="input" value={accountId} onChange={(e) => { setAccountId(e.target.value); setPage(0); }}>
                <option value="">All accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="f-category">Category</label>
              <select id="f-category" className="input" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(0); }}>
                <option value="">All categories</option>
                <option value="none">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.kind})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="f-from">From date</label>
              <input id="f-from" className="input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="f-to">To date</label>
              <input id="f-to" className="input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
              {rangeInvalid && <p className="field__error" role="alert">“From” is after “To”.</p>}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="f-min">Minimum (₹)</label>
              <input id="f-min" className="input" type="text" inputMode="decimal" value={minText} onChange={(e) => { setMinText(e.target.value); setPage(0); }} aria-invalid={minInvalid} />
              {minInvalid && <p className="field__error" role="alert">Enter a number.</p>}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="f-max">Maximum (₹)</label>
              <input id="f-max" className="input" type="text" inputMode="decimal" value={maxText} onChange={(e) => { setMaxText(e.target.value); setPage(0); }} aria-invalid={maxInvalid} />
              {maxInvalid && <p className="field__error" role="alert">Enter a number.</p>}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="f-sort">Sort by</label>
              <select id="f-sort" className="input" value={sort} onChange={(e) => { setSort(e.target.value as SortKey); setPage(0); }}>
                <option value="date_desc">Newest first</option>
                <option value="date_asc">Oldest first</option>
                <option value="amount_desc">Amount, high to low</option>
                <option value="amount_asc">Amount, low to high</option>
              </select>
            </div>
          </div>
          {hasFilters && (
            <button type="button" className="link-btn" onClick={clearFilters} style={{ marginTop: 8 }}>
              Clear all filters
            </button>
          )}
        </details>

        {listStatus === "loading" ? (
          <QuoteLoader size="sm" message="Searching your transactions..." />
        ) : listStatus === "error" ? (
          <div className="dash__error" role="alert">
            <p>{listError}</p>
            <button type="button" className="btn btn--sm" onClick={() => setListKey((k) => k + 1)}>
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="empty">
            {hasFilters ? "No transactions match these filters." : "No transactions yet. Use “Add transaction” to record your first one."}
          </p>
        ) : (
          <>
            <ul className="txns">
              {rows.map((t) => (
                <li className="txn" key={t.id}>
                  <span className={`txn__icon txn__icon--${t.type}`} aria-hidden="true">
                    {t.type === "income" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                  </span>
                  <div>
                    <p className="txn__desc">{t.description}</p>
                    <p className="txn__sub">
                      {t.category_id ? (categoryName.get(t.category_id) ?? "Uncategorised") : "Uncategorised"} ·{" "}
                      {accountName.get(t.account_id) ?? "Account"} · {fullDate(t.occurred_on)}
                      {t.merchant ? ` · ${t.merchant}` : ""}
                    </p>
                    <div className="txn__actions">
                      <button type="button" className="link-btn" onClick={() => setEditing(t)} aria-label={`Edit ${t.description}`}>
                        <Pencil size={14} aria-hidden="true" /> Edit
                      </button>
                      <button type="button" className="link-btn link-btn--danger" onClick={() => setDeleting(t)} aria-label={`Delete ${t.description}`}>
                        <Trash2 size={14} aria-hidden="true" /> Delete
                      </button>
                    </div>
                  </div>
                  <span className={`txn__amount txn__amount--${t.type}`}>
                    <span className="sr-only">{t.type === "income" ? "Income " : "Expense "}</span>
                    {t.type === "income" ? "+" : "−"}
                    {formatINR(t.amount_paise)}
                  </span>
                </li>
              ))}
            </ul>

            <nav className="pager" aria-label="Pagination">
              <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 0 }} disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Previous
              </button>
              <span>
                Page {page + 1} of {pageCount} · {total} total
              </span>
              <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 0 }} disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </nav>
          </>
        )}
      </section>

      {creating && (
        <TransactionForm
          accounts={accounts}
          categories={categories}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            setListKey((k) => k + 1);
          }}
        />
      )}

      {editing && (
        <TransactionForm
          initial={editing}
          accounts={accounts}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setListKey((k) => k + 1);
          }}
        />
      )}

      {deleting && (
        <Modal
          title="Delete this transaction?"
          onClose={() => setDeleting(null)}
          busy={deleteBusy}
          footer={
            <>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDeleting(null)} disabled={deleteBusy}>
                Keep it
              </button>
              <button type="button" className="btn btn--danger btn--sm" onClick={confirmDelete} disabled={deleteBusy}>
                {deleteBusy ? "Deleting..." : "Delete"}
              </button>
            </>
          }
        >
          <p style={{ margin: 0, fontSize: "var(--text-sm)" }} data-autofocus tabIndex={-1}>
            “{deleting.description}” for {formatINR(deleting.amount_paise)} on {fullDate(deleting.occurred_on)} will be removed from your
            records and from your totals. This cannot be undone.
          </p>
        </Modal>
      )}
    </main>
  );
}