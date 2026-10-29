import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Bell, Menu, X } from "lucide-react";
import QuoteLoader from "../ui/QuoteLoader";
import { NAV_ITEMS } from "./navItems";
import "./layout.css";

const navClass = ({ isActive }: { isActive: boolean }) => `navlink${isActive ? " active" : ""}`;
const bottomClass = ({ isActive }: { isActive: boolean }) => `bottomnav__item${isActive ? " active" : ""}`;
const moreClass = ({ isActive }: { isActive: boolean }) => `more__link${isActive ? " active" : ""}`;

export default function AppLayout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  // Close the "More" sheet whenever the route changes.
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  // Escape closes the sheet.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const primary = NAV_ITEMS.filter((i) => i.primary);

  return (
    <div className="shell">
      <a className="skip-link" href="#content">
        Skip to content
      </a>

      <aside className="sidebar" aria-label="Primary">
        <div className="sidebar__brand">
          <p className="sidebar__name">CüS Treasure</p>
          <p className="sidebar__descriptor">Treasure by CüS Studio</p>
        </div>
        <nav className="sidebar__nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navClass}>
              <Icon size={19} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <header className="topbar">
        <p className="topbar__name">CüS Treasure</p>
        <NavLink to="/notifications" className="topbar__bell" aria-label="Notifications">
          <Bell size={21} aria-hidden="true" />
        </NavLink>
      </header>

      <div className="content" id="content" tabIndex={-1}>
        <Suspense fallback={<QuoteLoader fullscreen message="Preparing your monthly overview..." />}>
          <Outlet />
        </Suspense>
      </div>

      <nav className="bottomnav" aria-label="Main navigation">
        {primary.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={bottomClass}>
            <Icon size={21} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          className="bottomnav__item"
          aria-expanded={moreOpen}
          aria-controls="more-sheet"
          onClick={() => setMoreOpen((v) => !v)}
        >
          <Menu size={21} aria-hidden="true" />
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="more" onClick={() => setMoreOpen(false)}>
          <div
            className="more__sheet"
            id="more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="All sections"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="more__head">
              <h2 className="more__title">All sections</h2>
              <button type="button" className="more__close" onClick={() => setMoreOpen(false)} aria-label="Close menu">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="more__grid">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={moreClass}>
                  <Icon size={19} aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}