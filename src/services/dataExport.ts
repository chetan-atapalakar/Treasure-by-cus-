import { db } from "../lib/db";
import { DataError, fail, withTimeout } from "../lib/net";
import { paiseToInput } from "../lib/currency";

const PAGE = 1000;
const TABLES = [
  "profiles",
  "financial_accounts",
  "categories",
  "transactions",
  "budgets",
  "financial_goals",
  "goal_contributions",
  "notifications",
] as const;

async function fetchAll(table: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await withTimeout(
      db().from(table).select("*").order("id").range(from, from + PAGE - 1),
      30000,
    );
    if (error) fail(error, `We could not read your ${table.replace(/_/g, " ")}.`);
    const rows = (data ?? []) as Record<string, unknown>[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportAllJson(): Promise<number> {
  const tables: Record<string, Record<string, unknown>[]> = {};
  let count = 0;
  for (const t of TABLES) {
    tables[t] = await fetchAll(t);
    count += tables[t].length;
  }
  const payload = {
    exported_at: new Date().toISOString(),
    note: "Amounts are in paise (100 paise = ₹1). Figures are user-recorded, not bank-verified.",
    tables,
  };
  downloadText(`cus-treasure-export-${payload.exported_at.slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json");
  return count;
}

function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportTransactionsCsv(): Promise<number> {
  const [txns, accounts, categories] = await Promise.all([
    fetchAll("transactions"),
    fetchAll("financial_accounts"),
    fetchAll("categories"),
  ]);
  if (txns.length === 0) throw new DataError("You have no transactions to export yet.");

  const accountName = new Map(accounts.map((a) => [String(a.id), String(a.name)]));
  const categoryName = new Map(categories.map((c) => [String(c.id), String(c.name)]));

  const header = ["date", "type", "amount_inr", "description", "merchant", "category", "account", "notes"];
  const lines = [header.join(",")];
  const sorted = [...txns].sort((a, b) => String(b.occurred_on).localeCompare(String(a.occurred_on)));
  for (const t of sorted) {
    lines.push(
      [
        t.occurred_on,
        t.type,
        paiseToInput(Number(t.amount_paise)),
        t.description,
        t.merchant,
        t.category_id ? categoryName.get(String(t.category_id)) ?? "" : "",
        accountName.get(String(t.account_id)) ?? "",
        t.notes,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  downloadText(`cus-treasure-transactions-${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\r\n"), "text/csv;charset=utf-8");
  return txns.length;
}

export async function deleteMyAccount(): Promise<void> {
  try {
    const { error } = await withTimeout(db().functions.invoke("delete-account", { body: { confirm: "DELETE" } }), 30000);
    if (error) throw error;
  } catch {
    throw new DataError(
      "We could not confirm the deletion. The delete-account function may not be deployed yet. Please try again, and check your data export first.",
    );
  }
}