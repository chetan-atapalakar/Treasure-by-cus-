import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, LogOut, Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import { errorMessage } from "../lib/net";
import { deleteMyAccount, exportAllJson, exportTransactionsCsv } from "../services/dataExport";
import "../components/layout/layout.css";
import "./Dashboard.css";
import "./auth.css";
import "./data.css";
import "./planning.css";

export default function Settings() {
  const { session, demo, signOut } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState<"json" | "csv" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onSignOut() {
    await signOut();
    notify("info", "You have been signed out.");
    navigate("/login", { replace: true });
  }

  async function runExport(kind: "json" | "csv") {
    if (exporting) return;
    setExporting(kind);
    try {
      const count = kind === "json" ? await exportAllJson() : await exportTransactionsCsv();
      notify("success", `Export ready (${count} records).`);
    } catch (e) {
      notify("error", errorMessage(e, "We could not prepare your export."));
    } finally {
      setExporting(null);
    }
  }

  async function onDelete() {
    if (deleteBusy || typed !== "DELETE") return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteMyAccount();
      await signOut();
      notify("info", "Your account and data have been deleted.");
      navigate("/login", { replace: true });
    } catch (e) {
      setDeleteError(errorMessage(e, "We could not delete your account."));
    } finally {
      setDeleteBusy(false);
    }
  }

  const phone = session?.user.phone ? `+${session.user.phone.replace(/^\+/, "")}` : null;

  return (
    <main className="dash" aria-labelledby="settings-title" style={{ maxWidth: 720 }}>
      <header>
        <p className="dash__eyebrow">Account</p>
        <h1 className="dash__title" id="settings-title">Settings</h1>
      </header>

      <section className="card set-section" aria-labelledby="set-account">
        <h2 className="card__title" id="set-account" style={{ marginBottom: 0 }}>Your account</h2>
        <p>{demo ? "You are viewing sample data. No account is signed in." : `Signed in with ${phone ?? "your mobile number"}.`}</p>
        <div className="set-actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onSignOut}>
            <LogOut size={18} aria-hidden="true" style={{ marginRight: 8 }} />
            {demo ? "Exit demo" : "Sign out"}
          </button>
        </div>
      </section>

      {!demo && (
        <>
          <section className="card set-section" aria-labelledby="set-export">
            <h2 className="card__title" id="set-export" style={{ marginBottom: 0 }}>Export your data</h2>
            <p>Download everything you have recorded. The full export is JSON; the transactions file opens in Excel or Google Sheets.</p>
            <div className="set-actions">
              <button type="button" className="btn btn--sm" onClick={() => runExport("json")} disabled={exporting !== null}>
                <Download size={18} aria-hidden="true" style={{ marginRight: 8 }} />
                {exporting === "json" ? "Preparing..." : "Export all data (JSON)"}
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => runExport("csv")} disabled={exporting !== null}>
                {exporting === "csv" ? "Preparing..." : "Transactions (CSV)"}
              </button>
            </div>
          </section>

          <section className="card set-section danger-zone" aria-labelledby="set-delete">
            <h2 className="card__title" id="set-delete" style={{ marginBottom: 0 }}>Delete account</h2>
            <p>
              This permanently removes your sign-in and every account, transaction, budget, goal and notification you have recorded.
              Export your data first if you want a copy.
            </p>
            <div className="set-actions">
              <button type="button" className="btn btn--danger btn--sm" onClick={() => { setTyped(""); setDeleteError(null); setConfirming(true); }}>
                <Trash2 size={18} aria-hidden="true" style={{ marginRight: 8 }} />
                Delete my account
              </button>
            </div>
          </section>
        </>
      )}

      <p className="list-foot">Profile setup, privacy preferences and notification preferences are not implemented yet.</p>

      {confirming && (
        <Modal
          title="Delete your account?"
          onClose={() => setConfirming(false)}
          busy={deleteBusy}
          footer={
            <>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(false)} disabled={deleteBusy}>Keep my account</button>
              <button type="button" className="btn btn--danger btn--sm" onClick={onDelete} disabled={deleteBusy || typed !== "DELETE"}>
                {deleteBusy ? "Deleting..." : "Delete permanently"}
              </button>
            </>
          }
        >
          {deleteError && <p className="msg msg--error" role="alert">{deleteError}</p>}
          <p style={{ margin: "0 0 12px", fontSize: "var(--text-sm)" }}>This cannot be undone. Type <strong>DELETE</strong> to confirm.</p>
          <div className="field">
            <label className="field__label" htmlFor="del-confirm">Confirmation</label>
            <input id="del-confirm" className="input" type="text" autoComplete="off" autoCapitalize="characters" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={deleteBusy} data-autofocus />
          </div>
        </Modal>
      )}
    </main>
  );
}