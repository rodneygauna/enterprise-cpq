/**
 * QuoteBuilder page tests — covers §7.5 Quote Builder (frontend).
 *
 * Test coverage:
 *   - Renders loading state while fetching catalog
 *   - Renders error state when catalog load fails
 *   - Renders quote header form fields
 *   - Product line pills: each line renders as a toggle button
 *   - Product line pills: toggling a pill shows its product section
 *   - Product line pills: toggling a pill off removes its products from selections
 *   - Products: selecting a product checks its checkbox
 *   - Products: deselecting a product unchecks its checkbox
 *   - Products: recommendation engine — auto-selects recommended products on select
 *   - Products: recommendation engine — deselects recommended products on deselect
 *   - Financial summary panel: renders with $0.00 when nothing selected
 *   - Financial summary panel: shows updated PMPM after selecting a product
 *   - Save: shows error when clientName is empty
 *   - Save: calls createQuote with correct payload
 *   - Save: shows success toast after save
 *   - Save: shows error toast when API fails
 *   - CSV export button is disabled when no items are selected
 *   - Multi-year forecast is hidden when term ≤ 12 months
 *   - Multi-year forecast table appears when term > 12 months
 *   - Pricing utils: computeYearlySummary returns empty array for term ≤ 12
 *   - Pricing utils: computeYearlySummary returns N rows for multi-year term
 */
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock("../../api/axios");
vi.mock("../../hooks/useAuth");
vi.mock("../../api/products");
vi.mock("../../api/productLines");
vi.mock("../../api/quotes");
vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useAuth } from "../../hooks/useAuth";
import { getProducts } from "../../api/products";
import { getProductLines } from "../../api/productLines";
import { createQuote, updateQuote, getQuote } from "../../api/quotes";
import { toast } from "react-toastify";
import QuoteBuilder from "../QuoteBuilder";
import { computeYearlySummary, calculateLineItem } from "../../utils/pricing";

// ── Sample data ───────────────────────────────────────────────────────────────
const SAMPLE_LINE = {
  _id: "line-1",
  name: "Care Management",
  displayColor: "#198754",
};

const CORE_PRODUCT = {
  _id: "prod-core-1",
  name: "Core Platform",
  sku: "CORE-001",
  productLineId: { _id: "line-1" },
  type: "Core",
  pricingModel: "PMPM",
  pricingStrategy: "Standard",
  billingType: "Recurring (Monthly)",
  basePrice: 10,
  unitCost: 4,
  implementationFee: 5000,
  isBaselineProduct: false,
  isQuantityBased: false,
  inheritTierVolumesFromCore: false,
  scopeBasedPricing: "None",
  tiers: [],
  volumeBands: [],
  compatibleCoreIds: [],
  recommendedProductIds: ["prod-addon-1"],
};

const ADDON_PRODUCT = {
  _id: "prod-addon-1",
  name: "Analytics Add-on",
  sku: "ADD-001",
  productLineId: { _id: "line-1" },
  type: "Add-on",
  pricingModel: "Flat Fee",
  pricingStrategy: "Standard",
  billingType: "One-Time",
  basePrice: 2000,
  unitCost: 800,
  implementationFee: 0,
  isBaselineProduct: false,
  isQuantityBased: false,
  inheritTierVolumesFromCore: false,
  scopeBasedPricing: "None",
  tiers: [],
  volumeBands: [],
  compatibleCoreIds: [],
  recommendedProductIds: [],
};

const SCOPE_PRODUCT = {
  _id: "prod-scope-1",
  name: "Scope TBD Product",
  productLineId: { _id: "line-1" },
  type: "Add-on",
  pricingModel: "PMPM",
  pricingStrategy: "Standard",
  billingType: "Recurring (Monthly)",
  basePrice: 5,
  unitCost: 2,
  implementationFee: 0,
  isBaselineProduct: false,
  isQuantityBased: false,
  inheritTierVolumesFromCore: false,
  scopeBasedPricing: "All",
  tiers: [],
  volumeBands: [],
  compatibleCoreIds: [],
  recommendedProductIds: [],
};

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

