import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { signOutUser } from "../services/auth";

interface AuthState {
  session: Session | null;
  loading: boolean;
  /** True only for the clearly labelled sample-data preview. Never real access. */
  demo: boolean;
  demoAllowed: boolean;
  startDemo: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const DEMO_KEY = "cus_demo_preview";
const SESSION_TIMEOUT_MS = 8000;

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const demoAllowed = import.meta.env.VITE_DEMO_PREVIEW === "true";
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [demo, setDemo] = useState(() => {
    try {
      return demoAllowed && sessionStorage.getItem(DEMO_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), SESSION_TIMEOUT_MS));
    Promise.race([supabase.auth.getSession().then((r) => r.data.session), timeout])
      .catch(() => null)
      .then((s) => {
        if (!active) return;
        setSession(s);
        setLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const startDemo = useCallback(() => {
    if (!demoAllowed) return;
    try {
      sessionStorage.setItem(DEMO_KEY, "1");
    } catch {
      // Non-sensitive flag only; ignore storage failures.
    }
    setDemo(true);
  }, [demoAllowed]);

  const signOut = useCallback(async () => {
    try {
      sessionStorage.removeItem(DEMO_KEY);
    } catch {
      // ignore
    }
    setDemo(false);
    await signOutUser();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, loading, demo, demoAllowed, startDemo, signOut }),
    [session, loading, demo, demoAllowed, startDemo, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}