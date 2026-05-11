/**
 * BrandingContext tests — covers FR-BRAND-2 (runtime brand color injection).
 *
 * Test coverage:
 *   - Renders children without crashing
 *   - Sets CSS custom properties from fetched settings
 *   - Keeps default colors (no crash) when the fetch fails
 */

import { render, waitFor } from "@testing-library/react";
import { vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock("../../api/settings");

import { getSettings } from "../../api/settings";
import { BrandingProvider } from "../BrandingContext";

beforeEach(() => {
  vi.resetAllMocks();
  document.documentElement.style.removeProperty("--bs-primary");
  document.documentElement.style.removeProperty("--bs-secondary");
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("BrandingProvider", () => {
  it("renders children without crashing", async () => {
    getSettings.mockResolvedValue({
      companyName: "Test Corp",
      primaryColor: "#0d6efd",
      accentColor: "#6c757d",
    });

    const { getByText } = render(
      <BrandingProvider>
        <span>child content</span>
      </BrandingProvider>,
    );

    expect(getByText("child content")).toBeInTheDocument();
    // Wait for the async effect to settle so act() warnings are suppressed
    await waitFor(() =>
      expect(
        document.documentElement.style.getPropertyValue("--bs-primary"),
      ).toBe("#0d6efd"),
    );
    expect(
      document.documentElement.style.getPropertyValue("--bs-primary-rgb"),
    ).toBe("13, 110, 253");
  });

  it("sets --bs-primary/-rgb and --bs-secondary/-rgb from fetched settings", async () => {
    getSettings.mockResolvedValue({
      companyName: "Acme Health",
      primaryColor: "#ff0000",
      accentColor: "#00ff00",
    });

    render(
      <BrandingProvider>
        <span>test</span>
      </BrandingProvider>,
    );

    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue("--bs-primary"),
      ).toBe("#ff0000");
      expect(
        document.documentElement.style.getPropertyValue("--bs-primary-rgb"),
      ).toBe("255, 0, 0");
      expect(
        document.documentElement.style.getPropertyValue("--bs-secondary"),
      ).toBe("#00ff00");
      expect(
        document.documentElement.style.getPropertyValue("--bs-secondary-rgb"),
      ).toBe("0, 255, 0");
    });
  });

  it("does not crash and keeps default CSS when fetch fails", async () => {
    getSettings.mockRejectedValue(new Error("Network error"));

    const { getByText } = render(
      <BrandingProvider>
        <span>fallback test</span>
      </BrandingProvider>,
    );

    // Children still render
    expect(getByText("fallback test")).toBeInTheDocument();

    // Wait for rejected promise to settle — CSS properties must remain unset
    await waitFor(
      () =>
        expect(
          document.documentElement.style.getPropertyValue("--bs-primary"),
        ).toBe(""),
      { timeout: 200 },
    );
  });
});
