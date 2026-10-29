/** Pricing lives here so it can change without touching screens. Amounts in paise. */
export const PLAN_CONFIG = {
  currency: "INR",
  premiumMonthlyPaise: 2000, // proposed ₹20/month. Must match the plan created at the payment provider.
};

export const FREE_FEATURES = [
  "Manual transaction tracking",
  "Dashboard and search",
  "Budgets and savings goals",
  "Calendar and reminders",
  "Statements and PDF",
  "AI assistant (small daily allowance)",
];

export const PREMIUM_FEATURES = [
  "Everything in Free",
  "Higher daily AI allowance",
  "Advanced analytics (planned, not yet built)",
  "Extended comparisons (planned, not yet built)",
];