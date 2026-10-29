import { isSupabaseConfigured, supabase } from "../lib/supabase";

export type AuthErrorKind =
  | "not_configured"
  | "rate_limited"
  | "invalid_code"
  | "provider_unavailable"
  | "network"
  | "unknown";

export type AuthResult = { ok: true } | { ok: false; kind: AuthErrorKind; message: string };

const TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
    promise.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(timer);
        reject(e);
      },
    );
  });
}

interface ProviderError {
  code?: string;
  status?: number;
  message?: string;
}

function mapError(err: ProviderError, context: "send" | "verify"): AuthResult {
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();

  if (code.includes("rate_limit") || err.status === 429) {
    return {
      ok: false,
      kind: "rate_limited",
      message: "Too many attempts. Please wait a few minutes before trying again.",
    };
  }
  if (context === "verify" && (code === "otp_expired" || msg.includes("expired") || msg.includes("invalid"))) {
    return {
      ok: false,
      kind: "invalid_code",
      message: "That code is incorrect or has expired. Check the digits, or request a new code.",
    };
  }
  if (
    code === "sms_send_failed" ||
    code === "phone_provider_disabled" ||
    msg.includes("provider") ||
    msg.includes("sms")
  ) {
    return {
      ok: false,
      kind: "provider_unavailable",
      message: "We could not send an SMS right now. SMS delivery may not be set up yet. Please try again later.",
    };
  }
  if (code === "validation_failed") {
    return { ok: false, kind: "unknown", message: "That phone number was not accepted. Check it and try again." };
  }
  return { ok: false, kind: "unknown", message: "Something went wrong. Please try again." };
}

const notConfigured: AuthResult = {
  ok: false,
  kind: "not_configured",
  message: "Sign-in is not configured yet. The site owner needs to connect Supabase.",
};

const networkError: AuthResult = {
  ok: false,
  kind: "network",
  message: "We could not reach the server. Check your connection and try again.",
};

/** Asks Supabase to send an SMS code. Success means the provider accepted the request. */
export async function sendOtp(phoneE164: string): Promise<AuthResult> {
  if (!isSupabaseConfigured || !supabase) return notConfigured;
  try {
    const { error } = await withTimeout(supabase.auth.signInWithOtp({ phone: phoneE164 }));
    if (error) return mapError(error, "send");
    return { ok: true };
  } catch {
    return networkError;
  }
}

/** Verification happens on Supabase's servers; the client never decides a code is correct. */
export async function verifyOtp(phoneE164: string, token: string): Promise<AuthResult> {
  if (!isSupabaseConfigured || !supabase) return notConfigured;
  try {
    const { error } = await withTimeout(supabase.auth.verifyOtp({ phone: phoneE164, token, type: "sms" }));
    if (error) return mapError(error, "verify");
    return { ok: true };
  } catch {
    return networkError;
  }
}

export async function signOutUser(): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch {
    // Local session is cleared by the SDK even if the network call fails.
  }
}