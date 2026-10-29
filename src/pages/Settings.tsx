import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../components/ui/Toast";
import "../components/layout/layout.css";
import "./auth.css";

export default function Settings() {
  const { session, demo, signOut } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  async function onSignOut() {
    await signOut();
    notify("info", "You have been signed out.");
    navigate("/login", { replace: true });
  }

  return (
    <main className="ph" aria-labelledby="settings-title">
      <div className="ph__card">
        <h1 className="ph__title" id="settings-title">
          Settings
        </h1>
        <p className="ph__text" style={{ marginBottom: 16 }}>
          {demo
            ? "You are viewing sample data. No account is signed in."
            : `Signed in as ${session?.user.phone ? "+" + session.user.phone.replace(/^\+/, "") : "your account"}.`}
        </p>
        <button type="button" className="btn btn--ghost" onClick={onSignOut} style={{ marginTop: 0 }}>
          <LogOut size={18} aria-hidden="true" style={{ marginRight: 8 }} />
          {demo ? "Exit demo" : "Sign out"}
        </button>
        <p className="ph__text" style={{ marginTop: 16 }}>
          Profile setup, privacy controls, data export and account deletion are not implemented yet.
        </p>
      </div>
    </main>
  );
}