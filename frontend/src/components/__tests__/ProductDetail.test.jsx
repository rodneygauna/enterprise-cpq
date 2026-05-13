/**
 * ProductDetail.test.jsx — Unit tests for the ProductDetail component (FR-PROD-10).
 *
 * Test coverage:
 *   - Identity: SKU omitted when not present; description omitted when empty
 *   - Pricing config: scopeBasedPricing omitted when "None"
 *   - Pricing details: basePrice only for Standard strategy
 *   - Pricing details: unitCost and implementationFee only when > 0
 *   - Pricing details: overagePrice only for "Per Unit / Transaction" and > 0
 *   - Tiers table: only rendered for Tiered strategy
 *   - Tiers table: accessible (<caption>, th scope="col")
 *   - Volume Bands table: only rendered for Volume Bands strategy
 *   - Volume Bands: null maxMembers shows "Unlimited"
 *   - Behavior flags: section omitted when all flags false
 *   - Behavior flags: isBaselineProduct shown only for Core type
 *   - Behavior flags: inheritTierVolumesFromCore shown only for Child type
 *   - Relationships: section omitted when empty
 *   - Relationships: compatibleCoreIds only shown for Child type
 *   - Relationships: IDs resolved to product names via allProducts
 */
import { render, screen, within } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";

vi.mock("bootstrap", () => ({ Tooltip: vi.fn(() => ({ dispose: vi.fn() })) }));

import ProductDetail from "../ProductDetail";

// ── Sample data ───────────────────────────────────────────────────────────────
const OTHER_PRODUCT = {
  _id: "core-1",
  name: "Core Platform",
  type: "Core",
};

const BASE_PRODUCT = {
  _id: "prod-1",
  name: "Test Product",
  sku: "TP-001",
  productLineId: null,
  type: "Core",
  pricingModel: "PMPM",
  pricingStrategy: "Standard",
  billingType: "Recurring (Monthly)",
  scopeBasedPricing: "None",
  basePrice: 10,
  unitCost: 0,
  implementationFee: 0,
  overagePrice: 0,
  tiers: [],
  volumeBands: [],
  isBaselineProduct: false,
  isQuantityBased: false,
  inheritTierVolumesFromCore: false,
  compatibleCoreIds: [],
  recommendedProductIds: [],
  description: "",
};

function renderDetail(productOverrides = {}, allProducts = [OTHER_PRODUCT]) {
  const product = { ...BASE_PRODUCT, ...productOverrides };
  return render(<ProductDetail product={product} allProducts={allProducts} />);
}

// ── Identity ──────────────────────────────────────────────────────────────────
describe("Identity section", () => {
  it("renders the SKU when present", () => {
    renderDetail({ sku: "TP-001" });
    expect(screen.getByText("TP-001")).toBeInTheDocument();
  });

  it("omits the SKU row when sku is falsy", () => {
    renderDetail({ sku: null });
    expect(screen.queryByText("SKU")).not.toBeInTheDocument();
  });

  it("omits the SKU row when sku is empty string", () => {
    renderDetail({ sku: "" });
    expect(screen.queryByText("SKU")).not.toBeInTheDocument();
  });

  it("renders description when non-empty", () => {
    renderDetail({ description: "A product description." });
    expect(screen.getByText("A product description.")).toBeInTheDocument();
  });

  it("omits description when empty string", () => {
    renderDetail({ description: "" });
    expect(screen.queryByText("Description")).not.toBeInTheDocument();
  });

  it("renders the product type", () => {
    renderDetail({ type: "Add-on" });
    expect(screen.getByText("Add-on")).toBeInTheDocument();
  });
});

// ── Pricing Configuration ─────────────────────────────────────────────────────
describe("Pricing configuration section", () => {
  it("always shows pricing model and strategy", () => {
    renderDetail({ pricingModel: "PMPM", pricingStrategy: "Standard" });
    expect(screen.getByText("PMPM")).toBeInTheDocument();
    expect(screen.getByText("Standard")).toBeInTheDocument();
  });

  it("omits Scope-Based Pricing row when value is 'None'", () => {
    renderDetail({ scopeBasedPricing: "None" });
    expect(screen.queryByText("Scope-Based Pricing")).not.toBeInTheDocument();
  });

  it("renders Scope-Based Pricing when value is not 'None'", () => {
    renderDetail({ scopeBasedPricing: "All" });
    expect(screen.getByText("All")).toBeInTheDocument();
  });
});

