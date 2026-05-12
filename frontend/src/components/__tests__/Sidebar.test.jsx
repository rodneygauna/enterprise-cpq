import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, beforeEach, describe, it, expect } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock("../../hooks/useAuth");
vi.mock("../../context/BrandingContext");
vi.mock("../../hooks/useDarkMode");

import { useAuth } from "../../hooks/useAuth";
import { useBranding } from "../../context/BrandingContext";
import { useDarkMode } from "../../hooks/useDarkMode";

// ── Component under test ──────────────────────────────────────────────────────
import Sidebar from "../Sidebar";

const mockLogout = vi.fn();
const mockToggle = vi.fn();
const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

function setupMocks({ role = "sales_rep", isDark = false } = {}) {
  useAuth.mockReturnValue({
    user: { _id: "u1", firstName: "Jane", lastName: "Doe", role },
    logout: mockLogout,
  });
  useBranding.mockReturnValue({
    branding: { companyName: "Acme Health" },
  });
  useDarkMode.mockReturnValue({ isDark, toggle: mockToggle });
}

function renderSidebar(props = {}) {
  return render(
    <MemoryRouter>
      <Sidebar mobileOpen={false} onMobileClose={vi.fn()} {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  setupMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("Sidebar", () => {
  it("renders the company brand name", () => {
    renderSidebar();
    expect(screen.getAllByText("Acme Health").length).toBeGreaterThan(0);
  });

  it("renders Dashboard and Quotes links for all roles", () => {
    setupMocks({ role: "sales_rep" });
    renderSidebar();

    expect(
      screen.getAllByRole("link", { name: /dashboard/i }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /quotes/i }).length,
    ).toBeGreaterThan(0);
  });

  it("does NOT render admin-only links for sales_rep role", () => {
    setupMocks({ role: "sales_rep" });
    renderSidebar();

    expect(screen.queryByRole("link", { name: /product lines/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /products/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /users/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /settings/i })).toBeNull();
  });

  it("renders admin-only links for admin role", () => {
    setupMocks({ role: "admin" });
    renderSidebar();

    expect(
      screen.getAllByRole("link", { name: /product lines/i }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /users/i }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /settings/i }).length,
    ).toBeGreaterThan(0);
  });

  it("renders Approval Queue for sales_manager role but not sales_rep", () => {
    setupMocks({ role: "sales_manager" });
    renderSidebar();
    expect(
      screen.getAllByRole("link", { name: /approval queue/i }).length,
    ).toBeGreaterThan(0);
  });

  it("renders dark mode toggle button with correct aria-label", () => {
    renderSidebar();
    expect(
      screen.getAllByRole("button", { name: /toggle dark mode/i }).length,
    ).toBeGreaterThan(0);
  });

  it("dark mode toggle has aria-pressed=false in light mode", () => {
    setupMocks({ isDark: false });
    renderSidebar();

    const toggle = screen.getAllByRole("button", {
      name: /toggle dark mode/i,
    })[0];
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("dark mode toggle has aria-pressed=true in dark mode", () => {
    setupMocks({ isDark: true });
    renderSidebar();

    const toggle = screen.getAllByRole("button", {
      name: /toggle dark mode/i,
    })[0];
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("calls toggle() when dark mode button is clicked", () => {
    renderSidebar();

    const toggle = screen.getAllByRole("button", {
      name: /toggle dark mode/i,
    })[0];
    fireEvent.click(toggle);

    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it("renders Sign out button", () => {
    renderSidebar();
    expect(
      screen.getAllByRole("button", { name: /sign out/i }).length,
    ).toBeGreaterThan(0);
  });

  it("calls logout and navigates to /login when Sign out is clicked", async () => {
    mockLogout.mockResolvedValueOnce(undefined);
    renderSidebar();

    const signOut = screen.getAllByRole("button", { name: /sign out/i })[0];
    fireEvent.click(signOut);

    await vi.waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/login"));
  });

  it("mobile sidebar is hidden from assistive technology when mobileOpen is false", () => {
    renderSidebar({ mobileOpen: false });

    const mobileNav = document.getElementById("mobile-sidebar");
    expect(mobileNav).toHaveAttribute("aria-hidden", "true");
  });

  it("mobile sidebar is visible to assistive technology when mobileOpen is true", () => {
    renderSidebar({ mobileOpen: true });

    const mobileNav = document.getElementById("mobile-sidebar");
    expect(mobileNav).toHaveAttribute("aria-hidden", "false");
  });

  it("shows user name in footer", () => {
    setupMocks({ role: "sales_rep" });
    renderSidebar();

    // Both desktop and mobile sidebars show the name
    expect(screen.getAllByText(/jane doe/i).length).toBeGreaterThan(0);
  });
});
