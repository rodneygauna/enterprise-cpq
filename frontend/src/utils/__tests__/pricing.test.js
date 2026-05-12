/**
 * Frontend pricing util tests — mirrors backend/src/utils/__tests__/pricing.test.js
 * Verifies the ES module version produces identical results.
 */

import {
  resolveTieredPrice,
  resolveVolumeBand,
  calculateLineItem,
  applyLineItemAdjustment,
} from "../pricing";

describe("resolveTieredPrice", () => {
  const tiers = [
    { min: 0, price: 10 },
    { min: 1000, price: 8 },
    { min: 5000, price: 6 },
  ];

  it("returns lowest tier for volume at 0", () =>
    expect(resolveTieredPrice(tiers, 0)).toBe(10));
  it("returns correct tier at boundary", () =>
    expect(resolveTieredPrice(tiers, 1000)).toBe(8));
  it("returns highest tier above boundary", () =>
    expect(resolveTieredPrice(tiers, 5001)).toBe(6));
  it("returns 0 for empty tiers", () =>
    expect(resolveTieredPrice([], 1000)).toBe(0));
  it("returns 0 for null tiers", () =>
    expect(resolveTieredPrice(null, 1000)).toBe(0));
});

describe("resolveVolumeBand", () => {
  const bands = [
    { label: "Starter", maxMembers: 1000, price: 12, implPrice: 5000 },
    { label: "Growth", maxMembers: 5000, price: 10, implPrice: 3000 },
    { label: "Enterprise", maxMembers: null, price: 8, implPrice: 2000 },
  ];

  it("selects first band for small volume", () => {
    const r = resolveVolumeBand(bands, 500);
    expect(r.price).toBe(12);
    expect(r.bandIndex).toBe(0);
  });

  it("selects last band (no upper bound) for huge volume", () => {
    const r = resolveVolumeBand(bands, 99999);
    expect(r.price).toBe(8);
    expect(r.bandIndex).toBe(2);
  });

  it("returns zero for empty bands", () => {
    expect(resolveVolumeBand([], 1000).price).toBe(0);
  });
});

describe("calculateLineItem — PMPM Standard", () => {
  const product = {
    pricingModel: "PMPM",
    pricingStrategy: "Standard",
    basePrice: 5,
    implementationFee: 1000,
    scopeBasedPricing: "None",
    tiers: [],
    volumeBands: [],
    isQuantityBased: false,
    inheritTierVolumesFromCore: false,
  };

  it("calculates PMPM correctly", () => {
    const { extendedPrice } = calculateLineItem(product, {
      membershipCount: 1000,
      termMonths: 12,
    });
    expect(extendedPrice).toBe(60000);
  });

  it("returns implementation fee separately", () => {
    const { implementationFee } = calculateLineItem(product, {
      membershipCount: 1000,
      termMonths: 12,
    });
    expect(implementationFee).toBe(1000);
  });
});

describe("calculateLineItem — PMPM Standard isQuantityBased", () => {
  const product = {
    pricingModel: "PMPM",
    pricingStrategy: "Standard",
    basePrice: 0.01,
    implementationFee: 500,
    scopeBasedPricing: "None",
    isQuantityBased: true,
    inheritTierVolumesFromCore: false,
    tiers: [],
    volumeBands: [],
  };

  it("multiplies extendedPrice by quantity", () => {
    const { extendedPrice } = calculateLineItem(product, {
      membershipCount: 100000,
      termMonths: 12,
      quantity: 5,
    });
    // 0.01 × 100,000 × 12 × 5 = 60,000
    expect(extendedPrice).toBe(60000);
  });

  it("multiplies implementationFee by quantity", () => {
    const { implementationFee } = calculateLineItem(product, {
      membershipCount: 100000,
      termMonths: 12,
      quantity: 5,
    });
    // 500 × 5 = 2,500
    expect(implementationFee).toBe(2500);
  });
});

describe("calculateLineItem — other pricing models", () => {
  const base = {
    pricingStrategy: "Standard",
    implementationFee: 0,
    scopeBasedPricing: "None",
    isQuantityBased: false,
    inheritTierVolumesFromCore: false,
    tiers: [],
    volumeBands: [],
  };

  it("Flat Fee: price × qty", () => {
    const { extendedPrice } = calculateLineItem(
      { ...base, pricingModel: "Flat Fee", basePrice: 100 },
      { membershipCount: 0, termMonths: 12, quantity: 5 },
    );
    expect(extendedPrice).toBe(500);
  });

  it("Monthly Fee: price × term", () => {
    const { extendedPrice } = calculateLineItem(
      { ...base, pricingModel: "Monthly Fee", basePrice: 500 },
      { membershipCount: 0, termMonths: 12 },
    );
    expect(extendedPrice).toBe(6000);
  });

  it("Hourly Rate: price × hours", () => {
    const { extendedPrice } = calculateLineItem(
      { ...base, pricingModel: "Hourly Rate", basePrice: 150 },
      { membershipCount: 0, termMonths: 12, estimatedHours: 40 },
    );
    expect(extendedPrice).toBe(6000);
  });

  it("scope All: returns 0 price and 0 impl", () => {
    const r = calculateLineItem(
      {
        ...base,
        pricingModel: "PMPM",
        basePrice: 5,
        scopeBasedPricing: "All",
        implementationFee: 1000,
      },
      { membershipCount: 1000, termMonths: 12 },
    );
    expect(r.extendedPrice).toBe(0);
    expect(r.implementationFee).toBe(0);
  });
});

