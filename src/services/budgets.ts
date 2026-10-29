import { db } from "../lib/db";
import { DataError, fail, withTimeout } from "../lib/net";
import type { Budget, BudgetProgress } from "../types/planning";

export async function listBudgets(): Promise<Budget[]> {
  const { data, error } = await withTimeout(db().from("budgets").select("*").order("created_at", { ascending: true }));
  if (error) fail(error, "We could not load your budgets.");
  return ((data ?? []) as Budget[]).map((b) => ({ ...b, amount_paise: Number(b.amount_paise) }));
}

export async function budgetProgress(): Promise<BudgetProgress[]> {
  const { data, error } = await withTimeout(db().rpc("budget_progress"));
  if (error) fail(error, "We could not calculate budget progress. Make sure migration 0003 has been run.");
  return ((data ?? []) as BudgetProgress[]).map((p) => ({ ...p, spent_paise: Number(p.spent_paise) }));
}

export async function createBudget(input: {
  category_id: string | null;
  period: "monthly" | "custom";
  starts_on: string;
  ends_on: string | null;
  amount_paise: number;
  alert_threshold_pct: number;
}): Promise<void> {
  const { error } = await withTimeout(db().from("budgets").insert(input));
  if (error) {
    if (error.code === "23505") {
      throw new DataError("You already have a monthly budget for this category.", "23505");
    }
    fail(error, "We could not save this budget.");
  }
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await withTimeout(db().from("budgets").delete().eq("id", id));
  if (error) fail(error, "We could not delete this budget.");
}

/** Server-side: creates (deduplicated) alert notifications. Returns how many were newly created. */
export async function syncBudgetAlerts(): Promise<number> {
  const { data, error } = await withTimeout(db().rpc("sync_budget_alerts"));
  if (error) fail(error, "We could not check budget alerts.");
  return Number(data ?? 0);
}