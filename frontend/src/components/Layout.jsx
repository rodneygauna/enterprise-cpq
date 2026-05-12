import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useBranding } from "../context/BrandingContext";
import Sidebar from "./Sidebar";
import { useSidebarCollapsed } from "../hooks/useSidebarCollapsed";

/**
 * Root layout: persistent sidebar navigation + main content area.
 * Renders only when the user is authenticated (wrapped by ProtectedRoute).
 *
 * Desktop (≥md): sidebar is always visible on the left.
 * Mobile (<md):  top bar with hamburger button toggles the sidebar overlay.
 */
export default function Layout() {
  const { branding } = useBranding();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { collapsed: sidebarCollapsed, toggle: toggleSidebar } =
    useSidebarCollapsed();

  return (
    <>
      {/* Skip-to-content link — keyboard / screen-reader requirement (WCAG 2.4.1) */}
      <a href="#main-content" className="visually-hidden-focusable">
        Skip to main content
      </a>

      <div className="cpq-app-shell">
        {/* Sidebar: handles both desktop + mobile overlay */}
        <Sidebar
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />

        {/* Main content column */}
        <div className="cpq-main-wrapper">
          {/* Mobile-only topbar with hamburger */}
          <header className="cpq-topbar d-flex d-md-none justify-content-between align-items-center">
            <span
              className="fw-bold"
              style={{ fontFamily: "var(--cpq-font-heading)" }}
            >
              {branding.companyName}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-link text-body p-1"
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-sidebar"
              onClick={() => setMobileNavOpen(true)}
            >
              <i className="bi bi-list fs-4" aria-hidden="true" />
            </button>
          </header>

          <main id="main-content" className="flex-grow-1">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
