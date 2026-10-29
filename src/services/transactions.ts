import { db } from "../lib/db";
import { DataError, fail, withTimeout } from "../lib/net";
import { buildBuckets, getRange, type DayRow, type Period, type Summary, type Totals } from "../lib/summary";
import type { Transaction, TxnFilters, TxnInput } from "../types/finance";
import { listAccounts, listCategories } from "./accounts";

function cleanSearch(s: string): string {
  // Removes characters that have meaning inside filter expressions.
  return s.replace(/[%,()*\\_]/g, " ").trim().slice(0, 80);
}

export async function listTransactions(f: TxnFilters): Promise<{ rows: Transaction[]; total: number }> {
  let q = db().from("transactions").select("*", { count: "exact" });
  q = f.type ? q.eq("type", f.type) : q.in("type", ["income", "expense"]);
  if (f.accountId) q = q.eq("account_id", f.accountId);
  if (f.categoryId === "none") q = q.is("category_id", null);
  else if (f.categoryId) q = q.eq("category_id", f.categoryId);
  if (f.from) q = q.gte("occurred_on", f.from);
  if (f.to) q = q.lte("occurred_on", f.to);
  if (f.minPaise !== null) q = q.gte("amount_paise", f.minPaise);
  if (f.maxPaise !== null) q = q.lte("amount_paise", f.maxPaise);
  const s = cleanSearch(f.search);
  if (s) q = q.or(`description.ilike.%${s}%,merchant.ilike.%${s}%`);

  const ordered =
    f.sort === "amount_desc"
      ? q.order("amount_paise", { ascending: false }).order("occurred_on", { ascending: false })
      : f.sort === "amount_asc"
        ? q.order("amount_paise", { ascending: true }).order("occurred_on", { ascending: false })
        : f.sort === "date_asc"
          ? q.order("occurred_on", { ascending: true }).order("created_at", { ascending: true })
          : q.order("occurred_on", { ascending: false }).order("created_at", { ascending: false });

  const from = f.page * f.pageSize;
  const { data, error, count } = await withTimeout(ordered.range(from, from + f.pageSize - 1));
  if (error) fail(error, "We could not load your transactions.");
  return { rows: (data ?? []) as Transaction[], total: count ?? 0 };
}

export async function createTransaction(input: TxnInput): Promise<void> {
  const { error } = await withTimeout(db().from("transactions").insert(input));
  if (error) fail(error, "We could not save this transaction.");
}

export async function updateTransaction(id: string, input: TxnInput): Promise<void> {
  const { error } = await withTimeout(db().from("transactions").update(input).eq("id", id));
  if (error) fail(error, "We could not update this transaction.");
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await withTimeout(db().from("transactions").delete().eq("id", id));
  if (error) fail(error, "We could not delete this transaction.");
}

/* ---------- dashboard summary (aggregated in the database) ---------- */

interface RpcSummary {
  income: number | string;
  expense: number | string;
  count: number | string;
  categories: { name: string; paise: number | string }[];
  buckets: { day: string; income: number | string; expense: number | string }[];
}

async function rpcSummary(start: string, end: string, bucket: "day" | "month"): Promise<RpcSummary> {
  const { data, error } = await withTimeout(db().rpc("period_summary", { p_start: start, p_end: end, p_bucket: bucket }));
  if (error) fail(error, "We could not load your overview. Make sure migration 0002 has been run.");
  if (!data) throw new DataError("We could not load your overview.");
  return data as RpcSummary;
}

const toTotals = (r: RpcSummary): Totals => ({
  income: Number(r.income),
  expense: Number(r.expense),
  count: Number(r.count),
});

export async function fetchSummary(period: Period, today: Date): Promise<Summary> {
  const range = getRange(period, today);

  const recentQuery = db()
    .from("transactions")
    .select("*")
    .in("type", ["income", "expense"])
    .gte("occurred_on", range.start)
    .lte("occurred_on", range.end)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(8);

  const [cur, prev, recentRes, accounts, categories] = await Promise.all([
    rpcSummary(range.start, range.end, period === "year" ? "month" : "day"),
    rpcSummary(range.prevStart, range.prevEnd, "day"),
    withTimeout(recentQuery),
    listAccounts(true),
    listCategories(),
  ]);
  if (recentRes.error) fail(recentRes.error, "We could not load your recent transactions.");

  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const rows: DayRow[] = cur.buckets.map((b) => ({ day: b.day, income: Number(b.income), expense: Number(b.expense) }));

  return {
    current: toTotals(cur),
    previous: toTotals(prev),
    buckets: buildBuckets(period, rows, range, today),
    categories: cur.categories.map((c) => ({ name: c.name, paise: Number(c.paise) })),
    recent: ((recentRes.data ?? []) as Transaction[]).map((t) => ({
      id: t.id,
      date: t.occurred_on,
      description: t.description,
      category: t.category_id ? (categoryName.get(t.category_id) ?? "Uncategorised") : "Uncategorised",
      account: accountName.get(t.account_id) ?? "Account",
      amountPaise: t.amount_paise,
      type: t.type,
    })),
  };
}