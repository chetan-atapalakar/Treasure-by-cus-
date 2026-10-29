import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "../contexts/AuthContext";
import { ToastProvider } from "../components/ui/Toast";
import { router } from "./router";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  );
}