describe("applyLineItemAdjustment", () => {
  it("applies percentage discount", () =>
    expect(
      applyLineItemAdjustment(10000, {
        type: "percentage",
        value: 10,
        direction: "discount",
      }),
    ).toBe(9000));

  it("applies flat discount", () =>
    expect(
      applyLineItemAdjustment(10000, {
        type: "flat",
        value: 500,
        direction: "discount",
      }),
    ).toBe(9500));

  it("applies percentage uplift", () =>
    expect(
      applyLineItemAdjustment(10000, {
        type: "percentage",
        value: 5,
        direction: "uplift",
      }),
    ).toBe(10500));

  it("returns base when no adjustment", () =>
    expect(applyLineItemAdjustment(10000, null)).toBe(10000));
});

// ── §7.9 computeMargin ────────────────────────────────────────────────────────
import { computeMargin, resolveMarginStatus } from "../pricing";

describe("computeMargin", () => {
  function makeItem({
    adjustedPrice,
    unitCost,
    quantity = 1,
    scopeBasedPricing = "None",
  }) {
    return {
      adjustedPrice,
      quantity,
      productSnapshot: { unitCost, scopeBasedPricing },
    };
  }

  it("returns null marginPercent for empty array", () => {
    const result = computeMargin([]);
    expect(result.marginPercent).toBeNull();
    expect(result.totalRevenue).toBe(0);
  });

  // Edge case 1 — zero-cost → 100%
  it("returns 100% margin when unitCost is 0", () => {
    const result = computeMargin([
      makeItem({ adjustedPrice: 500, unitCost: 0 }),
    ]);
    expect(result.marginPercent).toBe(100);
  });

  // Edge case 2 — all scope-based → null
  it("returns null marginPercent when all items are scopeBasedPricing=All", () => {
    const result = computeMargin([
      makeItem({
        adjustedPrice: 1000,
        unitCost: 200,
        scopeBasedPricing: "All",
      }),
    ]);
    expect(result.marginPercent).toBeNull();
    expect(result.totalRevenue).toBe(0);
  });

  it("excludes scope-based items from revenue", () => {
    const result = computeMargin([
      makeItem({
        adjustedPrice: 1000,
        unitCost: 600,
        scopeBasedPricing: "None",
      }),
      makeItem({
        adjustedPrice: 2000,
        unitCost: 400,
        scopeBasedPricing: "All",
      }),
    ]);
    expect(result.totalRevenue).toBe(1000);
    expect(result.totalCost).toBe(600);
    expect(result.marginPercent).toBe(40);
  });

  it("accounts for quantity in cost", () => {
    const result = computeMargin([
      makeItem({ adjustedPrice: 3000, unitCost: 500, quantity: 3 }),
    ]);
    expect(result.totalCost).toBe(1500);
    expect(result.grossProfit).toBe(1500);
    expect(result.marginPercent).toBe(50);
  });

  it("uses item.product as fallback when productSnapshot missing", () => {
    const item = {
      adjustedPrice: 1000,
      quantity: 1,
      product: { unitCost: 400, scopeBasedPricing: "None" },
    };
    const result = computeMargin([item]);
    expect(result.marginPercent).toBe(60);
  });
});

describe("resolveMarginStatus", () => {
  const targets = { global: { green: 50, yellow: 30 } };

  it("returns null for null marginPercent", () => {
    expect(resolveMarginStatus(null, targets)).toBeNull();
  });

  it("returns green when margin >= green threshold", () => {
    expect(resolveMarginStatus(50, targets)).toBe("green");
    expect(resolveMarginStatus(75, targets)).toBe("green");
  });

  it("returns yellow when margin is between yellow and green thresholds", () => {
    expect(resolveMarginStatus(30, targets)).toBe("yellow");
    expect(resolveMarginStatus(49, targets)).toBe("yellow");
  });

  it("returns red when margin is below yellow threshold", () => {
    expect(resolveMarginStatus(29, targets)).toBe("red");
    expect(resolveMarginStatus(0, targets)).toBe("red");
  });

  // Edge case 3 — per-line override priority
  it("uses the most restrictive per-line override (highest green)", () => {
    const t = {
      global: { green: 50, yellow: 30 },
      productLines: {
        "Line A": { green: 70, yellow: 50 },
        "Line B": { green: 60, yellow: 40 },
      },
    };
    // 65% > 60 but < 70 → yellow under Line A override
    expect(resolveMarginStatus(65, t, ["Line A", "Line B"])).toBe("yellow");
    // 72% >= 70 → green under most restrictive override
    expect(resolveMarginStatus(72, t, ["Line A", "Line B"])).toBe("green");
  });

  it("falls back to global when no matching per-line override", () => {
    const t = {
      global: { green: 50, yellow: 30 },
      productLines: { "Other Line": { green: 70, yellow: 50 } },
    };
    expect(resolveMarginStatus(55, t, ["My Line"])).toBe("green"); // >= 50 global green
  });
});
