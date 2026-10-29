import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import QuoteLoader from "../components/ui/QuoteLoader";
import { useToast } from "../components/ui/Toast";
import { formatINR } from "../lib/currency";
import { fullDate, isValidISODate, toISO, todayISO } from "../lib/dates";
import { errorMessage } from "../lib/net";
import { fetchStatementData, type StatementData } from "../services/statements";
import { generateStatementPdf } from "../services/statementPdf";
import "./Dashboard.css";
import "./auth.css";
import "./data.css";
import "./extra.css";

const PAGE_SIZE = 25;

export default function Statements() {
  const { demo } = useAuth();
  const { notify } = useToast();
  const now = new Date();
  const [from, setFrom] = useState(toISO(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(todayISO());
  const [accountId, setAccountId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatementData | null>(null);
  const [shown, setShown] = useState({ from: "", to: "", accountId: "" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [accountsForPicker, setAccountsForPicker] = useState<StatementData["accounts"]>([]);

  const rangeError = !isValidISODate(from) || !isValidISODate(to) ? "Choose valid dates." : from > to ? "“From” must be on or before “To”." : null;

  function preset(kind: "this" | "last") {
    const y = now.getFullYear();
    const m = now.getMonth();
    if (kind === "this") {
      setFrom(toISO(new Date(y, m, 1)));
      setTo(todayISO());
    } else {
      setFrom(toISO(new Date(y, m - 1, 1)));
      setTo(toISO(new Date(y, m, 0)));
    }
  }

  async function view() {
    if (rangeError || status === "loading") return;
    setStatus("loading");
    setError(null);
    try {
      const d = await fetchStatementData(from, to, accountId);
      setData(d);
      setAccountsForPicker(d.accounts);
      setShown({ from, to, accountId });
      setPage(0);
      setSearch("");
      setStatus("ready");
    } catch (e) {
      setError(errorMessage(e, "We could not prepare your statement."));
      setStatus("error");
    }
  }

  const accountName = useMemo(() => new Map((data?.accounts ?? []).map((a) => [a.id, a.name])), [data]);
  const categoryName = useMemo(() => new Map((data?.categories ?? []).map((c) => [c.id, c.name])), [data]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    const cats = new Map<string, number>();
    for (const t of data?.rows ?? []) {
      if (t.type === "income") income += t.amount_paise;
      else {
        expense += t.amount_paise;
        const n = t.category_id ? (categoryName.get(t.category_id) ?? "Uncategorised") : "Uncategorised";
        cats.set(n, (cats.get(n) ?? 0) + t.amount_paise);
      }
    }
    return { income, expense, cats: Array.from(cats.entries()).sort((a, b) => b[1] - a[1]) };
  }, [data, categoryName]);

  const needle = search.trim().toLowerCase();
  const filtered = useMemo(
    () => (data?.rows ?? []).filter((t) => !needle || t.description.toLowerCase().includes(needle) || (t.merchant ?? "").toLowerCase().includes(needle)),
    [data, needle],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const accountLabel = shown.accountId ? (accountName.get(shown.accountId) ?? "Selected account") : "All accounts";

  async function makePdf() {
    if (!data || pdfBusy) return;
    setPdfBusy(true);
    try {
      await generateStatementPdf({
        rows: data.rows,
        accountName: (id) => accountName.get(id) ?? "Account",
        categoryName: (id) => (id ? (categoryName.get(id) ?? "Uncategorised") : "Uncategorised"),
        from: shown.from, to: shown.to, accountLabel, income: totals.income, expense: totals.expense,
      });
      notify("success", "Statement PDF generated.");
    } catch {
      notify("error", "We could not generate the PDF. Please try again.");
    } finally {
      setPdfBusy(false);
    }
  }

  if (demo) {
    return (
      <main className="dash">
        <section className="card dash__cta">
          <h1 className="card__title">Statements</h1>
          <p>You are viewing demo data. Sign in to create statements from your recorded transactions.</p>
          <Link to="/login" className="btn btn--sm" style={{ display: "inline-flex" }}>Go to sign in</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="dash" aria-labelledby="stmt-title">
      <header className="no-print">
        <p className="dash__eyebrow">Reports</p>
        <h1 className="dash__title" id="stmt-title">Statements</h1>
      </header>

      <section className="card no-print" aria-label="Statement options">
        <div className="row-inline">
          <div className="field">
            <label className="field__label" htmlFor="s-from">From</label>
            <input id="s-from" className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="s-to">To</label>
            <input id="s-to" className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="s-acct">Account</label>
            <select id="s-acct" className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">All accounts</option>
              {accountsForPicker.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="chips-row" style={{ marginBottom: 12 }}>
          <button type="button" className="chip-btn" onClick={() => preset("this")}>This month</button>
          <button type="button" className="chip-btn" onClick={() => preset("last")}>Last month</button>
        </div>
        {rangeError && <p className="field__error" role="alert">{rangeError}</p>}
        <div className="set-actions">
          <button type="button" className="btn btn--sm" onClick={view} disabled={Boolean(rangeError) || status === "loading"}>View statement</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={makePdf} disabled={status !== "ready" || pdfBusy || (data?.rows.length ?? 0) === 0}>
            <Download size={16} aria-hidden="true" style={{ marginRight: 6 }} />{pdfBusy ? "Generating..." : "Generate PDF"}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => window.print()} disabled={status !== "ready"}>
            <Printer size={16} aria-hidden="true" style={{ marginRight: 6 }} />Print
          </button>
        </div>
      </section>

      {status === "loading" && <QuoteLoader message="Preparing your statement..." />}
      {status === "error" && (
        <div className="dash__error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--sm" onClick={view}>Try again</button>
        </div>
      )}

      {status === "ready" && data && (
        <section className="card" aria-label="Statement">
          <h2 className="card__title">Statement of recorded transactions</h2>
          <p className="acct__note" style={{ marginTop: 0 }}>
            {fullDate(shown.from)} to {fullDate(shown.to)} · {accountLabel} · generated {new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
          <div className="stats" style={{ marginBottom: 16 }}>
            <div><p className="delta">Total income</p><p className="stat__value stat__value--income" style={{ margin: 0 }}>{formatINR(totals.income)}</p></div>
            <div><p className="delta">Total expenses</p><p className="stat__value stat__value--expense" style={{ margin: 0 }}>{formatINR(totals.expense)}</p></div>
            <div><p className="delta">Net</p><p className="stat__value" style={{ margin: 0 }}>{totals.income < totals.expense ? "−" : ""}{formatINR(Math.abs(totals.income - totals.expense))}</p></div>
          </div>
          <p className="acct__note">Opening and closing balances are not shown because they cannot be reliably verified from recorded entries. This is not an official bank statement.</p>
          {data.truncated && <p className="msg msg--error" role="alert">This period has more than 5,000 transactions. Only the first 5,000 are included. Choose a shorter period.</p>}

          {totals.cats.length > 0 && (
            <>
              <h3 className="card__title" style={{ fontSize: "var(--text-base)" }}>Spending by category</h3>
              <ul className="chips">
                {totals.cats.map(([n, p]) => <li className="chip" key={n}>{n}: {formatINR(p)}</li>)}
              </ul>
            </>
          )}

          <div className="search no-print">
            <input type="search" placeholder="Filter by description or merchant" aria-label="Filter statement rows" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} style={{ paddingLeft: "var(--space-4)" }} />
          </div>

          {filtered.length === 0 ? (
            <p className="empty">No transactions match.</p>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Account</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {visible.map((t) => (
                    <tr key={t.id}>
                      <td>{t.occurred_on}</td>
                      <td>{t.description}{t.merchant ? ` (${t.merchant})` : ""}</td>
                      <td>{t.category_id ? (categoryName.get(t.category_id) ?? "Uncategorised") : "Uncategorised"}</td>
                      <td>{accountName.get(t.account_id) ?? "Account"}</td>
                      <td className="num">{t.type === "income" ? "+" : "−"}{formatINR(t.amount_paise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <nav className="pager no-print" aria-label="Statement pages">
            <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 0 }} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span>Page {page + 1} of {pageCount} · {filtered.length} rows</span>
            <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 0 }} disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</button>
          </nav>
          <p className="list-foot">Generated by CüS Treasure from transactions you recorded. Printing shows the current page of rows; use Generate PDF for the complete statement.</p>
        </section>
      )}
    </main>
  );
}