// ── Pricing Details ───────────────────────────────────────────────────────────
describe("Pricing details section", () => {
  it("renders base price for Standard strategy", () => {
    renderDetail({ pricingStrategy: "Standard", basePrice: 25.5 });
    expect(screen.getByText("$25.50")).toBeInTheDocument();
  });

  it("omits base price for Tiered strategy", () => {
    renderDetail({
      pricingStrategy: "Tiered",
      basePrice: 25.5,
      tiers: [{ min: 0, price: 10 }],
    });
    // $25.50 should not appear — tiers are shown instead
    expect(screen.queryByText("Base Price")).not.toBeInTheDocument();
  });

  it("renders unit cost only when > 0", () => {
    renderDetail({ unitCost: 3.5 });
    expect(screen.getByText("$3.50")).toBeInTheDocument();
  });

  it("omits unit cost when 0", () => {
    renderDetail({ unitCost: 0 });
    expect(screen.queryByText("Unit Cost")).not.toBeInTheDocument();
  });

  it("renders implementation fee only when > 0", () => {
    renderDetail({ implementationFee: 500 });
    expect(screen.getByText("$500.00")).toBeInTheDocument();
  });

  it("omits implementation fee when 0", () => {
    renderDetail({ implementationFee: 0 });
    expect(screen.queryByText("Impl. Fee")).not.toBeInTheDocument();
  });

  it("renders overage price only for Per Unit / Transaction model and > 0", () => {
    renderDetail({
      pricingModel: "Per Unit / Transaction",
      overagePrice: 1.25,
    });
    expect(screen.getByText("$1.25")).toBeInTheDocument();
  });

  it("omits overage price for other models even if > 0", () => {
    renderDetail({ pricingModel: "PMPM", overagePrice: 1.25 });
    expect(screen.queryByText("Overage Price")).not.toBeInTheDocument();
  });
});

// ── Tiers table ───────────────────────────────────────────────────────────────
describe("Tiers table", () => {
  const tieredProduct = {
    pricingStrategy: "Tiered",
    tiers: [
      { min: 0, price: 10 },
      { min: 500, price: 8 },
    ],
  };

  it("renders a table for Tiered strategy", () => {
    renderDetail(tieredProduct);
    const table = screen.getByRole("table", { name: /pricing tiers/i });
    expect(table).toBeInTheDocument();
  });

  it("renders a row for each tier", () => {
    renderDetail(tieredProduct);
    const table = screen.getByRole("table", { name: /pricing tiers/i });
    const rows = within(table).getAllByRole("row");
    // 1 header row + 2 data rows
    expect(rows).toHaveLength(3);
  });

  it("has column headers with scope='col'", () => {
    renderDetail(tieredProduct);
    const headers = screen.getAllByRole("columnheader");
    headers.forEach((th) => expect(th).toHaveAttribute("scope", "col"));
  });

  it("does not render tiers table for Standard strategy", () => {
    renderDetail({ pricingStrategy: "Standard", tiers: [] });
    expect(
      screen.queryByRole("table", { name: /pricing tiers/i }),
    ).not.toBeInTheDocument();
  });
});

// ── Volume Bands table ────────────────────────────────────────────────────────
describe("Volume Bands table", () => {
  const bandedProduct = {
    pricingStrategy: "Volume Bands",
    volumeBands: [
      { label: "Small", maxMembers: 500, price: 12, implPrice: 1000 },
      { label: "Large", maxMembers: null, price: 9, implPrice: 0 },
    ],
  };

  it("renders a table for Volume Bands strategy", () => {
    renderDetail(bandedProduct);
    expect(
      screen.getByRole("table", { name: /volume bands/i }),
    ).toBeInTheDocument();
  });

  it("renders a row for each band", () => {
    renderDetail(bandedProduct);
    const table = screen.getByRole("table", { name: /volume bands/i });
    const rows = within(table).getAllByRole("row");
    // 1 header row + 2 data rows
    expect(rows).toHaveLength(3);
  });

  it("shows 'Unlimited' when maxMembers is null", () => {
    renderDetail(bandedProduct);
    expect(screen.getByText("Unlimited")).toBeInTheDocument();
  });

  it("shows numeric value when maxMembers is defined", () => {
    renderDetail(bandedProduct);
    expect(screen.getByText("500")).toBeInTheDocument();
  });

  it("does not render volume bands table for Standard strategy", () => {
    renderDetail({ pricingStrategy: "Standard" });
    expect(
      screen.queryByRole("table", { name: /volume bands/i }),
    ).not.toBeInTheDocument();
  });
});

