// Starts a Razorpay subscription for the CALLING user. Premium is NOT granted here;
// only the signature-verified webhook can do that.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method" });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("PAYMENT_PROVIDER_SECRET");
  const planId = Deno.env.get("RAZORPAY_PLAN_ID");
  if (!url || !anon) return json(500, { error: "server" });
  if (!keyId || !keySecret || !planId) return json(503, { error: "not_configured" });

  const userDb = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: u, error } = await userDb.auth.getUser();
  if (error || !u.user) return json(401, { error: "unauthorized" });

  try {
    const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Basic " + btoa(`${keyId}:${keySecret}`) },
      body: JSON.stringify({ plan_id: planId, total_count: 120, customer_notify: 1, notes: { user_id: u.user.id } }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return json(502, { error: "provider_error" });
    const sub = await res.json();
    if (!sub?.short_url) return json(502, { error: "provider_error" });
    return json(200, { url: sub.short_url });
  } catch {
    return json(502, { error: "provider_error" });
  }
});