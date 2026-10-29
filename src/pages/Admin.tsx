import { useEffect, useState } from "react";
import QuoteLoader from "../components/ui/QuoteLoader";
import { useAuth } from "../contexts/AuthContext";
import { errorMessage } from "../lib/net";
import { adminMetrics } from "../services/platform";
import type { AdminMetrics } from "../types/platform";
import "./Dashboard.css";
import "./auth.css";
import "./data.css";

export default function Admin() {
  const { demo } = useAuth();
  const [m, setM] = useState<AdminMetrics | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    setStatus("loading");
    adminMetrics()
      .then((d) => {
        if (cancelled) return;
        setM(d);
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(errorMessage(e, "We could not load metrics."));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [demo, reloadKey]);

  if (demo) {
    return <main className="dash"><section className="card dash__cta"><p>Admin metrics are not available in demo mode.</p></section></main>;
  }

  const rows: [string, number | undefined][] = [
    ["Registered users", m?.registered_users],
    ["New users (7 days)", m?.new_users_7d],
    ["Users who recorded something (30 days)", m?.active_users_30d],
    ["Active premium subscribers", m?.premium_active],
    ["AI requests today", m?.ai_requests_today],
    ["AI requests (7 days)", m?.ai_requests_7d],
    ["Referrals (total)", m?.referrals_total],
    ["Referrals pending review", m?.referrals_pending],
  ];

  return (
    <main className="dash" aria-labelledby="admin-title">
      <header>
        <p className="dash__eyebrow">Owner</p>
        <h1 className="dash__title" id="admin-title">Business metrics</h1>
      </header>

      <div className="notice" role="note">
        <p style={{ margin: 0 }}>
          Aggregate counts only. No one’s transactions are shown here. Revenue, refunds, referral payouts, AI cost and infrastructure expenses are not shown because payment reconciliation and cost tracking are not built yet. Nothing here is a forecast.
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
          <div className="stats">
            {rows.map(([label, value]) => (
              <article className="card stat" key={label}>
                <p className="stat__label">{label}</p>
                <p className="stat__value">{value ?? "—"}</p>
              </article>
            ))}
          </div>
          <p className="list-foot">Generated {m ? new Date(m.generated_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""}. Each view is recorded in the audit log.</p>
        </>
      )}
    </main>
  );
}