// ── Behavior Flags ────────────────────────────────────────────────────────────
describe("Behavior Flags section", () => {
  it("omits behavior flags section when all flags are false", () => {
    renderDetail({
      type: "Core",
      isBaselineProduct: false,
      isQuantityBased: false,
      inheritTierVolumesFromCore: false,
    });
    expect(screen.queryByText(/behavior flags/i)).not.toBeInTheDocument();
  });

  it("renders Quantity Based flag when true", () => {
    renderDetail({ isQuantityBased: true });
    expect(screen.getByText(/quantity based/i)).toBeInTheDocument();
  });

  it("renders Baseline Product flag for Core type when true", () => {
    renderDetail({ type: "Core", isBaselineProduct: true });
    expect(screen.getByText(/baseline product/i)).toBeInTheDocument();
  });

  it("omits Baseline Product flag for Add-on type", () => {
    renderDetail({ type: "Add-on", isBaselineProduct: true });
    expect(screen.queryByText(/baseline product/i)).not.toBeInTheDocument();
  });

  it("renders Inherit Tier Volumes flag for Child type when true", () => {
    renderDetail({ type: "Child", inheritTierVolumesFromCore: true });
    expect(
      screen.getByText(/inherits tier volumes from core/i),
    ).toBeInTheDocument();
  });

  it("omits Inherit Tier Volumes flag for Core type", () => {
    renderDetail({ type: "Core", inheritTierVolumesFromCore: true });
    expect(
      screen.queryByText(/inherits tier volumes/i),
    ).not.toBeInTheDocument();
  });
});

// ── Relationships ─────────────────────────────────────────────────────────────
describe("Relationships section", () => {
  it("omits Relationships section when no relationships exist", () => {
    renderDetail({ compatibleCoreIds: [], recommendedProductIds: [] });
    expect(screen.queryByText(/relationships/i)).not.toBeInTheDocument();
  });

  it("renders Compatible Core Products only for Child type", () => {
    renderDetail(
      {
        type: "Child",
        compatibleCoreIds: ["core-1"],
      },
      [OTHER_PRODUCT],
    );
    expect(screen.getByText(/compatible core products/i)).toBeInTheDocument();
  });

  it("omits Compatible Core Products for non-Child type", () => {
    renderDetail(
      {
        type: "Core",
        compatibleCoreIds: ["core-1"],
      },
      [OTHER_PRODUCT],
    );
    expect(
      screen.queryByText(/compatible core products/i),
    ).not.toBeInTheDocument();
  });

  it("resolves relationship ID to product name", () => {
    renderDetail(
      {
        type: "Child",
        compatibleCoreIds: ["core-1"],
      },
      [OTHER_PRODUCT],
    );
    expect(screen.getByText("Core Platform")).toBeInTheDocument();
  });

  it("renders Recommended Products for any type", () => {
    renderDetail({ type: "Core", recommendedProductIds: ["core-1"] }, [
      OTHER_PRODUCT,
    ]);
    expect(screen.getByText(/recommended products/i)).toBeInTheDocument();
    expect(screen.getByText("Core Platform")).toBeInTheDocument();
  });

  it("resolves populated object IDs (id field) as well as plain string IDs", () => {
    renderDetail(
      {
        type: "Core",
        recommendedProductIds: [{ _id: "core-1", name: "Core Platform" }],
      },
      [OTHER_PRODUCT],
    );
    expect(screen.getByText("Core Platform")).toBeInTheDocument();
  });
});