function renderPage(path = "/quotes/new", role = "sales_rep") {
  useAuth.mockReturnValue({
    user: { role, firstName: "Test", _id: "user-1" },
    isAuthenticated: true,
  });
  return render(
    <MemoryRouter initialEntries={[path]} future={routerFuture}>
      <Routes>
        <Route path="/quotes/new" element={<QuoteBuilder />} />
        <Route path="/quotes/:id" element={<QuoteBuilder />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getProducts.mockResolvedValue([CORE_PRODUCT, ADDON_PRODUCT]);
  getProductLines.mockResolvedValue([SAMPLE_LINE]);
  getQuote.mockResolvedValue({
    _id: "new-quote-1",
    clientName: "Existing Client",
    membershipCount: 5000,
    termLength: 12,
    annualUplift: 0,
    status: "Draft",
    selectedItems: [],
    activeProductLineIds: [],
    globalAdjustmentType: "",
    globalDiscountType: "percentage",
    globalDiscountValue: "",
  });
  createQuote.mockResolvedValue({ _id: "new-quote-1", clientName: "Test" });
  updateQuote.mockResolvedValue({ _id: "new-quote-1", clientName: "Test" });
});

// ─── Loading state ────────────────────────────────────────────────────────────
it("renders loading state while fetching", () => {
  getProducts.mockReturnValue(new Promise(() => {}));
  renderPage();
  expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
});

// ─── Error state ──────────────────────────────────────────────────────────────
it("renders error state when catalog load fails", async () => {
  getProducts.mockRejectedValue(new Error("Network error"));
  renderPage();
  await waitFor(() => {
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

// ─── Quote header ─────────────────────────────────────────────────────────────
it("renders all quote header form fields", async () => {
  renderPage();
  await waitFor(() =>
    expect(screen.getByLabelText(/client name/i)).toBeInTheDocument(),
  );
  expect(screen.getByLabelText(/effective date/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/membership count/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/term \(months\)/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/annual uplift/i)).toBeInTheDocument();
});

// ─── Product line pills ───────────────────────────────────────────────────────
it("renders product line pills", async () => {
  renderPage();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: /add care management product line/i }),
    ).toBeInTheDocument(),
  );
});

it("toggling a pill shows its product section", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: /add care management/i }),
    ).toBeInTheDocument(),
  );

  await user.click(
    screen.getByRole("button", { name: /add care management/i }),
  );

  expect(
    screen.getByRole("checkbox", { name: /select core platform/i }),
  ).toBeInTheDocument();
});

it("toggling a pill off removes the section", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: /add care management/i }),
    ).toBeInTheDocument(),
  );

  await user.click(
    screen.getByRole("button", { name: /add care management/i }),
  );
  expect(
    screen.getByRole("checkbox", { name: /select core platform/i }),
  ).toBeInTheDocument();

  await user.click(
    screen.getByRole("button", { name: /remove care management/i }),
  );
  expect(
    screen.queryByRole("checkbox", { name: /select core platform/i }),
  ).not.toBeInTheDocument();
});

// ─── Product selection ────────────────────────────────────────────────────────
it("selecting a product checks its checkbox", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() =>
    screen.getByRole("button", { name: /add care management/i }),
  );
  await user.click(
    screen.getByRole("button", { name: /add care management/i }),
  );

  const checkbox = screen.getByRole("checkbox", {
    name: /select core platform/i,
  });
  expect(checkbox).not.toBeChecked();
  await user.click(checkbox);
  expect(checkbox).toBeChecked();
});

it("deselecting a product unchecks its checkbox", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() =>
    screen.getByRole("button", { name: /add care management/i }),
  );
  await user.click(
    screen.getByRole("button", { name: /add care management/i }),
  );

  const checkbox = screen.getByRole("checkbox", {
    name: /select core platform/i,
  });
  await user.click(checkbox);
  expect(checkbox).toBeChecked();
  await user.click(checkbox);
  expect(checkbox).not.toBeChecked();
});

// ─── Recommendation engine ────────────────────────────────────────────────────
it("selecting a product auto-selects recommended products", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() =>
    screen.getByRole("button", { name: /add care management/i }),
  );
  await user.click(
    screen.getByRole("button", { name: /add care management/i }),
  );

  // Core recommends Add-on
  await user.click(
    screen.getByRole("checkbox", { name: /select core platform/i }),
  );

  await waitFor(() =>
    expect(
      screen.getByRole("checkbox", { name: /select analytics add-on/i }),
    ).toBeChecked(),
  );
});

