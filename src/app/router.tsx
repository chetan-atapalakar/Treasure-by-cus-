import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import PlaceholderPage, { NotFound } from "../pages/PlaceholderPage";

const Dashboard = lazy(() => import("../pages/Dashboard"));

const placeholder = (path: string, title: string, phase: string, description: string) => ({
  path,
  element: <PlaceholderPage title={title} phase={phase} description={description} />,
});

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      placeholder("transactions", "Transactions", "Phase 1 · next batch", "Add, edit, search and filter your transactions."),
      placeholder("calendar", "Financial calendar", "Phase 2", "Bills, EMIs, subscriptions and milestones on a timeline."),
      placeholder("budgets", "Budgets", "Phase 2", "Monthly and category budgets with threshold alerts."),
      placeholder("goals", "Savings goals", "Phase 2", "Targets, contributions and progress."),
      placeholder("accounts", "Accounts", "Phase 2", "Track the accounts you choose to record."),
      placeholder("statements", "Statements", "Phase 3", "View in-app statements and generate PDFs."),
      placeholder("assistant", "AI assistant", "Phase 3", "Needs a secure backend and AI provider credentials."),
      placeholder("notifications", "Notifications", "Phase 1 · next batch", "Notification centre with read and unread states."),
      placeholder("premium", "Premium", "Phase 4", "Plans and billing, verified server-side."),
      placeholder("settings", "Settings", "Phase 2", "Profile, privacy and notification preferences."),
      { path: "*", element: <NotFound /> },
    ],
  },
]);