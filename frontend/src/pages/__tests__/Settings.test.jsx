/**
 * Settings page tests — covers FR-BRAND-1 through FR-BRAND-4 (frontend).
 *
 * Test coverage:
 *   - Renders branding form for super_admin
 *   - Blocks access for non-super_admin roles
 *   - Pre-fills form with loaded settings values
 *   - Shows inline validation error when company name is cleared
 *   - Shows inline validation error for invalid hex color
 *   - Clears validation error when user corrects the field
 *   - Does not call the API when validation fails
 *   - Shows success toast after a successful save
 *   - Shows error toast when save fails
 *   - Shows fallback error toast when the save response has no message
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock("../../api/axios");
vi.mock("../../hooks/useAuth");
vi.mock("../../api/settings");
vi.mock("../../api/productLines");
vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("../../context/BrandingContext", () => ({
  BrandingContext: {},
  useBranding: () => ({
    branding: {
      companyName: "Enterprise CPQ",
      primaryColor: "#0d6efd",
      accentColor: "#6c757d",
    },
    setBranding: vi.fn(),
  }),
}));

import { useAuth } from "../../hooks/useAuth";
import {
  getSettings,
  updateSettings,
  updateDiscountSettings,
  updateMarginSettings,
} from "../../api/settings";
import { getProductLines } from "../../api/productLines";
import { toast } from "react-toastify";
import Settings from "../Settings";

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

function renderSettings(role = "super_admin") {
  useAuth.mockReturnValue({
    user: { role, firstName: "Test", lastName: "User" },
    isAuthenticated: true,
  });
  return render(
    <MemoryRouter future={routerFuture}>
      <Settings />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  getSettings.mockResolvedValue({
    companyName: "Test Corp",
    primaryColor: "#0d6efd",
    accentColor: "#6c757d",
    logoUrl: null,
    discountThresholds: {
      managerReviewPercent: 10,
      executiveReviewPercent: 25,
    },
    volumeDiscountRules: [],
    marginTargets: { global: { green: 50, yellow: 30 }, productLines: {} },
  });
  getProductLines.mockResolvedValue([
    { _id: "line-1", name: "Care Management" },
    { _id: "line-2", name: "Population Health" },
  ]);
  updateMarginSettings.mockResolvedValue({
    marginTargets: { global: { green: 50, yellow: 30 }, productLines: {} },
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("Settings page", () => {
  it("renders branding form for super_admin", async () => {
    renderSettings("super_admin");

    await waitFor(() =>
      expect(screen.getByLabelText(/company name/i)).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Primary Color")).toBeInTheDocument();
    expect(screen.getByLabelText("Accent Color")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save settings/i }),
    ).toBeInTheDocument();
  });

  it("blocks non-admin users with a permission message", () => {
    renderSettings("sales_rep");

    expect(screen.getByText(/do not have permission/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/company name/i)).not.toBeInTheDocument();
  });

  it("pre-fills company name input with loaded settings", async () => {
    renderSettings("super_admin");

    await waitFor(() =>
      expect(screen.getByDisplayValue("Test Corp")).toBeInTheDocument(),
    );
  });

  it("shows inline error and does not call API when company name is empty", async () => {
    renderSettings("super_admin");
    await waitFor(() => screen.getByDisplayValue("Test Corp"));

    const nameInput = screen.getByLabelText(/company name/i);
    await userEvent.clear(nameInput);
    await userEvent.click(
      screen.getByRole("button", { name: /save settings/i }),
    );

    expect(screen.getByText("Company name is required.")).toBeInTheDocument();
    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("shows inline error for an invalid hex color", async () => {
    renderSettings("super_admin");
    await waitFor(() => screen.getByDisplayValue("Test Corp"));

    const hexInput = screen.getByLabelText(/primary color hex value/i);
    await userEvent.clear(hexInput);
    await userEvent.type(hexInput, "notacolor");
    await userEvent.click(
      screen.getByRole("button", { name: /save settings/i }),
    );

    expect(
      screen.getByText(/must be a valid 6-digit hex color/i),
    ).toBeInTheDocument();
    expect(hexInput).toHaveAttribute("aria-invalid", "true");
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("clears inline validation error when the field is corrected", async () => {
    renderSettings("super_admin");
    await waitFor(() => screen.getByDisplayValue("Test Corp"));

    const nameInput = screen.getByLabelText(/company name/i);
    await userEvent.clear(nameInput);
    await userEvent.click(
      screen.getByRole("button", { name: /save settings/i }),
    );
    expect(screen.getByText("Company name is required.")).toBeInTheDocument();

    await userEvent.type(nameInput, "Fixed Corp");
    expect(
      screen.queryByText("Company name is required."),
    ).not.toBeInTheDocument();
  });

  it("shows a success toast after a successful save", async () => {
    updateSettings.mockResolvedValue({
      companyName: "Updated Corp",
      primaryColor: "#0d6efd",
      accentColor: "#6c757d",
      logoUrl: null,
    });

    renderSettings("super_admin");
    await waitFor(() => screen.getByDisplayValue("Test Corp"));

    const nameInput = screen.getByLabelText(/company name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Updated Corp");
    await userEvent.click(
      screen.getByRole("button", { name: /save settings/i }),
    );

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Settings saved successfully.",
      ),
    );
  });

  it("shows an error toast when save fails", async () => {
    updateSettings.mockRejectedValue({
      response: { data: { error: "Unauthorized" } },
    });

    renderSettings("super_admin");
    await waitFor(() => screen.getByDisplayValue("Test Corp"));

    await userEvent.click(
      screen.getByRole("button", { name: /save settings/i }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Unauthorized"),
    );
  });

  it("shows a fallback error toast when the save response has no message", async () => {
    updateSettings.mockRejectedValue(new Error("Network error"));

    renderSettings("super_admin");
    await waitFor(() => screen.getByDisplayValue("Test Corp"));

    await userEvent.click(
      screen.getByRole("button", { name: /save settings/i }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to save settings."),
    );
  });
});

// ─── Discount Settings form (§7.8) ───────────────────────────────────────────
describe("Settings — discount settings form", () => {
  beforeEach(() => {
    updateDiscountSettings.mockResolvedValue({
      discountThresholds: {
        managerReviewPercent: 12,
        executiveReviewPercent: 30,
      },
      volumeDiscountRules: [],
    });
    getSettings.mockResolvedValue({
      companyName: "Test Corp",
      primaryColor: "#0d6efd",
      accentColor: "#6c757d",
      logoUrl: null,
      discountThresholds: {
        managerReviewPercent: 10,
        executiveReviewPercent: 25,
      },
      volumeDiscountRules: [],
    });
  });

  it("renders discount section for admin role", async () => {
    renderSettings("admin");
    await waitFor(() =>
      expect(screen.getByText(/manager review threshold/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/executive review threshold/i)).toBeInTheDocument();
  });

  it("does not render discount section for sales_rep", () => {
    renderSettings("sales_rep");
    expect(
      screen.queryByText(/manager review threshold/i),
    ).not.toBeInTheDocument();
  });

  it("calls updateDiscountSettings on save", async () => {
    const user = userEvent.setup();
    renderSettings("admin");
    await screen.findByText(/manager review threshold/i);

    await user.click(
      screen.getByRole("button", { name: /save discount settings/i }),
    );

    await waitFor(() => expect(updateDiscountSettings).toHaveBeenCalled());
  });

  it("shows success toast after saving discount settings", async () => {
    const user = userEvent.setup();
    renderSettings("admin");
    await screen.findByText(/manager review threshold/i);

    await user.click(
      screen.getByRole("button", { name: /save discount settings/i }),
    );

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("Discount"),
      ),
    );
  });
});

// ── §7.9 Margin settings ──────────────────────────────────────────────────────
describe("Margin scorecard settings form", () => {
  it("renders margin scorecard section for admin", async () => {
    renderSettings("admin");
    await waitFor(() =>
      expect(screen.getByText(/margin scorecard/i)).toBeInTheDocument(),
    );
    expect(
      screen.getByLabelText(/global green threshold/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/global yellow threshold/i),
    ).toBeInTheDocument();
  });

  it("pre-fills global thresholds from settings", async () => {
    renderSettings("admin");
    await waitFor(() =>
      expect(screen.getByText(/margin scorecard/i)).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/global green threshold/i)).toHaveValue(50);
    expect(screen.getByLabelText(/global yellow threshold/i)).toHaveValue(30);
  });

  it("calls updateMarginSettings on save", async () => {
    const user = userEvent.setup();
    renderSettings("admin");
    await waitFor(() =>
      expect(screen.getByText(/margin scorecard/i)).toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole("button", { name: /save margin settings/i }),
    );

    await waitFor(() => expect(updateMarginSettings).toHaveBeenCalled());
  });

  it("shows success toast after saving margin settings", async () => {
    const user = userEvent.setup();
    renderSettings("admin");
    await waitFor(() =>
      expect(screen.getByText(/margin scorecard/i)).toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole("button", { name: /save margin settings/i }),
    );

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("Margin"),
      ),
    );
  });

  it("shows Add Override button and allows adding a per-line override row", async () => {
    const user = userEvent.setup();
    renderSettings("admin");
    await waitFor(() =>
      expect(screen.getByText(/margin scorecard/i)).toBeInTheDocument(),
    );

    const addBtn = screen.getByRole("button", { name: /\+ add override/i });
    await user.click(addBtn);

    // Should now show a product line selector
    expect(
      screen.getByLabelText(/product line for override 1/i),
    ).toBeInTheDocument();
  });
});
