import {
  ArrowLeftRight,
  Bell,
  CalendarDays,
  Crown,
  FileText,
  Landmark,
  LayoutDashboard,
  Settings,
  Sparkles,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Shown in the mobile bottom bar; everything else lives under "More". */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, primary: true },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight, primary: true },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, primary: true },
  { to: "/assistant", label: "Assistant", icon: Sparkles, primary: true },
  { to: "/budgets", label: "Budgets", icon: Wallet },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/accounts", label: "Accounts", icon: Landmark },
  { to: "/statements", label: "Statements", icon: FileText },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/premium", label: "Premium", icon: Crown },
  { to: "/settings", label: "Settings", icon: Settings },
];