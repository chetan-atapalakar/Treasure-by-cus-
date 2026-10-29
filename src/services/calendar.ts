import { db } from "../lib/db";
import { fail, withTimeout } from "../lib/net";
import type { CalendarEvent, EventInput, EventStatus } from "../types/platform";

export async function listEvents(start: string, end: string): Promise<CalendarEvent[]> {
  const { data, error } = await withTimeout(
    db().from("calendar_events").select("*").gte("due_on", start).lte("due_on", end).order("due_on").limit(500),
  );
  if (error) fail(error, "We could not load your calendar. Make sure migration 0004 has been run.");
  return ((data ?? []) as CalendarEvent[]).map((e) => ({ ...e, amount_paise: e.amount_paise === null ? null : Number(e.amount_paise) }));
}

export async function createEvent(input: EventInput): Promise<void> {
  const { error } = await withTimeout(db().from("calendar_events").insert(input));
  if (error) fail(error, "We could not save this event.");
}

export async function setEventStatus(id: string, status: EventStatus): Promise<void> {
  const { error } = await withTimeout(db().from("calendar_events").update({ status }).eq("id", id));
  if (error) fail(error, "We could not update this event.");
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await withTimeout(db().from("calendar_events").delete().eq("id", id));
  if (error) fail(error, "We could not delete this event.");
}