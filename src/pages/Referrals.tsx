import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Copy } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import QuoteLoader from "../components/ui/QuoteLoader";
import { useToast } from "../components/ui/Toast";
import { fullDate } from "../lib/dates";
import { errorMessage } from "../lib/net";
import { claimReferral, getReferralCode, listReferrals } from "../services/platform";
import type { Referral } from "../types/platform";
import "./Dashboard.css";
import "./auth.css";
import "./data.css";
import "./planning.css";

export default function Referrals() {
  const { demo } = useAuth();
  const { notify } = useToast();
  const [code, setCode] = useState("");
  const [items, setItems] = useState<Referral[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    setStatus("loading");
    Promise.all([getReferralCode(), listReferrals()])
      .then(([c, r]) => {
        if (cancelled) return;
        setCode(c);
        setItems(r);
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(errorMessage(e, "We could not load referrals."));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [demo, reloadKey]);

  async function onClaim(e: FormEvent) {
    e.preventDefault();
    if (busy || entry.trim() === "") return;
    setBusy(true);
    try {
      await claimReferral(entry);
      notify("success", "Referral code applied.");
      setEntry("");
    } catch (err) {
      notify("error", errorMessage(err, "We could not apply that code."));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      notify("info", "Code copied.");
    } catch {
      notify("warning", "Copy is not available here. Select the code and copy it manually.");
    }
  }

  if (demo) {
    return (
      <main className="dash">
        <section className="card dash__cta">
          <h1 className="card__title">Referrals</h1>
          <p>Sign in to get your referral code.</p>
          <Link to="/login" className="btn btn--sm" style={{ display: "inline-flex" }}>Go to sign in</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="dash" aria-labelledby="ref-title" style={{ maxWidth: 720 }}>
      <header>
        <p className="dash__eyebrow">Invite</p>
        <h1 className="dash__title" id="ref-title">Referrals</h1>
      </header>

      <div className="notice" role="note">
        <p style={{ margin: 0 }}>
          Referral tracking is recorded here. Reward terms are not finalised and no rewards are paid automatically; any reward needs review and approval first.
        </p>
      </div>

      {status === "loading" ? (
        <QuoteLoader message="Gathering your financial picture..." />
      ) : status === "error" ? (
        <div className="dash__error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--sm" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      ) : (
        <>
          <section className="card set-section">
            <h2 className="card__title" style={{ marginBottom: 0 }}>Your code</h2>
            <p className="acct__bal" style={{ letterSpacing: "0.12em" }}>{code}</p>
            <div className="set-actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={copy}><Copy size={16} aria-hidden="true" style={{ marginRight: 6 }} />Copy code</button>
            </div>
          </section>

          <section className="card set-section">
            <h2 className="card__title" style={{ marginBottom: 0 }}>Have a code?</h2>
            <form className="inline-form" onSubmit={onClaim} noValidate>
              <div className="field" style={{ flex: "1 1 160px", marginBottom: 0 }}>
                <label className="field__label" htmlFor="ref-in">Friend’s referral code</label>
                <input id="ref-in" className="input" type="text" maxLength={16} autoCapitalize="characters" value={entry} onChange={(e) => setEntry(e.target.value)} disabled={busy} />
              </div>
              <button type="submit" className="btn btn--sm" disabled={busy || entry.trim() === ""}>{busy ? "Applying..." : "Apply"}</button>
            </form>
            <p>You can apply one code, once, and not your own.</p>
          </section>

          <section className="card" aria-label="Your referrals">
            <h2 className="card__title">People you referred</h2>
            {items.length === 0 ? (
              <p className="empty">No referrals yet.</p>
            ) : (
              <ul className="hist">
                {items.map((r) => (
                  <li className="hist__row" key={r.id}>
                    <p>Referral on {fullDate(r.created_at.slice(0, 10))}</p>
                    <span className="tag">{r.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}