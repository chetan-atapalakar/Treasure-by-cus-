export interface Budget {
  id: string;
  category_id: string | null;
  period: "monthly" | "custom";
  starts_on: string;
  ends_on: string | null;
  amount_paise: number;
  alert_threshold_pct: number;
  created_at: string;
}

export interface BudgetProgress {
  budget_id: string;
  window_start: string;
  window_end: string;
  spent_paise: number;
}

export interface Goal {
  id: string;
  name: string;
  target_paise: number;
  target_date: string | null;
  status: "active" | "completed" | "archived";
  created_at: string;
}

export interface GoalProgress {
  goal_id: string;
  saved_paise: number;
}

export interface Contribution {
  id: string;
  goal_id: string;
  amount_paise: number;
  contributed_on: string;
  note: string | null;
}