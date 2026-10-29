import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import PlaceholderPage, { NotFound } from "../pages/PlaceholderPage";
import Login from "../pages/Login";
import VerifyOTP from "../pages/VerifyOTP";

const Dashboard = lazy(() => import("../pages/Dashboard"));
const Transactions = lazy(() => import("../pages/Transactions"));
const Accounts = lazy(() => import("../pages/Accounts"));
const Notifications = lazy(() => import("../pages/Notifications"));
const Budgets = lazy(() => import("../pages/Budgets"));
const Goals = lazy(() => import("../pages/Goals"));
const Settings = lazy(() => import("../pages/Settings"));

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
      { path: "transactions", element: <Transactions /> },
      { path: "accounts", element: <Accounts /> },
      { path: "notifications", element: <Notifications /> },
      { path: "budgets", element: <Budgets /> },
      { path: "goals", element: <Goals /> },
      { path: "settings", element: <Settings /> },
      placeholder("calendar", "Financial calendar", "Batch 5", "Bills, EMIs, subscriptions and milestones on a timeline."),
      placeholder("statements", "Statements", "Batch 5", "View in-app statements and generate PDFs."),
      placeholder("assistant", "AI assistant", "Phase 3", "Needs a secure backend and AI provider credentials."),
      placeholder("premium", "Premium", "Phase 4", "Plans and billing, verified server-side."),
      { path: "*", element: <NotFound /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);