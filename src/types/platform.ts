export type EventKind = "bill" | "emi" | "card_payment" | "subscription" | "sip" | "fd_maturity" | "milestone" | "other";
export type Recurrence = "none" | "monthly" | "yearly";
export type EventStatus = "scheduled" | "completed" | "skipped";

export interface CalendarEvent {
  id: string;
  title: string;
  kind: EventKind;
  due_on: string;
  amount_paise: number | null;
  recurrence: Recurrence;
  status: EventStatus;
  notes: string | null;
}

export interface EventInput {
  title: string;
  kind: EventKind;
  due_on: string;
  amount_paise: number | null;
  recurrence: Recurrence;
  notes: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SubscriptionRow {
  plan: "free" | "premium";
  status: "inactive" | "active" | "past_due" | "cancelled" | "expired";
  current_period_end: string | null;
}

export interface Referral {
  id: string;
  status: "pending" | "approved" | "rejected" | "paid";
  created_at: string;
}

export interface AdminMetrics {
  registered_users: number;
  new_users_7d: number;
  active_users_30d: number;
  premium_active: number;
  ai_requests_today: number;
  ai_requests_7d: number;
  referrals_total: number;
  referrals_pending: number;
  generated_at: string;
}