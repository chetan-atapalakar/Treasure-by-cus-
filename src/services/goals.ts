import { db } from "../lib/db";
import { fail, withTimeout } from "../lib/net";
import type { Contribution, Goal, GoalProgress } from "../types/planning";

export async function listGoals(): Promise<Goal[]> {
  const { data, error } = await withTimeout(db().from("financial_goals").select("*").order("created_at", { ascending: true }));
  if (error) fail(error, "We could not load your goals.");
  return ((data ?? []) as Goal[]).map((g) => ({ ...g, target_paise: Number(g.target_paise) }));
}

export async function goalProgress(): Promise<GoalProgress[]> {
  const { data, error } = await withTimeout(db().rpc("goal_progress"));
  if (error) fail(error, "We could not calculate goal progress. Make sure migration 0003 has been run.");
  return ((data ?? []) as GoalProgress[]).map((p) => ({ ...p, saved_paise: Number(p.saved_paise) }));
}

export async function createGoal(input: { name: string; target_paise: number; target_date: string | null }): Promise<void> {
  const { error } = await withTimeout(db().from("financial_goals").insert(input));
  if (error) fail(error, "We could not save this goal.");
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await withTimeout(db().from("financial_goals").delete().eq("id", id));
  if (error) fail(error, "We could not delete this goal.");
}

export async function addContribution(input: {
  goal_id: string;
  amount_paise: number;
  contributed_on: string;
  note: string | null;
}): Promise<void> {
  const { error } = await withTimeout(db().from("goal_contributions").insert(input));
  if (error) fail(error, "We could not save this contribution.");
}

export async function listContributions(goalId: string): Promise<Contribution[]> {
  const { data, error } = await withTimeout(
    db()
      .from("goal_contributions")
      .select("id,goal_id,amount_paise,contributed_on,note")
      .eq("goal_id", goalId)
      .order("contributed_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
  );
  if (error) fail(error, "We could not load this goal's contributions.");
  return ((data ?? []) as Contribution[]).map((c) => ({ ...c, amount_paise: Number(c.amount_paise) }));
}

export async function deleteContribution(id: string): Promise<void> {
  const { error } = await withTimeout(db().from("goal_contributions").delete().eq("id", id));
  if (error) fail(error, "We could not delete this contribution.");
}