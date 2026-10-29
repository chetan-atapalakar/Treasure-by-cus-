// Razorpay webhook. Verifies the signature, processes each event exactly once,
// and is the ONLY place that grants or removes premium access.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });

  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secret = Deno.env.get("PAYMENT_WEBHOOK_SECRET");
  if (!url || !service || !secret) return new Response("not configured", { status: 503 });

  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const expected = await hmacSha256Hex(secret, raw);
  if (!signature || !safeEqual(signature, expected)) return new Response("bad signature", { status: 401 });

  const eventId = req.headers.get("x-razorpay-event-id");
  if (!eventId) return new Response("missing event id", { status: 400 });

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const admin = createClient(url, service);

  // Idempotency: a duplicate delivery hits the unique constraint and is acknowledged.
  const { error: insertError } = await admin.from("payment_events").insert({
    provider: "razorpay", provider_event_id: eventId, event_type: event?.event ?? null, payload: event,
  });
  if (insertError) {
    if (insertError.code === "23505") return new Response(JSON.stringify({ duplicate: true }), { status: 200 });
    return new Response("error", { status: 500 });
  }

  try {
    const entity = event?.payload?.subscription?.entity;
    const userId = entity?.notes?.user_id;
    if (entity && typeof userId === "string" && UUID.test(userId)) {
      const periodEnd = typeof entity.current_end === "number" ? new Date(entity.current_end * 1000).toISOString() : null;
      let row: { plan: string; status: string; current_period_end?: string | null } | null = null;

      switch (event.event) {
        case "subscription.activated":
        case "subscription.charged":
          row = { plan: "premium", status: "active", current_period_end: periodEnd };
          break;
        case "subscription.cancelled":
          row = { plan: "premium", status: "cancelled", current_period_end: periodEnd }; // access until period end
          break;
        case "subscription.halted":
        case "subscription.pending":
          row = { plan: "premium", status: "past_due", current_period_end: periodEnd };
          break;
        case "subscription.completed":
        case "subscription.expired":
          row = { plan: "free", status: "expired" };
          break;
      }

      if (row) {
        const { error } = await admin.from("subscriptions").upsert({
          user_id: userId, provider: "razorpay", provider_subscription_id: entity.id ?? null,
          updated_at: new Date().toISOString(), ...row,
        });
        if (error) throw error;
      }
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch {
    // Remove the idempotency record so the provider's retry can process this event.
    await admin.from("payment_events").delete().eq("provider", "razorpay").eq("provider_event_id", eventId);
    return new Response("error", { status: 500 });
  }
});