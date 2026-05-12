import { useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useBranding } from "../context/BrandingContext";
import { useDarkMode } from "../hooks/useDarkMode";

/**
 * Application sidebar — rendered in two modes:
 *   Desktop (≥md): sticky left column, always visible.
 *   Mobile   (<md): left-side overlay, shown when `mobileOpen` is true.
 *
 * Props:
 *   mobileOpen    {boolean}  — whether the mobile drawer is open
 *   onMobileClose {Function} — callback to close the mobile drawer
 */
export default function Sidebar({ mobileOpen, onMobileClose }) {
  const { user, logout } = useAuth();
  const { branding } = useBranding();
  const { isDark, toggle } = useDarkMode();
  const navigate = useNavigate();
  const mobileNavRef = useRef(null);

  // Move focus into mobile nav when it opens (keyboard / AT usability)
  useEffect(() => {
    if (mobileOpen && mobileNavRef.current) {
      const firstFocusable = mobileNavRef.current.querySelector(
        "a, button, [tabindex]:not([tabindex='-1'])",
      );
      firstFocusable?.focus();
    }
  }, [mobileOpen]);

  // Close mobile nav on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    function handleKey(e) {
      if (e.key === "Escape") onMobileClose?.();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mobileOpen, onMobileClose]);

  async function handleLogout() {
    onMobileClose?.();
    await logout();
    navigate("/login");
  }

  function linkClass({ isActive }) {
    return "cpq-nav-link" + (isActive ? " active" : "");
  }

  const isApprover = [
    "sales_manager",
    "executive",
    "admin",
    "super_admin",
  ].includes(user?.role);
  const isAdmin = ["admin", "super_admin"].includes(user?.role);

  function NavContent({ onClose }) {
    return (
      <div className="d-flex flex-column h-100 py-3 px-2">
        {/* Brand name */}
        <div className="px-2 mb-4">
          <span
            className="fw-bold fs-5 d-block"
            style={{ fontFamily: "var(--cpq-font-heading)" }}
          >
            {branding.companyName}
          </span>
        </div>

        {/* Primary navigation */}
        <nav aria-label="Primary navigation">
          <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
            <li>
              <NavLink to="/" end className={linkClass} onClick={onClose}>
                <i className="bi bi-speedometer2" aria-hidden="true" />
                Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink to="/quotes" className={linkClass} onClick={onClose}>
                <i className="bi bi-file-text" aria-hidden="true" />
                Quotes
              </NavLink>
            </li>
            {isApprover && (
              <li>
                <NavLink
                  to="/approval-queue"
                  className={linkClass}
                  onClick={onClose}
                >
                  <i className="bi bi-clipboard-check" aria-hidden="true" />
                  Approval Queue
                </NavLink>
              </li>
            )}
            {isAdmin && (
              <>
                <li>
                  <NavLink
                    to="/admin/product-lines"
                    className={linkClass}
                    onClick={onClose}
                  >
                    <i className="bi bi-diagram-3" aria-hidden="true" />
                    Product Lines
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/admin/products"
                    className={linkClass}
                    onClick={onClose}
                  >
                    <i className="bi bi-box-seam" aria-hidden="true" />
                    Products
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/admin/users"
                    className={linkClass}
                    onClick={onClose}
                  >
                    <i className="bi bi-people" aria-hidden="true" />
                    Users
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/settings"
                    className={linkClass}
                    onClick={onClose}
                  >
                    <i className="bi bi-gear" aria-hidden="true" />
                    Settings
                  </NavLink>
                </li>
              </>
            )}
          </ul>
        </nav>

        {/* Spacer pushes footer to bottom */}
        <div className="flex-grow-1" />

        {/* Footer: dark mode toggle + user + sign out */}
        <div className="border-top pt-3 mt-3 d-flex flex-column gap-1">
          <div className="d-flex align-items-center justify-content-between px-2 mb-1">
            <span
              className="small text-muted text-truncate"
              style={{ maxWidth: "140px" }}
              aria-live="polite"
            >
              {user?.firstName} {user?.lastName}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-link p-1 text-body text-decoration-none"
              onClick={toggle}
              aria-label="Toggle dark mode"
              aria-pressed={isDark}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              <i
                className={`bi ${isDark ? "bi-sun-fill" : "bi-moon-stars-fill"} fs-6`}
                aria-hidden="true"
              />
            </button>
          </div>
          <button
            type="button"
            className="cpq-nav-link border-0 bg-transparent w-100 text-start"
            onClick={handleLogout}
          >
            <i className="bi bi-box-arrow-right" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile) ──────────────────── */}
      <aside
        className="cpq-sidebar cpq-glass d-none d-md-block"
        aria-label="Main navigation"
      >
        <NavContent onClose={undefined} />
      </aside>

      {/* ── Mobile backdrop ──────────────────────────────────────── */}
      <div
        className={`cpq-mobile-backdrop${mobileOpen ? " cpq-mobile-backdrop--open" : ""}`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      {/* ── Mobile sidebar ───────────────────────────────────────── */}
      <aside
        ref={mobileNavRef}
        id="mobile-sidebar"
        className={`cpq-mobile-nav cpq-glass${mobileOpen ? " cpq-mobile-nav--open" : ""}`}
        aria-label="Mobile navigation"
        aria-hidden={!mobileOpen}
        tabIndex={mobileOpen ? undefined : -1}
      >
        <NavContent onClose={onMobileClose} />
      </aside>
    </>
  );
}
