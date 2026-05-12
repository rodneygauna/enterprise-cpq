/**
 * FieldHelp.test.jsx — Unit tests for the FieldHelp tooltip component.
 *
 * Bootstrap's Tooltip class requires a real DOM environment with pointer
 * events; in jsdom we mock it to test React rendering and lifecycle behaviour
 * without needing a full browser.
 */
import { render, screen, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ── Mock Bootstrap Tooltip ────────────────────────────────────────────────────
// vi.hoisted ensures these variables are initialised before the vi.mock factory
// runs (vi.mock calls are hoisted to the top of the file by Vitest).
const { disposeMock, TooltipConstructorMock } = vi.hoisted(() => {
  const disposeMock = vi.fn();
  const TooltipConstructorMock = vi.fn(() => ({ dispose: disposeMock }));
  return { disposeMock, TooltipConstructorMock };
});

vi.mock("bootstrap", () => ({
  Tooltip: TooltipConstructorMock,
}));

import FieldHelp from "../FieldHelp";

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderFieldHelp(props = {}) {
  const defaults = { text: "This is helper text." };
  return render(<FieldHelp {...defaults} {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("FieldHelp", () => {
  it("renders an info-circle icon button", () => {
    renderFieldHelp();
    const btn = screen.getByRole("button", { name: /help/i });
    expect(btn).toBeInTheDocument();
    expect(btn.querySelector(".bi-info-circle")).toBeInTheDocument();
  });

  it("button has type=button to prevent form submission", () => {
    renderFieldHelp();
    const btn = screen.getByRole("button", { name: /help/i });
    expect(btn).toHaveAttribute("type", "button");
  });

  it("renders a visually-hidden span with role=tooltip containing the text", () => {
    renderFieldHelp({ text: "Unit cost explanation." });
    const tip = screen.getByRole("tooltip");
    expect(tip).toBeInTheDocument();
    expect(tip).toHaveTextContent("Unit cost explanation.");
    expect(tip).toHaveClass("visually-hidden");
  });

  it("button's aria-describedby matches the tooltip span's id", () => {
    renderFieldHelp();
    const btn = screen.getByRole("button", { name: /help/i });
    const tip = screen.getByRole("tooltip");
    expect(btn).toHaveAttribute("aria-describedby", tip.id);
  });

  it("accepts an explicit id and uses it on the hidden span", () => {
    renderFieldHelp({ id: "my-tooltip-id" });
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveAttribute("id", "my-tooltip-id");
  });

  it("initialises Bootstrap Tooltip on mount", () => {
    renderFieldHelp({ text: "Some tooltip text.", placement: "bottom" });
    expect(TooltipConstructorMock).toHaveBeenCalledTimes(1);
    const [, opts] = TooltipConstructorMock.mock.calls[0];
    expect(opts.title).toBe("Some tooltip text.");
    expect(opts.placement).toBe("bottom");
    expect(opts.html).toBe(false);
  });

  it("disposes Bootstrap Tooltip on unmount", () => {
    const { unmount } = renderFieldHelp();
    unmount();
    expect(disposeMock).toHaveBeenCalledTimes(1);
  });

  it("defaults placement to top", () => {
    renderFieldHelp();
    const [, opts] = TooltipConstructorMock.mock.calls[0];
    expect(opts.placement).toBe("top");
  });

  it("icon has aria-hidden so screen readers skip the visual glyph", () => {
    renderFieldHelp();
    const icon = document.querySelector(".bi-info-circle");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("button is keyboard-focusable (tabIndex 0)", () => {
    renderFieldHelp();
    const btn = screen.getByRole("button", { name: /help/i });
    expect(btn).toHaveAttribute("tabindex", "0");
  });
});
