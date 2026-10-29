import { db } from "../lib/db";
import { DataError, fail, withTimeout } from "../lib/net";
import type { AdminMetrics, ChatMessage, Referral, SubscriptionRow } from "../types/platform";

const FRIENDLY: Record<string, string> = {
  not_configured: "This feature is not set up yet. The site owner needs to add the provider credentials.",
  rate_limited: "You have reached today's usage limit for this feature. Please try again tomorrow.",
  unauthorized: "Your session may have expired. Please sign in again.",
  provider_error: "The service provider could not be reached. Please try again in a moment.",
};

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await withTimeout(db().functions.invoke(name, { body }), 45000);
  if (error) {
    let code = "";
    try {
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx) {
        const j = await ctx.json();
        code = typeof j?.error === "string" ? j.error : "";
      }
    } catch {
      // ignore unreadable body
    }
    throw new DataError(FRIENDLY[code] ?? "We could not complete that request. The server function may not be deployed yet.", code);
  }
  return data as T;
}

export async function askAssistant(messages: ChatMessage[]): Promise<string> {
  const r = await invoke<{ reply: string }>("assistant", { messages });
  return r.reply;
}

export async function startCheckout(): Promise<string> {
  const r = await invoke<{ url: string }>("create-checkout", {});
  return r.url;
}

export async function getSubscription(): Promise<SubscriptionRow | null> {
  const { data, error } = await withTimeout(db().from("subscriptions").select("plan,status,current_period_end").maybeSingle());
  if (error) fail(error, "We could not load your subscription. Make sure migration 0004 has been run.");
  return (data as SubscriptionRow | null) ?? null;
}

export function premiumActive(s: SubscriptionRow | null): boolean {
  return Boolean(
    s && s.plan === "premium" && (s.status === "active" || s.status === "cancelled") &&
      s.current_period_end && Date.parse(s.current_period_end) > Date.now(),
  );
}

function referralError(message: string): never {
  if (message.startsWith("referral:")) throw new DataError(message.slice(9).trim());
  throw new DataError("We could not complete that. Make sure migration 0004 has been run.");
}

export async function getReferralCode(): Promise<string> {
  const { data, error } = await withTimeout(db().rpc("get_or_create_referral_code"));
  if (error) referralError(error.message ?? "");
  return String(data);
}

export async function claimReferral(code: string): Promise<void> {
  const { error } = await withTimeout(db().rpc("claim_referral", { p_code: code }));
  if (error) referralError(error.message ?? "");
}

export async function listReferrals(): Promise<Referral[]> {
  const { data, error } = await withTimeout(db().from("referrals").select("id,status,created_at").order("created_at", { ascending: false }));
  if (error) fail(error, "We could not load your referrals.");
  return (data ?? []) as Referral[];
}

export async function adminMetrics(): Promise<AdminMetrics> {
  const { data, error } = await withTimeout(db().rpc("admin_metrics"));
  if (error) {
    if ((error.message ?? "").includes("forbidden")) throw new DataError("You do not have access to this area.", "forbidden");
    fail(error, "We could not load metrics. Make sure migration 0004 has been run.");
  }
  return data as AdminMetrics;
}