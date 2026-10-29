export type TxnType = "income" | "expense";
export type AccountKind = "cash" | "bank" | "card" | "wallet" | "investment" | "loan";

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  opening_balance_paise: number;
  is_archived: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  kind: TxnType;
}

export interface Transaction {
  id: string;
  account_id: string;
  category_id: string | null;
  type: TxnType;
  amount_paise: number;
  occurred_on: string;
  description: string;
  merchant: string | null;
  notes: string | null;
  source: string;
  created_at: string;
}

export interface TxnInput {
  account_id: string;
  category_id: string | null;
  type: TxnType;
  amount_paise: number;
  occurred_on: string;
  description: string;
  merchant: string | null;
  notes: string | null;
}

export type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

export interface TxnFilters {
  search: string;
  type: "" | TxnType;
  accountId: string;
  /** "" = any, "none" = uncategorised, otherwise a category id */
  categoryId: string;
  from: string;
  to: string;
  minPaise: number | null;
  maxPaise: number | null;
  sort: SortKey;
  page: number;
  pageSize: number;
}

export interface AccountFlow {
  account_id: string;
  income_paise: number;
  expense_paise: number;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  deep_link: string | null;
  read_at: string | null;
  created_at: string;
}