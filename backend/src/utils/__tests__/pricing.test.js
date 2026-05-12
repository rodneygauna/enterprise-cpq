/**
 * Pricing utility tests — covers all pricing models, strategies,
 * and edge cases required by FR-QUOTE-6 and FR-QUOTE-7.
 */

const {
  resolveTieredPrice,
  resolveVolumeBand,
  calculateLineItem,
  applyLineItemAdjustment,
} = require("../../utils/pricing");

// ─── resolveTieredPrice ───────────────────────────────────────────────────────
describe("resolveTieredPrice", () => {
  const tiers = [
    { min: 0, price: 10 },
    { min: 1000, price: 8 },
    { min: 5000, price: 6 },
  ];

  it("returns lowest tier price for volume at exactly tier 0", () => {
    expect(resolveTieredPrice(tiers, 0)).toBe(10);
  });

  it("returns correct tier price for volume at boundary", () => {
    expect(resolveTieredPrice(tiers, 1000)).toBe(8);
  });

  it("returns higher tier for volume above boundary", () => {
    expect(resolveTieredPrice(tiers, 5001)).toBe(6);
  });

  it("uses lowest tier when volume is below the first min", () => {
    expect(resolveTieredPrice(tiers, 500)).toBe(10);
  });

  it("returns 0 for empty tiers array", () => {
    expect(resolveTieredPrice([], 1000)).toBe(0);
  });

  it("returns 0 for null tiers", () => {
    expect(resolveTieredPrice(null, 1000)).toBe(0);
  });
});

// ─── resolveVolumeBand ────────────────────────────────────────────────────────
describe("resolveVolumeBand", () => {
  const bands = [
    { label: "Starter", maxMembers: 1000, price: 12, implPrice: 5000 },
    { label: "Growth", maxMembers: 5000, price: 10, implPrice: 3000 },
    { label: "Enterprise", maxMembers: null, price: 8, implPrice: 2000 },
  ];

  it("selects first band when members at lower bound", () => {
    const result = resolveVolumeBand(bands, 100);
    expect(result.price).toBe(12);
    expect(result.implPrice).toBe(5000);
    expect(result.bandIndex).toBe(0);
  });

  it("selects first band at exact maxMembers", () => {
    const result = resolveVolumeBand(bands, 1000);
    expect(result.price).toBe(12);
    expect(result.bandIndex).toBe(0);
  });

  it("selects second band for volume in range", () => {
    const result = resolveVolumeBand(bands, 2500);
    expect(result.price).toBe(10);
    expect(result.bandIndex).toBe(1);
  });

  it("selects final band (no upper bound) for very large volume", () => {
    const result = resolveVolumeBand(bands, 999999);
    expect(result.price).toBe(8);
    expect(result.bandIndex).toBe(2);
  });

  it("returns zero price for empty bands", () => {
    const result = resolveVolumeBand([], 1000);
    expect(result.price).toBe(0);
    expect(result.bandIndex).toBe(-1);
  });
});

// ─── calculateLineItem ────────────────────────────────────────────────────────
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

  it("calculates correctly for 12 months", () => {
    const { extendedPrice } = calculateLineItem(product, {
      membershipCount: 1000,
      termMonths: 12,
    });
    // 5 × 1000 × 12 = 60,000
    expect(extendedPrice).toBe(60000);
  });

  it("includes implementation fee separately", () => {
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

  it("quantity 1 returns same as non-quantity-based", () => {
    const { extendedPrice } = calculateLineItem(product, {
      membershipCount: 100000,
      termMonths: 12,
      quantity: 1,
    });
    // 0.01 × 100,000 × 12 × 1 = 12,000
    expect(extendedPrice).toBe(12000);
  });
});

describe("calculateLineItem — PMPM Tiered", () => {
  const product = {
    pricingModel: "PMPM",
    pricingStrategy: "Tiered",
    basePrice: 0,
    implementationFee: 0,
    scopeBasedPricing: "None",
    isQuantityBased: false,
    inheritTierVolumesFromCore: false,
    tiers: [
      { min: 0, price: 10000 }, // total monthly fee for < 1000 members
      { min: 1000, price: 8000 }, // total monthly fee for 1000+ members
    ],
    volumeBands: [],
  };

  it("uses tier price as total monthly fee × term months", () => {
    const { extendedPrice } = calculateLineItem(product, {
      membershipCount: 1500,
      termMonths: 12,
    });
    // Tier for 1500: price = 8000 (total monthly); 8000 × 12 = 96,000
    expect(extendedPrice).toBe(96000);
  });
});

