import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { isSupabaseConfigured } from "../lib/supabase";
import { COUNTRIES, parsePhone } from "../lib/validation";
import { sendOtp } from "../services/auth";
import QuoteLoader from "../components/ui/QuoteLoader";
import "./auth.css";

export default function Login() {
  const navigate = useNavigate();
  const { session, demo, demoAllowed, startDemo } = useAuth();
  const [countryCode, setCountryCode] = useState("IN");
  const [raw, setRaw] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session || demo) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return; // prevents accidental double submission
    setError(null);

    const parsed = parsePhone(countryCode, raw);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (!consent) {
      setError("Please accept the privacy notice to continue.");
      return;
    }

    setBusy(true);
    const result = await sendOtp(parsed.e164);
    setBusy(false);

    if (result.ok) {
      navigate("/verify", { state: { phone: parsed.e164 } });
    } else {
      setError(result.message);
    }
  }

  return (
    <main className="auth">
      <div className="auth__card">
        <h1 className="auth__brand">CüS Treasure</h1>
        <p className="auth__descriptor">Treasure by CüS Studio</p>

        <h2 className="auth__h">Welcome</h2>
        <p className="auth__p">Sign in with your mobile number. We will text you a one-time code.</p>

        {!isSupabaseConfigured && (
          <p className="msg msg--info" role="note">
            Sign-in is not configured yet. The site owner needs to connect Supabase (see docs/SETUP-SUPABASE.md).
          </p>
        )}

        {error && (
          <p className="msg msg--error" role="alert" id="login-error">
            {error}
          </p>
        )}

        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="phone">
              Mobile number
            </label>
            <div className="field__row">
              <select
                className="input select"
                aria-label="Country code"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={busy}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} {c.dial}
                  </option>
                ))}
              </select>
              <input
                id="phone"
                className="input"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="98765 43210"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-error" : undefined}
                disabled={busy}
              />
            </div>
          </div>

          <label className="check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={busy} />
            <span>
              I agree that CüS Treasure may use my number to sign me in and send one-time codes. I understand app
              summaries are not official bank statements.
            </span>
          </label>

          {busy ? (
            <QuoteLoader size="sm" message="Requesting your code..." />
          ) : (
            <button className="btn" type="submit" disabled={!isSupabaseConfigured}>
              Send code
            </button>
          )}
        </form>

        {demoAllowed && (
          <button type="button" className="btn btn--ghost" onClick={startDemo}>
            Continue with demo data (no sign-in)
          </button>
        )}

        <p className="auth__fine">
          We never ask for bank passwords, UPI PINs or codes from other financial institutions. Standard SMS rates
          from your carrier may apply.
        </p>
      </div>
    </main>
  );
}