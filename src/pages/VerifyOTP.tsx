import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { isValidOtp, maskPhone } from "../lib/validation";
import { sendOtp, verifyOtp } from "../services/auth";
import QuoteLoader from "../components/ui/QuoteLoader";
import "./auth.css";

const COOLDOWN_SECONDS = 60;

export default function VerifyOTP() {
  const location = useLocation();
  const navigate = useNavigate();
  const phone = (location.state as { phone?: string } | null)?.phone;

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(COOLDOWN_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [secondsLeft]);

  if (!phone) return <Navigate to="/login" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || !phone) return;
    setError(null);
    setInfo(null);

    if (!isValidOtp(code)) {
      setError("Enter the 6-digit code from your SMS.");
      return;
    }

    setBusy(true);
    const result = await verifyOtp(phone, code);
    setBusy(false);

    if (result.ok) {
      navigate("/", { replace: true });
    } else {
      setError(result.message);
      setCode("");
    }
  }

  async function onResend() {
    if (secondsLeft > 0 || resending || !phone) return;
    setError(null);
    setInfo(null);
    setResending(true);
    const result = await sendOtp(phone);
    setResending(false);

    if (result.ok) {
      setSecondsLeft(COOLDOWN_SECONDS);
      setInfo("A new code was requested. Only the newest code will work.");
    } else {
      setError(result.message);
    }
  }

  return (
    <main className="auth">
      <div className="auth__card">
        <h1 className="auth__brand">CüS Treasure</h1>
        <p className="auth__descriptor">Treasure by CüS Studio</p>

        <h2 className="auth__h">Enter your code</h2>
        <p className="auth__p">
          We asked our SMS provider to send a 6-digit code to {maskPhone(phone)}. Delivery can take a minute.
        </p>

        {error && (
          <p className="msg msg--error" role="alert" id="otp-error">
            {error}
          </p>
        )}
        {info && (
          <p className="msg msg--info" role="status">
            {info}
          </p>
        )}

        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="otp">
              6-digit code
            </label>
            <input
              id="otp"
              className="input input--otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "otp-error" : undefined}
              disabled={busy}
              autoFocus
            />
          </div>

          {busy ? (
            <QuoteLoader size="sm" message="Verifying your code..." />
          ) : (
            <button className="btn" type="submit" disabled={code.length !== 6}>
              Verify and continue
            </button>
          )}
        </form>

        <button type="button" className="btn btn--ghost" onClick={onResend} disabled={secondsLeft > 0 || resending}>
          {resending ? "Requesting..." : secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
        </button>

        <p className="auth__fine">
          Wrong number? <Link to="/login">Use a different number</Link>
        </p>
      </div>
    </main>
  );
}