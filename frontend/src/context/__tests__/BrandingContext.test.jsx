/**
 * BrandingContext tests — covers FR-BRAND-2 (branding context).
 *
 * Test coverage:
 *   - Renders children without crashing
 *   - Exposes companyName from fetched settings
 *   - Keeps defaults (no crash) when the fetch fails
 */

import { render, waitFor, screen } from "@testing-library/react";
import { vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock("../../api/settings");

import { getSettings } from "../../api/settings";
import { BrandingProvider, useBranding } from "../BrandingContext";

beforeEach(() => {
  vi.resetAllMocks();
});

function BrandingDisplay() {
  const { branding } = useBranding();
  return <span data-testid="company">{branding.companyName}</span>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("BrandingProvider", () => {
  it("renders children without crashing", async () => {
    getSettings.mockResolvedValue({ companyName: "Test Corp", logoUrl: null });

    const { getByText } = render(
      <BrandingProvider>
        <span>child content</span>
      </BrandingProvider>,
    );

    expect(getByText("child content")).toBeInTheDocument();
    // Wait for async effect to settle
    await waitFor(() => expect(getSettings).toHaveBeenCalled());
  });

  it("exposes companyName from fetched settings", async () => {
    getSettings.mockResolvedValue({
      companyName: "Acme Health",
      logoUrl: null,
    });

    render(
      <BrandingProvider>
        <BrandingDisplay />
      </BrandingProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("company").textContent).toBe("Acme Health"),
    );
  });

  it("does not crash and keeps defaults when fetch fails", async () => {
    getSettings.mockRejectedValue(new Error("Network error"));

    const { getByText } = render(
      <BrandingProvider>
        <BrandingDisplay />
      </BrandingProvider>,
    );

    // Children still render
    expect(getByText("Enterprise CPQ")).toBeInTheDocument();

    // Wait for rejected promise to settle
    await waitFor(() => expect(getSettings).toHaveBeenCalled());
  });
});
