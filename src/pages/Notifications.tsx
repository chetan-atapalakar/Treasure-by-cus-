import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import QuoteLoader from "../components/ui/QuoteLoader";
import { useToast } from "../components/ui/Toast";
import { errorMessage } from "../lib/net";
import { listNotifications, markAllRead, markRead } from "../services/notifications";
import type { AppNotification } from "../types/finance";
import "./Dashboard.css";
import "./auth.css";
import "./data.css";

export default function Notifications() {
  const { demo } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    setStatus("loading");
    listNotifications()
      .then((list) => {
        if (cancelled) return;
        setItems(list);
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(errorMessage(e, "We could not load your notifications."));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [demo, reloadKey]);

  async function open(n: AppNotification) {
    if (!n.read_at) {
      try {
        await markRead(n.id);
        setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      } catch (e) {
        notify("error", errorMessage(e, "We could not update this notification."));
      }
    }
    if (n.deep_link && n.deep_link.startsWith("/")) navigate(n.deep_link);
  }

  async function readAll() {
    try {
      await markAllRead();
      const now = new Date().toISOString();
      setItems((list) => list.map((x) => (x.read_at ? x : { ...x, read_at: now })));
    } catch (e) {
      notify("error", errorMessage(e, "We could not update your notifications."));
    }
  }

  if (demo) {
    return (
      <main className="dash">
        <section className="card dash__cta">
          <h1 className="card__title">Notifications</h1>
          <p>Notifications belong to a signed-in account. None are shown in demo mode.</p>
          <Link to="/login" className="btn btn--sm" style={{ display: "inline-flex" }}>Go to sign in</Link>
        </section>
      </main>
    );
  }

  const unread = items.filter((i) => !i.read_at).length;

  return (
    <main className="dash" aria-labelledby="notif-title">
      <header className="toolbar">
        <div>
          <p className="dash__eyebrow">Alerts</p>
          <h1 className="dash__title" id="notif-title">Notifications</h1>
        </div>
        {unread > 0 && (
          <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 0 }} onClick={readAll}>
            Mark all read ({unread})
          </button>
        )}
      </header>

      {status === "loading" ? (
        <QuoteLoader message="Gathering your financial picture..." />
      ) : status === "error" ? (
        <div className="dash__error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--sm" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      ) : items.length === 0 ? (
        <section className="card dash__cta">
          <p>
            No notifications yet. Reminders for bills, budgets and goals are created by server-side jobs, which are not set up in this
            version.
          </p>
        </section>
      ) : (
        <ul className="notifs">
          {items.map((n) => (
            <li key={n.id}>
              <button type="button" className={`notif${n.read_at ? "" : " notif--unread"}`} onClick={() => open(n)}>
                <span className="notif__dot" aria-hidden="true" />
                <span>
                  <p className="notif__title">
                    {!n.read_at && <span className="sr-only">Unread: </span>}
                    {n.title}
                  </p>
                  {n.body && <p className="notif__body">{n.body}</p>}
                  <p className="notif__time">{new Date(n.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}