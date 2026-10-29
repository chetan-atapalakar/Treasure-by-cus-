import { db } from "../lib/db";
import { fail, withTimeout } from "../lib/net";
import type { AppNotification } from "../types/finance";

export async function listNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await withTimeout(
    db().from("notifications").select("*").order("created_at", { ascending: false }).limit(limit),
  );
  if (error) fail(error, "We could not load your notifications.");
  return (data ?? []) as AppNotification[];
}

export async function markRead(id: string): Promise<void> {
  const { error } = await withTimeout(
    db().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id),
  );
  if (error) fail(error, "We could not update this notification.");
}

export async function markAllRead(): Promise<void> {
  const { error } = await withTimeout(
    db().from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null),
  );
  if (error) fail(error, "We could not update your notifications.");
}