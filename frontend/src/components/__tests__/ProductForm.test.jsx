/**
 * ProductForm.test.jsx — Unit tests for the ProductForm 5-step wizard (FR-PROD-9 — FR-PROD-14).
 *
 * Test coverage:
 *   - Renders: form element with aria-label, step nav buttons
 *   - Add mode: starts at Step 1, steps 2-5 are disabled
 *   - Edit mode: all step nav buttons are enabled (maxStepReached=5)
 *   - Step navigation: Next advances step; Back retreats
 *   - Step navigation: step nav button jumps to navigable step
 *   - Step 1 validation: name required fires on Next click
 *   - Step 1 validation: SKU too long fires on Next click
 *   - Step 2: pricing strategy select is visible
 *   - Step 3: basePrice visible for Standard strategy
 *   - Step 3: TiersEditor visible for Tiered strategy
 *   - Step 3: VolumeBandsEditor visible for Volume Bands strategy
 *   - Step 3: live preview section has aria-live="polite"
 *   - Step 4: isBaselineProduct checkbox only for Core type
 *   - Step 4: inheritTierVolumesFromCore checkbox only for Child type
 *   - Step 5: compatibleCoreIds select only for Child type
 *   - Submit on Step 5: calls onSubmit with correct payload
 *   - Submit validation catches step-1 errors from step 5 (jumps back)
 *   - saving=true disables submit button
 *   - Cancel button calls onCancel
 */
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("bootstrap", () => ({ Tooltip: vi.fn(() => ({ dispose: vi.fn() })) }));

import ProductForm from "../ProductForm";

// ── Fixtures ──────────────────────────────────────────────────────────────────
const PRODUCT_LINES = [
  { _id: "line-1", name: "Care Management", displayColor: "#198754" },
];
const ALL_PRODUCTS = [
  { _id: "core-1", name: "Core Platform", type: "Core" },
  { _id: "child-1", name: "Child Module", type: "Child" },
];

const EMPTY_FORM = {
  name: "",
  sku: "",
  productLineId: "",
  type: "Core",
  pricingModel: "PMPM",
  pricingStrategy: "Standard",
  billingType: "Recurring (Monthly)",
  scopeBasedPricing: "None",
  basePrice: "",
  unitCost: "",
  implementationFee: "",
  overagePrice: "",
  isBaselineProduct: false,
  isQuantityBased: false,
  inheritTierVolumesFromCore: false,
  tiers: [],
  volumeBands: [],
  compatibleCoreIds: [],
  recommendedProductIds: [],
  description: "",
};

const FILLED_FORM = {
  ...EMPTY_FORM,
  name: "My Product",
  sku: "MP-001",
  type: "Core",
};

function renderForm(props = {}) {
  const defaults = {
    initialValues: { ...EMPTY_FORM },
    productLines: PRODUCT_LINES,
    allProducts: ALL_PRODUCTS,
    editingId: null,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    saving: false,
  };
  return render(<ProductForm {...defaults} {...props} />);
}

