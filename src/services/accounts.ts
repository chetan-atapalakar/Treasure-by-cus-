import { db } from "../lib/db";
import { fail, withTimeout } from "../lib/net";
import type { Account, AccountFlow, AccountKind, Category, TxnType } from "../types/finance";

export async function listAccounts(includeArchived = false): Promise<Account[]> {
  let q = db().from("financial_accounts").select("*");
  if (!includeArchived) q = q.eq("is_archived", false);
  const { data, error } = await withTimeout(q.order("created_at", { ascending: true }));
  if (error) fail(error, "We could not load your accounts.");
  return (data ?? []) as Account[];
}

export async function createAccount(input: {
  name: string;
  kind: AccountKind;
  opening_balance_paise: number;
}): Promise<void> {
  const { error } = await withTimeout(db().from("financial_accounts").insert(input));
  if (error) fail(error, "We could not create this account.");
}

export async function setAccountArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await withTimeout(db().from("financial_accounts").update({ is_archived: archived }).eq("id", id));
  if (error) fail(error, "We could not update this account.");
}

export async function accountFlows(): Promise<AccountFlow[]> {
  const { data, error } = await withTimeout(db().rpc("account_balances"));
  if (error) fail(error, "We could not calculate your recorded balances.");
  return ((data ?? []) as AccountFlow[]).map((r) => ({
    account_id: r.account_id,
    income_paise: Number(r.income_paise),
    expense_paise: Number(r.expense_paise),
  }));
}

/* ---------- categories ---------- */

const DEFAULT_EXPENSE = [
  "Food & Dining",
  "Transport",
  "Housing",
  "Utilities",
  "Shopping",
  "Entertainment",
  "Health",
  "Education",
  "Subscriptions",
  "Other",
];
const DEFAULT_INCOME = ["Salary", "Freelance", "Investments", "Gifts", "Other"];

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await withTimeout(db().from("categories").select("id,name,kind").order("name"));
  if (error) fail(error, "We could not load your categories.");
  return (data ?? []) as Category[];
}

/** Adds starter categories once, the first time a user has none. */
export async function ensureDefaultCategories(): Promise<void> {
  const { count, error } = await withTimeout(db().from("categories").select("id", { count: "exact", head: true }));
  if (error) fail(error, "We could not load your categories.");
  if ((count ?? 0) > 0) return;

  const rows = [
    ...DEFAULT_EXPENSE.map((name) => ({ name, kind: "expense" as TxnType })),
    ...DEFAULT_INCOME.map((name) => ({ name, kind: "income" as TxnType })),
  ];
  const { error: insertError } = await withTimeout(db().from("categories").insert(rows));
  // 23505 = another tab already created them; that is fine.
  if (insertError && insertError.code !== "23505") fail(insertError, "We could not set up your categories.");
}

export async function createCategory(name: string, kind: TxnType): Promise<void> {
  const { error } = await withTimeout(db().from("categories").insert({ name, kind }));
  if (error) fail(error, "We could not add this category.");
}