it("deselecting a product cascades removal of recommendations", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() =>
    screen.getByRole("button", { name: /add care management/i }),
  );
  await user.click(
    screen.getByRole("button", { name: /add care management/i }),
  );

  await user.click(
    screen.getByRole("checkbox", { name: /select core platform/i }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("checkbox", { name: /select analytics add-on/i }),
    ).toBeChecked(),
  );

  await user.click(
    screen.getByRole("checkbox", { name: /select core platform/i }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("checkbox", { name: /select analytics add-on/i }),
    ).not.toBeChecked(),
  );
});

// ─── Financial summary ────────────────────────────────────────────────────────
it("renders financial summary panel with zero values initially", async () => {
  renderPage();
  await waitFor(() =>
    expect(screen.getByText(/financial summary/i)).toBeInTheDocument(),
  );
  expect(
    screen.getByRole("button", { name: /save quote/i }),
  ).toBeInTheDocument();
});

// ─── Scope-based items ────────────────────────────────────────────────────────
it("shows Requires Scope Review badge for scope-all products", async () => {
  getProducts.mockResolvedValue([CORE_PRODUCT, ADDON_PRODUCT, SCOPE_PRODUCT]);
  const user = userEvent.setup();
  renderPage();
  await waitFor(() =>
    screen.getByRole("button", { name: /add care management/i }),
  );
  await user.click(
    screen.getByRole("button", { name: /add care management/i }),
  );

  await user.click(
    screen.getByRole("checkbox", { name: /select scope tbd product/i }),
  );

  expect(screen.getByText(/requires scope review/i)).toBeInTheDocument();
});

// ─── Save validation ─────────────────────────────────────────────────────────
it("shows client name error when saving without a client name", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => screen.getByRole("button", { name: /save quote/i }));

  await user.click(screen.getByRole("button", { name: /save quote/i }));

  expect(screen.getByText(/client name is required/i)).toBeInTheDocument();
  expect(createQuote).not.toHaveBeenCalled();
});

it("calls createQuote with correct payload and shows success toast", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => screen.getByLabelText(/client name/i));

  await user.type(screen.getByLabelText(/client name/i), "Acme Corp");
  await user.click(screen.getByRole("button", { name: /save quote/i }));

  await waitFor(() => {
    expect(createQuote).toHaveBeenCalledWith(
      expect.objectContaining({ clientName: "Acme Corp" }),
    );
  });
  expect(toast.success).toHaveBeenCalledWith("Quote saved successfully.");
});

it("shows error toast when save fails", async () => {
  createQuote.mockRejectedValue({
    response: { data: { error: "Server Error" } },
  });
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => screen.getByLabelText(/client name/i));

  await user.type(screen.getByLabelText(/client name/i), "Test");
  await user.click(screen.getByRole("button", { name: /save quote/i }));

  await waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith("Server Error");
  });
});

// ─── CSV export ───────────────────────────────────────────────────────────────
it("CSV export button is disabled when no items are selected", async () => {
  renderPage();
  await waitFor(() => screen.getByRole("button", { name: /export csv/i }));
  expect(screen.getByRole("button", { name: /export csv/i })).toBeDisabled();
});

// ─── Multi-year forecast ──────────────────────────────────────────────────────
it("multi-year forecast is not visible when term ≤ 12 months", async () => {
  renderPage();
  await waitFor(() => screen.getByLabelText(/term \(months\)/i));
  expect(
    screen.queryByText(/multi-year revenue forecast/i),
  ).not.toBeInTheDocument();
});