async function navigateToStep(user, form, targetStep) {
  for (let i = 1; i < targetStep; i++) {
    await user.click(within(form).getByRole("button", { name: /^next$/i }));
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Render ────────────────────────────────────────────────────────────────────
describe("ProductForm — render", () => {
  it("renders the form element with aria-label='Product form'", () => {
    renderForm();
    expect(
      screen.getByRole("form", { name: /product form/i }),
    ).toBeInTheDocument();
  });

  it("renders 5 step nav buttons", () => {
    renderForm();
    const form = screen.getByRole("form", { name: /product form/i });
    expect(
      within(form).getAllByRole("button", { name: /^step \d:/i }),
    ).toHaveLength(5);
  });

  it("shows Cancel button", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });
});

// ── Add mode initial state ─────────────────────────────────────────────────────
describe("ProductForm — add mode", () => {
  it("starts on Step 1 (Identity heading visible)", () => {
    renderForm();
    expect(
      screen.getByRole("heading", { name: /identity/i }),
    ).toBeInTheDocument();
  });

  it("step 1 nav button has aria-current='step'", () => {
    renderForm();
    const step1Btn = screen.getByRole("button", { name: /step 1: identity/i });
    expect(step1Btn).toHaveAttribute("aria-current", "step");
  });

  it("step nav buttons 2-5 are disabled in add mode initially", () => {
    renderForm();
    for (let i = 2; i <= 5; i++) {
      expect(
        screen.getByRole("button", { name: new RegExp(`step ${i}:`, "i") }),
      ).toBeDisabled();
    }
  });

  it("shows Next button on Step 1 (not Create Product)", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /^next$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /create product/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Back button only from Step 2 onwards", async () => {
    const user = userEvent.setup();
    renderForm({ initialValues: { ...FILLED_FORM } });
    expect(
      screen.queryByRole("button", { name: /back/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });
});

// ── Edit mode initial state ───────────────────────────────────────────────────
describe("ProductForm — edit mode", () => {
  it("all step nav buttons are enabled in edit mode", () => {
    renderForm({ editingId: "prod-1", initialValues: { ...FILLED_FORM } });
    for (let i = 1; i <= 5; i++) {
      expect(
        screen.getByRole("button", { name: new RegExp(`step ${i}:`, "i") }),
      ).not.toBeDisabled();
    }
  });

  it("pre-fills name from initialValues", () => {
    renderForm({ editingId: "prod-1", initialValues: { ...FILLED_FORM } });
    expect(screen.getByLabelText(/^name/i).value).toBe("My Product");
  });
});

// ── Step navigation ───────────────────────────────────────────────────────────
describe("ProductForm — step navigation", () => {
  it("Next advances from Step 1 to Step 2 when name is provided", async () => {
    const user = userEvent.setup();
    renderForm({ initialValues: { ...FILLED_FORM } });
    await user.click(screen.getByRole("button", { name: /^next$/i }));
    expect(
      screen.getByRole("heading", { name: /pricing configuration/i }),
    ).toBeInTheDocument();
  });

  it("Back retreats from Step 2 to Step 1", async () => {
    const user = userEvent.setup();
    renderForm({ initialValues: { ...FILLED_FORM } });
    await user.click(screen.getByRole("button", { name: /^next$/i })); // 1→2
    await user.click(screen.getByRole("button", { name: /back/i })); // 2→1
    expect(
      screen.getByRole("heading", { name: /identity/i }),
    ).toBeInTheDocument();
  });

  it("step nav button jumps to an already-navigated step", async () => {
    const user = userEvent.setup();
    renderForm({ initialValues: { ...FILLED_FORM } });
    await user.click(screen.getByRole("button", { name: /^next$/i })); // 1→2
    await user.click(screen.getByRole("button", { name: /step 1: identity/i })); // jump back to 1
    expect(
      screen.getByRole("heading", { name: /identity/i }),
    ).toBeInTheDocument();
  });

  it("step nav button to future step is enabled after reaching it", async () => {
    const user = userEvent.setup();
    renderForm({ initialValues: { ...FILLED_FORM } });
    await user.click(screen.getByRole("button", { name: /^next$/i })); // 1→2
    expect(
      screen.getByRole("button", { name: /step 2: pricing configuration/i }),
    ).not.toBeDisabled();
    // Step 3 still disabled
    expect(
      screen.getByRole("button", { name: /step 3: pricing details/i }),
    ).toBeDisabled();
  });

  it("shows Create Product on Step 5 in add mode", async () => {
    const user = userEvent.setup();
    const form = renderForm({
      initialValues: { ...FILLED_FORM },
    }).container.querySelector("form");
    await navigateToStep(user, form, 5);
    expect(
      screen.getByRole("button", { name: /create product/i }),
    ).toBeInTheDocument();
  });

  it("shows Save Changes on Step 5 in edit mode", async () => {
    const user = userEvent.setup();
    renderForm({ editingId: "prod-1", initialValues: { ...FILLED_FORM } });
    await user.click(
      screen.getByRole("button", { name: /step 5: relationships/i }),
    );
    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeInTheDocument();
  });
});

// ── Step 1 validation ─────────────────────────────────────────────────────────
describe("ProductForm — Step 1 validation", () => {
  it("shows name-required error when clicking Next with empty name", async () => {
    const user = userEvent.setup();
    renderForm({ initialValues: { ...EMPTY_FORM } });
    const form = screen.getByRole("form", { name: /product form/i });
    await user.clear(within(form).getByLabelText(/^name/i));
    await user.click(within(form).getByRole("button", { name: /^next$/i }));
    await waitFor(() =>
      expect(within(form).getByText(/name is required/i)).toBeInTheDocument(),
    );
  });

  it("does not advance to Step 2 when name is missing", async () => {
    const user = userEvent.setup();
    renderForm({ initialValues: { ...EMPTY_FORM } });
    await user.click(screen.getByRole("button", { name: /^next$/i }));
    expect(
      screen.getByRole("heading", { name: /identity/i }),
    ).toBeInTheDocument();
  });

  it("shows SKU-too-long error when SKU exceeds 100 chars", async () => {
    const user = userEvent.setup();
    renderForm({
      initialValues: {
        ...EMPTY_FORM,
        name: "Valid Name",
        sku: "X".repeat(101),
      },
    });
    await user.click(screen.getByRole("button", { name: /^next$/i }));
    await waitFor(() =>
      expect(screen.getByText(/100 characters or fewer/i)).toBeInTheDocument(),
    );
  });
});

// ── Step 2: Pricing Configuration ────────────────────────────────────────────
describe("ProductForm — Step 2: Pricing Configuration", () => {
  it("renders Pricing Strategy select on Step 2", async () => {
    const user = userEvent.setup();
    renderForm({ initialValues: { ...FILLED_FORM } });
    await user.click(screen.getByRole("button", { name: /^next$/i })); // 1→2
    expect(
      screen.getByRole("combobox", { name: /pricing strategy/i }),
    ).toBeInTheDocument();
  });

  it("changing Pricing Strategy updates form state", async () => {
    const user = userEvent.setup();
    renderForm({ initialValues: { ...FILLED_FORM } });
    await user.click(screen.getByRole("button", { name: /^next$/i })); // 1→2
    const select = screen.getByRole("combobox", { name: /pricing strategy/i });
    await user.selectOptions(select, "Tiered");
    expect(select.value).toBe("Tiered");
  });
});

// ── Step 3: Pricing Details ───────────────────────────────────────────────────
describe("ProductForm — Step 3: Pricing Details", () => {
  async function goToStep3(user, initialValues = FILLED_FORM) {
    renderForm({ initialValues: { ...initialValues } });
    const form = screen.getByRole("form", { name: /product form/i });
    await navigateToStep(user, form, 3);
  }

  it("renders Base Price field for Standard strategy", async () => {
    const user = userEvent.setup();
    await goToStep3(user, { ...FILLED_FORM, pricingStrategy: "Standard" });
    expect(
      screen.getByRole("spinbutton", { name: /base price/i }),
    ).toBeInTheDocument();
  });

  it("does not render Base Price field for Tiered strategy", async () => {
    const user = userEvent.setup();
    await goToStep3(user, { ...FILLED_FORM, pricingStrategy: "Tiered" });
    expect(
      screen.queryByRole("spinbutton", { name: /base price/i }),
    ).not.toBeInTheDocument();
  });

  it("renders TiersEditor for Tiered strategy", async () => {
    const user = userEvent.setup();
    await goToStep3(user, { ...FILLED_FORM, pricingStrategy: "Tiered" });
    const form = screen.getByRole("form", { name: /product form/i });
    expect(
      within(form).getByRole("group", { name: /tiers/i }),
    ).toBeInTheDocument();
  });

  it("renders VolumeBandsEditor for Volume Bands strategy", async () => {
    const user = userEvent.setup();
    await goToStep3(user, { ...FILLED_FORM, pricingStrategy: "Volume Bands" });
    const form = screen.getByRole("form", { name: /product form/i });
    expect(
      within(form).getByRole("group", { name: /volume bands/i }),
    ).toBeInTheDocument();
  });

  it("live preview section has aria-live='polite'", async () => {
    const user = userEvent.setup();
    await goToStep3(user);
    const preview = screen.getByRole("region", { name: /live price preview/i });
    expect(preview).toHaveAttribute("aria-live", "polite");
  });

  it("live preview section has aria-atomic='true'", async () => {
    const user = userEvent.setup();
    await goToStep3(user);
    const preview = screen.getByRole("region", { name: /live price preview/i });
    expect(preview).toHaveAttribute("aria-atomic", "true");
  });
});

// ── Step 4: Behavior Flags ────────────────────────────────────────────────────
describe("ProductForm — Step 4: Behavior Flags", () => {
  async function goToStep4(user, initialValues = FILLED_FORM) {
    renderForm({ initialValues: { ...initialValues } });
    const form = screen.getByRole("form", { name: /product form/i });
    await navigateToStep(user, form, 4);
  }

  it("always shows Quantity Based checkbox", async () => {
    const user = userEvent.setup();
    await goToStep4(user, { ...FILLED_FORM, type: "Core" });
    expect(
      screen.getByRole("checkbox", { name: /quantity based/i }),
    ).toBeInTheDocument();
  });

  it("shows Baseline Product checkbox for Core type", async () => {
    const user = userEvent.setup();
    await goToStep4(user, { ...FILLED_FORM, type: "Core" });
    expect(
      screen.getByRole("checkbox", { name: /baseline product/i }),
    ).toBeInTheDocument();
  });

  it("omits Baseline Product checkbox for Add-on type", async () => {
    const user = userEvent.setup();
    await goToStep4(user, { ...FILLED_FORM, type: "Add-on" });
    expect(
      screen.queryByRole("checkbox", { name: /baseline product/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Inherit Tier Volumes checkbox for Child type", async () => {
    const user = userEvent.setup();
    await goToStep4(user, { ...FILLED_FORM, type: "Child" });
    expect(
      screen.getByRole("checkbox", { name: /inherit tier volumes from core/i }),
    ).toBeInTheDocument();
  });

  it("omits Inherit Tier Volumes checkbox for Core type", async () => {
    const user = userEvent.setup();
    await goToStep4(user, { ...FILLED_FORM, type: "Core" });
    expect(
      screen.queryByRole("checkbox", {
        name: /inherit tier volumes from core/i,
      }),
    ).not.toBeInTheDocument();
  });
});

// ── Step 5: Relationships ─────────────────────────────────────────────────────
describe("ProductForm — Step 5: Relationships", () => {
  async function goToStep5(user, initialValues = FILLED_FORM) {
    renderForm({ initialValues: { ...initialValues } });
    const form = screen.getByRole("form", { name: /product form/i });
    await navigateToStep(user, form, 5);
  }

  it("shows Compatible Core Products select for Child type", async () => {
    const user = userEvent.setup();
    await goToStep5(user, { ...FILLED_FORM, type: "Child" });
    expect(
      screen.getByRole("listbox", { name: /compatible core products/i }),
    ).toBeInTheDocument();
  });

  it("omits Compatible Core Products select for Core type", async () => {
    const user = userEvent.setup();
    await goToStep5(user, { ...FILLED_FORM, type: "Core" });
    expect(
      screen.queryByRole("listbox", { name: /compatible core products/i }),
    ).not.toBeInTheDocument();
  });

  it("always shows Recommended Products select", async () => {
    const user = userEvent.setup();
    await goToStep5(user, { ...FILLED_FORM, type: "Core" });
    expect(
      screen.getByRole("listbox", { name: /recommended products/i }),
    ).toBeInTheDocument();
  });
});

// ── Submit ────────────────────────────────────────────────────────────────────
describe("ProductForm — submit", () => {
  it("calls onSubmit with payload on Step 5 when valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm({ initialValues: { ...FILLED_FORM }, onSubmit });
    const form = screen.getByRole("form", { name: /product form/i });
    await navigateToStep(user, form, 5);
    await user.click(
      within(form).getByRole("button", { name: /create product/i }),
    );
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "My Product" }),
    );
  });

  it("does not call onSubmit when name is empty (validates all steps)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    // In edit mode we can jump to step 5 even with empty name
    renderForm({
      editingId: "prod-1",
      initialValues: { ...EMPTY_FORM },
      onSubmit,
    });
    await user.click(
      screen.getByRole("button", { name: /step 5: relationships/i }),
    );
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    // Should jump back to Step 1 where name error is
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /identity/i }),
      ).toBeInTheDocument(),
    );
  });

  it("disables submit button when saving=true", async () => {
    const user = userEvent.setup();
    renderForm({
      editingId: "prod-1",
      initialValues: { ...FILLED_FORM },
      saving: true,
    });
    await user.click(
      screen.getByRole("button", { name: /step 5: relationships/i }),
    );
    const submitBtn = screen.getByRole("button", {
      name: /save changes|saving/i,
    });
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveAttribute("aria-busy", "true");
  });
});

// ── Cancel ────────────────────────────────────────────────────────────────────
describe("ProductForm — cancel", () => {
  it("calls onCancel when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderForm({ onCancel });
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
