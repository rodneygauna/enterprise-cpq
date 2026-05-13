/**
 * TiersEditor.test.jsx — Unit tests for the TiersEditor component (FR-PROD-13).
 *
 * Test coverage:
 *   - Empty state: shows guidance text when no tiers
 *   - Add tier: "Add Tier" button appends a tier via onChange
 *   - Remove tier: "Remove tier N" button splices that tier via onChange
 *   - Tier input changes: editing min or price calls onChange with updated value
 *   - Validation error: error prop renders an accessible alert
 *   - Accessibility: fieldset/legend structure, aria-labels on inputs
 */
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("bootstrap", () => ({ Tooltip: vi.fn(() => ({ dispose: vi.fn() })) }));

import TiersEditor from "../TiersEditor";

const TIERS_ONE = [{ min: "0", price: "10.00" }];
const TIERS_TWO = [
  { min: "0", price: "10.00" },
  { min: "1000", price: "8.00" },
];

function renderEditor(props = {}) {
  const defaults = {
    tiers: [],
    onChange: vi.fn(),
    error: undefined,
  };
  return render(<TiersEditor {...defaults} {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TiersEditor — empty state", () => {
  it("renders a fieldset with legend 'Tiers'", () => {
    renderEditor();
    expect(screen.getByRole("group", { name: /tiers/i })).toBeInTheDocument();
  });

  it("shows guidance text when tiers array is empty", () => {
    renderEditor();
    expect(screen.getByText(/no tiers defined/i)).toBeInTheDocument();
  });

  it("renders the Add Tier button", () => {
    renderEditor();
    expect(
      screen.getByRole("button", { name: /add tier/i }),
    ).toBeInTheDocument();
  });
});

describe("TiersEditor — add tier", () => {
  it("calls onChange with an appended empty tier when Add Tier is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderEditor({ tiers: [], onChange });
    await user.click(screen.getByRole("button", { name: /add tier/i }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith([{ min: "", price: "" }]);
  });

  it("appends to an existing list", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderEditor({ tiers: TIERS_ONE, onChange });
    await user.click(screen.getByRole("button", { name: /add tier/i }));
    expect(onChange).toHaveBeenCalledWith([
      ...TIERS_ONE,
      { min: "", price: "" },
    ]);
  });
});

describe("TiersEditor — remove tier", () => {
  it("calls onChange without the removed tier when Remove is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderEditor({ tiers: TIERS_TWO, onChange });
    await user.click(screen.getByRole("button", { name: /remove tier 1/i }));
    expect(onChange).toHaveBeenCalledWith([TIERS_TWO[1]]);
  });

  it("removes the second tier when its Remove button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderEditor({ tiers: TIERS_TWO, onChange });
    await user.click(screen.getByRole("button", { name: /remove tier 2/i }));
    expect(onChange).toHaveBeenCalledWith([TIERS_TWO[0]]);
  });
});

describe("TiersEditor — editing tier inputs", () => {
  it("calls onChange with updated min value when edited", () => {
    const onChange = vi.fn();
    renderEditor({ tiers: TIERS_ONE, onChange });
    const minInput = screen.getByRole("spinbutton", {
      name: /tier 1 minimum volume/i,
    });
    fireEvent.change(minInput, { target: { value: "500" } });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ min: "500" }),
    ]);
  });

  it("calls onChange with updated price value when edited", () => {
    const onChange = vi.fn();
    renderEditor({ tiers: TIERS_ONE, onChange });
    const priceInput = screen.getByRole("spinbutton", {
      name: /tier 1 price/i,
    });
    fireEvent.change(priceInput, { target: { value: "7.50" } });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ price: "7.50" }),
    ]);
  });
});

describe("TiersEditor — validation error", () => {
  it("renders the error message as an alert", () => {
    renderEditor({ error: "At least one tier is required." });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/at least one tier is required/i);
  });

  it("does not render an alert when error prop is undefined", () => {
    renderEditor({ error: undefined });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("TiersEditor — accessibility", () => {
  it("renders labeled inputs for each tier", () => {
    renderEditor({ tiers: TIERS_TWO });
    expect(
      screen.getByRole("spinbutton", { name: /tier 1 minimum volume/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: /tier 2 minimum volume/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: /tier 1 price/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: /tier 2 price/i }),
    ).toBeInTheDocument();
  });

  it("has accessible Remove buttons for each tier", () => {
    renderEditor({ tiers: TIERS_TWO });
    expect(
      screen.getByRole("button", { name: /remove tier 1/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove tier 2/i }),
    ).toBeInTheDocument();
  });

  it("does not show guidance text when tiers exist", () => {
    renderEditor({ tiers: TIERS_ONE });
    expect(screen.queryByText(/no tiers defined/i)).not.toBeInTheDocument();
  });
});