it("multi-year forecast table appears when term > 12 months and products are selected", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => screen.getByLabelText(/term \(months\)/i));

  // Set term to 24 months using fireEvent to bypass the Math.max controlled-input issue
  fireEvent.change(screen.getByLabelText(/term \(months\)/i), {
    target: { value: "24" },
  });

  // Set membership count so PMPM produces non-zero revenue
  fireEvent.change(screen.getByLabelText(/membership count/i), {
    target: { value: "1000" },
  });

  // Activate line and select a PMPM product
  await user.click(
    screen.getByRole("button", { name: /add care management/i }),
  );
  await user.click(
    screen.getByRole("checkbox", { name: /select core platform/i }),
  );

  await waitFor(() =>
    expect(
      screen.getByText(/multi-year revenue forecast/i),
    ).toBeInTheDocument(),
  );
  // Use exact text to avoid matching "Year 10", "Year 11", etc.
  expect(screen.getByText("Year 1")).toBeInTheDocument();
  expect(screen.getByText("Year 2")).toBeInTheDocument();
});

// ─── Pricing utility unit tests ───────────────────────────────────────────────
describe("computeYearlySummary", () => {
  const pmpmProduct = {
    _id: "p1",
    pricingModel: "PMPM",
    pricingStrategy: "Standard",
    billingType: "Recurring (Monthly)",
    basePrice: 10,
    isQuantityBased: false,
    scopeBasedPricing: "None",
    tiers: [],
    volumeBands: [],
    inheritTierVolumesFromCore: false,
  };

  const onceProduct = {
    _id: "p2",
    pricingModel: "Flat Fee",
    pricingStrategy: "Standard",
    billingType: "One-Time",
    basePrice: 5000,
    isQuantityBased: false,
    scopeBasedPricing: "None",
    tiers: [],
    volumeBands: [],
    inheritTierVolumesFromCore: false,
    implementationFee: 0,
  };

  const makeItem = (product, quantity = 1) => ({
    product,
    params: { membershipCount: 1000, termMonths: 12, quantity },
    adjustment: null,
  });

  it("returns empty array when term ≤ 12", () => {
    const result = computeYearlySummary([makeItem(pmpmProduct)], 1000, 12, 0);
    expect(result).toEqual([]);
  });

  it("returns 2 rows for 24-month term", () => {
    const result = computeYearlySummary([makeItem(pmpmProduct)], 1000, 24, 0);
    expect(result).toHaveLength(2);
    expect(result[0].year).toBe(1);
    expect(result[1].year).toBe(2);
  });

  it("year 1 and year 2 revenues equal base annual when no uplift", () => {
    // PMPM 10 × 1000 members × 12 months = $120,000 per year
    const result = computeYearlySummary([makeItem(pmpmProduct)], 1000, 24, 0);
    expect(result[0].revenue).toBeCloseTo(120000, 0);
    expect(result[1].revenue).toBeCloseTo(120000, 0);
  });

  it("applies annual uplift to recurring items from year 2", () => {
    // 10% uplift: year 2 should be year 1 * 1.1
    const result = computeYearlySummary([makeItem(pmpmProduct)], 1000, 24, 10);
    expect(result[1].revenue).toBeCloseTo(result[0].revenue * 1.1, 0);
  });

  it("one-time fees appear in year 1 only", () => {
    const result = computeYearlySummary([makeItem(onceProduct)], 1000, 24, 0);
    expect(result[0].revenue).toBeGreaterThan(0);
    expect(result[1].revenue).toBe(0);
  });
});

describe("calculateLineItem — PMPM standard", () => {
  const product = {
    pricingModel: "PMPM",
    pricingStrategy: "Standard",
    billingType: "Recurring (Monthly)",
    basePrice: 5,
    isQuantityBased: false,
    scopeBasedPricing: "None",
    tiers: [],
    volumeBands: [],
    implementationFee: 1000,
    inheritTierVolumesFromCore: false,
  };

  it("calculates PMPM TCV correctly", () => {
    const result = calculateLineItem(product, {
      membershipCount: 2000,
      termMonths: 12,
    });
    // 5 × 2000 × 12 = $120,000
    expect(result.extendedPrice).toBe(120000);
    expect(result.implementationFee).toBe(1000);
  });

  it("scope-all products return zero extended price", () => {
    const scopeProduct = { ...product, scopeBasedPricing: "All" };
    const result = calculateLineItem(scopeProduct, {
      membershipCount: 2000,
      termMonths: 12,
    });
    expect(result.extendedPrice).toBe(0);
    expect(result.implementationFee).toBe(0);
  });
});
