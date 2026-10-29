import { db } from "../lib/db";
import { fail, withTimeout } from "../lib/net";
import { listAccounts, listCategories } from "./accounts";
import type { Account, Category, Transaction } from "../types/finance";

const PAGE = 1000;
const MAX_ROWS = 5000;

export interface StatementData {
  rows: Transaction[];
  accounts: Account[];
  categories: Category[];
  truncated: boolean;
}

export async function fetchStatementData(from: string, to: string, accountId: string): Promise<StatementData> {
  const rows: Transaction[] = [];
  let truncated = false;
  for (let offset = 0; ; offset += PAGE) {
    let q = db().from("transactions").select("*").in("type", ["income", "expense"]).gte("occurred_on", from).lte("occurred_on", to);
    if (accountId) q = q.eq("account_id", accountId);
    const { data, error } = await withTimeout(q.order("occurred_on", { ascending: true }).order("created_at", { ascending: true }).range(offset, offset + PAGE - 1), 30000);
    if (error) fail(error, "We could not load transactions for this statement.");
    const batch = (data ?? []) as Transaction[];
    rows.push(...batch.map((t) => ({ ...t, amount_paise: Number(t.amount_paise) })));
    if (batch.length < PAGE) break;
    if (rows.length >= MAX_ROWS) {
      truncated = true;
      break;
    }
  }
  const [accounts, categories] = await Promise.all([listAccounts(true), listCategories()]);
  return { rows, accounts, categories, truncated };
}