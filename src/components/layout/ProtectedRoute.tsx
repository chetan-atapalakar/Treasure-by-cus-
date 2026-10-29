import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import QuoteLoader from "../ui/QuoteLoader";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, demo, loading } = useAuth();
  const location = useLocation();

  if (loading) return <QuoteLoader fullscreen message="Gathering your financial picture..." />;
  if (!session && !demo) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}