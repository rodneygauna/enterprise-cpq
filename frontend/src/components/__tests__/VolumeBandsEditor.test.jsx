/**
 * VolumeBandsEditor.test.jsx — Unit tests for the VolumeBandsEditor component (FR-PROD-13).
 *
 * Test coverage:
 *   - Empty state: shows guidance text when no bands
 *   - Add band: "Add Band" button appends an empty band via onChange
 *   - Remove band: "Remove band N" button splices that band via onChange
 *   - Band field changes: label, maxMembers, price, implPrice update via onChange
 *   - Null maxMembers: blank input stays blank (renders as "")
 *   - Max members error: bandErrors key `volumeBands_maxMembers_${i}` shown as alert
 *   - Overall error: error prop renders an accessible alert
 *   - Accessibility: fieldset/legend structure, labeled inputs
 */
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("bootstrap", () => ({ Tooltip: vi.fn(() => ({ dispose: vi.fn() })) }));

import VolumeBandsEditor from "../VolumeBandsEditor";

const BAND_ONE = {
  label: "Small",
  maxMembers: "500",
  price: "12.00",
  implPrice: "1000",
};
const BAND_TWO = {
  label: "Large",
  maxMembers: "",
  price: "9.00",
  implPrice: "",
};

function renderEditor(props = {}) {
  const defaults = {
    bands: [],
    onChange: vi.fn(),
    error: undefined,
    bandErrors: {},
  };
  return render(<VolumeBandsEditor {...defaults} {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VolumeBandsEditor — empty state", () => {
  it("renders a fieldset with legend 'Volume Bands'", () => {
    renderEditor();
    expect(
      screen.getByRole("group", { name: /volume bands/i }),
    ).toBeInTheDocument();
  });

  it("shows guidance text when bands array is empty", () => {
    renderEditor();
    expect(screen.getByText(/no bands defined/i)).toBeInTheDocument();
  });

  it("renders the Add Band button", () => {
    renderEditor();
    expect(
      screen.getByRole("button", { name: /add band/i }),
    ).toBeInTheDocument();
  });
});

describe("VolumeBandsEditor — add band", () => {
  it("calls onChange with an appended empty band when Add Band is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderEditor({ bands: [], onChange });
    await user.click(screen.getByRole("button", { name: /add band/i }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith([
      { label: "", maxMembers: "", price: "", implPrice: "" },
    ]);
  });

  it("appends to an existing list", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderEditor({ bands: [BAND_ONE], onChange });
    await user.click(screen.getByRole("button", { name: /add band/i }));
    expect(onChange).toHaveBeenCalledWith([
      BAND_ONE,
      { label: "", maxMembers: "", price: "", implPrice: "" },
    ]);
  });
});

describe("VolumeBandsEditor — remove band", () => {
  it("calls onChange without the removed band", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderEditor({ bands: [BAND_ONE, BAND_TWO], onChange });
    await user.click(screen.getByRole("button", { name: /remove band 1/i }));
    expect(onChange).toHaveBeenCalledWith([BAND_TWO]);
  });

  it("removes the second band when its Remove button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderEditor({ bands: [BAND_ONE, BAND_TWO], onChange });
    await user.click(screen.getByRole("button", { name: /remove band 2/i }));
    expect(onChange).toHaveBeenCalledWith([BAND_ONE]);
  });
});

describe("VolumeBandsEditor — band field changes", () => {
  it("calls onChange with updated label", () => {
    const onChange = vi.fn();
    renderEditor({ bands: [BAND_ONE], onChange });
    const labelInput = screen.getByLabelText(/^label$/i);
    fireEvent.change(labelInput, { target: { value: "Medium" } });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ label: "Medium" }),
    ]);
  });

  it("calls onChange with updated price", () => {
    const onChange = vi.fn();
    renderEditor({ bands: [BAND_ONE], onChange });
    const priceInput = screen.getByLabelText(/^price$/i);
    fireEvent.change(priceInput, { target: { value: "7" } });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ price: "7" }),
    ]);
  });

  it("leaves maxMembers blank (empty string) when not provided", () => {
    renderEditor({ bands: [BAND_TWO] });
    const maxInput = screen.getByLabelText(/max members/i);
    expect(maxInput.value).toBe("");
  });
});

describe("VolumeBandsEditor — validation errors", () => {
  it("renders overall error as an alert", () => {
    renderEditor({ error: "At least one band is required." });
    expect(screen.getByRole("alert")).toHaveTextContent(
      /at least one band is required/i,
    );
  });

  it("does not render overall alert when error is undefined", () => {
    renderEditor({ bands: [] });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders per-band maxMembers error as an alert", () => {
    const bandErrors = {
      volumeBands_maxMembers_0:
        "Maximum members must be a positive whole number.",
    };
    renderEditor({ bands: [BAND_ONE], bandErrors });
    expect(screen.getByRole("alert")).toHaveTextContent(
      /positive whole number/i,
    );
  });

  it("applies is-invalid class to the errored maxMembers input", () => {
    const bandErrors = {
      volumeBands_maxMembers_0: "Invalid",
    };
    renderEditor({ bands: [BAND_ONE], bandErrors });
    const maxInput = screen.getByLabelText(/max members/i);
    expect(maxInput).toHaveClass("is-invalid");
  });
});

describe("VolumeBandsEditor — accessibility", () => {
  it("does not show guidance text when bands exist", () => {
    renderEditor({ bands: [BAND_ONE] });
    expect(screen.queryByText(/no bands defined/i)).not.toBeInTheDocument();
  });

  it("has accessible Remove buttons for each band", () => {
    renderEditor({ bands: [BAND_ONE, BAND_TWO] });
    expect(
      screen.getByRole("button", { name: /remove band 1/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove band 2/i }),
    ).toBeInTheDocument();
  });
});
