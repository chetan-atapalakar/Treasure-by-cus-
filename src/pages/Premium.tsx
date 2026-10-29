import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import QuoteLoader from "../components/ui/QuoteLoader";
import { useToast } from "../components/ui/Toast";
import { PLAN_CONFIG, FREE_FEATURES, PREMIUM_FEATURES } from "../config/plans";
import { formatINR } from "../lib/currency";
import { fullDate } from "../lib/dates";
import { errorMessage } from "../lib/net";
import { getSubscription, premiumActive, startCheckout } from "../services/platform";
import type { SubscriptionRow } from "../types/platform";
import "./Dashboard.css";
import "./auth.css";
import "./data.css";
import "./extra.css";

export default function Premium() {
  const { demo } = useAuth();
  const { notify } = useToast();
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    setStatus("loading");
    getSubscription()
      .then((s) => {
        if (cancelled) return;
        setSub(s);
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(errorMessage(e, "We could not load your subscription."));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [demo, reloadKey]);

  async function upgrade() {
    if (busy) return;
    setBusy(true);
    try {
      const url = await startCheckout();
      window.location.href = url;
    } catch (e) {
      notify("error", errorMessage(e, "We could not start checkout."));
      setBusy(false);
    }
  }

  if (demo) {
    return (
      <main className="dash">
        <section className="card dash__cta">
          <h1 className="card__title">Premium</h1>
          <p>Sign in to view plans.</p>
          <Link to="/login" className="btn btn--sm" style={{ display: "inline-flex" }}>Go to sign in</Link>
        </section>
      </main>
    );
  }

  const active = premiumActive(sub);

  return (
    <main className="dash" aria-labelledby="prem-title">
      <header>
        <p className="dash__eyebrow">Plans</p>
        <h1 className="dash__title" id="prem-title">Premium</h1>
      </header>

      {status === "loading" ? (
        <QuoteLoader message="Gathering your financial picture..." />
      ) : status === "error" ? (
        <div className="dash__error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--sm" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      ) : (
        <>
          <section className="card" aria-label="Your plan">
            <h2 className="card__title">Your plan</h2>
            <p style={{ margin: 0, fontSize: "var(--text-sm)" }}>
              {active
                ? `Premium (${sub?.status === "cancelled" ? "cancelled, active until" : "renews or ends"} ${sub?.current_period_end ? fullDate(sub.current_period_end.slice(0, 10)) : ""}).`
                : sub?.status === "past_due"
                  ? "Your last payment did not go through. Premium is paused until a payment succeeds."
                  : "Free plan."}
            </p>
          </section>

          <div className="cmp">
            <article className="card">
              <h2 className="card__title" style={{ marginBottom: 0 }}>Free</h2>
              <p className="price">{formatINR(0)}</p>
              <ul>{FREE_FEATURES.map((f) => <li key={f}>{f}</li>)}</ul>
            </article>
            <article className="card">
              <h2 className="card__title" style={{ marginBottom: 0 }}>Premium</h2>
              <p className="price">{formatINR(PLAN_CONFIG.premiumMonthlyPaise)}<span className="plan__of"> / month</span></p>
              <ul>{PREMIUM_FEATURES.map((f) => <li key={f}>{f}</li>)}</ul>
              {!active && (
                <button type="button" className="btn btn--sm" style={{ marginTop: 16 }} onClick={upgrade} disabled={busy}>
                  {busy ? "Opening checkout..." : "Upgrade"}
                </button>
              )}
            </article>
          </div>

          <p className="list-foot">
            Premium access is switched on only after your payment is confirmed by the payment provider, never by this screen. Essential tracking stays free.
            Prices shown are proposed and must match the plan configured at the payment provider. In-app cancellation, refunds and billing history are not built yet.
          </p>
        </>
      )}
    </main>
  );
}