describe("calculateLineItem — Volume Bands", () => {
  const product = {
    pricingModel: "PMPM",
    pricingStrategy: "Volume Bands",
    basePrice: 0,
    implementationFee: 0,
    scopeBasedPricing: "None",
    isQuantityBased: false,
    inheritTierVolumesFromCore: false,
    tiers: [],
    volumeBands: [
      { label: "Starter", maxMembers: 1000, price: 12, implPrice: 5000 },
      { label: "Growth", maxMembers: 5000, price: 10, implPrice: 3000 },
      { label: "Enterprise", maxMembers: null, price: 8, implPrice: 2000 },
    ],
  };

  it("uses band price × members × term", () => {
    // 1500 members → Growth band → price 10 × 1500 × 12 = 180,000
    const { extendedPrice } = calculateLineItem(product, {
      membershipCount: 1500,
      termMonths: 12,
    });
    expect(extendedPrice).toBe(180000);
  });

  it("uses band implPrice as implementation fee", () => {
    const { implementationFee } = calculateLineItem(product, {
      membershipCount: 1500,
      termMonths: 12,
    });
    expect(implementationFee).toBe(3000);
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

  it("Flat Fee: basePrice × quantity", () => {
    const { extendedPrice } = calculateLineItem(
      { ...base, pricingModel: "Flat Fee", basePrice: 100 },
      { membershipCount: 0, termMonths: 12, quantity: 5 },
    );
    expect(extendedPrice).toBe(500);
  });

  it("Monthly Fee: basePrice × term", () => {
    const { extendedPrice } = calculateLineItem(
      { ...base, pricingModel: "Monthly Fee", basePrice: 500 },
      { membershipCount: 0, termMonths: 12 },
    );
    expect(extendedPrice).toBe(6000);
  });

  it("Per Unit / Transaction: price × annualUnits / 12 × term", () => {
    const { extendedPrice } = calculateLineItem(
      { ...base, pricingModel: "Per Unit / Transaction", basePrice: 2 },
      { membershipCount: 0, termMonths: 12, annualUnits: 12000 },
    );
    // 2 × 12000 / 12 × 12 = 24,000
    expect(extendedPrice).toBe(24000);
  });

  it("Per User / License: price × seats × term", () => {
    const { extendedPrice } = calculateLineItem(
      { ...base, pricingModel: "Per User / License", basePrice: 50 },
      { membershipCount: 0, termMonths: 12, quantity: 10 },
    );
    // 50 × 10 × 12 = 6,000
    expect(extendedPrice).toBe(6000);
  });

  it("Hourly Rate: price × hours", () => {
    const { extendedPrice } = calculateLineItem(
      { ...base, pricingModel: "Hourly Rate", basePrice: 150 },
      { membershipCount: 0, termMonths: 12, estimatedHours: 40 },
    );
    // 150 × 40 = 6,000
    expect(extendedPrice).toBe(6000);
  });
});

describe("calculateLineItem — scope-based pricing", () => {
  const base = {
    pricingModel: "PMPM",
    pricingStrategy: "Standard",
    basePrice: 5,
    implementationFee: 1000,
    isQuantityBased: false,
    inheritTierVolumesFromCore: false,
    tiers: [],
    volumeBands: [],
  };

  it("scope All: excludes from TCV (returns 0 for price and impl)", () => {
    const result = calculateLineItem(
      { ...base, scopeBasedPricing: "All" },
      { membershipCount: 1000, termMonths: 12 },
    );
    expect(result.extendedPrice).toBe(0);
    expect(result.implementationFee).toBe(0);
  });

  it("scope Implementation Only: excludes impl fee from totals", () => {
    const result = calculateLineItem(
      { ...base, scopeBasedPricing: "Implementation Only" },
      { membershipCount: 1000, termMonths: 12 },
    );
    expect(result.extendedPrice).toBe(60000); // PMPM still calculated
    expect(result.implementationFee).toBe(0); // TBD
  });
});

// ─── applyLineItemAdjustment ──────────────────────────────────────────────────
describe("applyLineItemAdjustment", () => {
  it("applies percentage discount", () => {
    expect(
      applyLineItemAdjustment(10000, {
        type: "percentage",
        value: 10,
        direction: "discount",
      }),
    ).toBe(9000);
  });

  it("applies flat discount", () => {
    expect(
      applyLineItemAdjustment(10000, {
        type: "flat",
        value: 500,
        direction: "discount",
      }),
    ).toBe(9500);
  });

  it("applies percentage uplift", () => {
    expect(
      applyLineItemAdjustment(10000, {
        type: "percentage",
        value: 5,
        direction: "uplift",
      }),
    ).toBe(10500);
  });

  it("returns base amount when no adjustment provided", () => {
    expect(applyLineItemAdjustment(10000, null)).toBe(10000);
  });

  it("returns base amount when adjustment value is 0", () => {
    expect(
      applyLineItemAdjustment(10000, {
        type: "percentage",
        value: 0,
        direction: "discount",
      }),
    ).toBe(10000);
  });
});
