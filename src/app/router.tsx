import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import PlaceholderPage, { NotFound } from "../pages/PlaceholderPage";
import Login from "../pages/Login";
import VerifyOTP from "../pages/VerifyOTP";
import Settings from "../pages/Settings";

const Dashboard = lazy(() => import("../pages/Dashboard"));

const placeholder = (path: string, title: string, phase: string, description: string) => ({
  path,
  element: <PlaceholderPage title={title} phase={phase} description={description} />,
});

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/verify", element: <VerifyOTP /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      placeholder("transactions", "Transactions", "Batch 3", "Add, edit, search and filter your transactions."),
      placeholder("calendar", "Financial calendar", "Phase 2", "Bills, EMIs, subscriptions and milestones on a timeline."),
      placeholder("budgets", "Budgets", "Phase 2", "Monthly and category budgets with threshold alerts."),
      placeholder("goals", "Savings goals", "Phase 2", "Targets, contributions and progress."),
      placeholder("accounts", "Accounts", "Batch 3", "Track the accounts you choose to record."),
      placeholder("statements", "Statements", "Phase 3", "View in-app statements and generate PDFs."),
      placeholder("assistant", "AI assistant", "Phase 3", "Needs a secure backend and AI provider credentials."),
      placeholder("notifications", "Notifications", "Batch 3", "Notification centre with read and unread states."),
      placeholder("premium", "Premium", "Phase 4", "Plans and billing, verified server-side."),
      { path: "settings", element: <Settings /> },
      { path: "*", element: <NotFound /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);