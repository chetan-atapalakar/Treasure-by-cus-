import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import { NotFound } from "../pages/PlaceholderPage";
import Login from "../pages/Login";
import VerifyOTP from "../pages/VerifyOTP";

const Dashboard = lazy(() => import("../pages/Dashboard"));
const Transactions = lazy(() => import("../pages/Transactions"));
const Accounts = lazy(() => import("../pages/Accounts"));
const Notifications = lazy(() => import("../pages/Notifications"));
const Budgets = lazy(() => import("../pages/Budgets"));
const Goals = lazy(() => import("../pages/Goals"));
const Settings = lazy(() => import("../pages/Settings"));
const Calendar = lazy(() => import("../pages/Calendar"));
const Statements = lazy(() => import("../pages/Statements"));
const Assistant = lazy(() => import("../pages/Assistant"));
const Premium = lazy(() => import("../pages/Premium"));
const Referrals = lazy(() => import("../pages/Referrals"));
const Admin = lazy(() => import("../pages/Admin"));

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
      { path: "calendar", element: <Calendar /> },
      { path: "statements", element: <Statements /> },
      { path: "assistant", element: <Assistant /> },
      { path: "premium", element: <Premium /> },
      { path: "referrals", element: <Referrals /> },
      { path: "admin", element: <Admin /> },
      { path: "settings", element: <Settings /> },
      { path: "*", element: <NotFound /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);