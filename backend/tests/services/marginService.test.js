/**
 * Unit tests for backend/src/services/marginService.js
 *
 * Covers FR-MARGIN-1 through FR-MARGIN-4 including all 5 edge cases
 * agreed in the §7.9 clarifying questions:
 *   1. Zero-cost product → 100% margin
 *   2. Zero-revenue (all scope-based) → null margin
 *   3. Per-line override priority
 *   4. Margin red + discount Manager Review → Executive Review wins
 *   5. Margin yellow + no discount → Manager Review
 */
const {
  computeMargin,
  resolveMarginThresholds,
  resolveMarginStatus,
  marginStatusToApprovalTier,
  resolveHigherApprovalTier,
} = require("../../src/services/marginService");

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeItem(overrides = {}) {
  return {
    adjustedPrice: 1000,
    quantity: 1,
    productSnapshot: {
      unitCost: 500,
      scopeBasedPricing: "None",
    },
    ...overrides,
  };
}

// ── computeMargin ─────────────────────────────────────────────────────────────
describe("computeMargin", () => {
  it("returns zero revenue, cost, and null marginPercent for empty array", () => {
    const result = computeMargin([]);
    expect(result).toEqual({
      totalRevenue: 0,
      totalCost: 0,
      grossProfit: 0,
      marginPercent: null,
    });
  });

  it("computes basic margin correctly", () => {
    const items = [
      makeItem({
        adjustedPrice: 1000,
        productSnapshot: { unitCost: 400, scopeBasedPricing: "None" },
      }),
    ];
    const result = computeMargin(items);
    expect(result.totalRevenue).toBe(1000);
    expect(result.totalCost).toBe(400);
    expect(result.grossProfit).toBe(600);
    expect(result.marginPercent).toBe(60);
  });

  // Edge case 1 — zero-cost product → 100% margin
  it("returns 100% margin when unitCost is 0", () => {
    const items = [
      makeItem({
        adjustedPrice: 500,
        productSnapshot: { unitCost: 0, scopeBasedPricing: "None" },
      }),
    ];
    const result = computeMargin(items);
    expect(result.totalRevenue).toBe(500);
    expect(result.totalCost).toBe(0);
    expect(result.marginPercent).toBe(100);
  });

  // Edge case 2 — all scope-based items → zero revenue → null
  it("returns null marginPercent when all items are scopeBasedPricing=All", () => {
    const items = [
      makeItem({
        adjustedPrice: 1000,
        productSnapshot: { unitCost: 200, scopeBasedPricing: "All" },
      }),
      makeItem({
        adjustedPrice: 500,
        productSnapshot: { unitCost: 100, scopeBasedPricing: "All" },
      }),
    ];
    const result = computeMargin(items);
    expect(result.totalRevenue).toBe(0);
    expect(result.marginPercent).toBeNull();
  });

  it("excludes scope-based items from revenue but includes non-scope items", () => {
    const items = [
      makeItem({
        adjustedPrice: 1000,
        productSnapshot: { unitCost: 600, scopeBasedPricing: "None" },
      }),
      makeItem({
        adjustedPrice: 2000,
        productSnapshot: { unitCost: 400, scopeBasedPricing: "All" },
      }),
    ];
    const result = computeMargin(items);
    expect(result.totalRevenue).toBe(1000);
    expect(result.totalCost).toBe(600);
    expect(result.marginPercent).toBe(40);
  });

  it("accounts for quantity in cost calculation", () => {
    const items = [
      makeItem({
        adjustedPrice: 3000,
        quantity: 3,
        productSnapshot: { unitCost: 500, scopeBasedPricing: "None" },
      }),
    ];
    const result = computeMargin(items);
    expect(result.totalCost).toBe(1500); // 500 × 3
    expect(result.grossProfit).toBe(1500);
    expect(result.marginPercent).toBe(50);
  });

  it("handles multiple items correctly (blended margin)", () => {
    const items = [
      makeItem({
        adjustedPrice: 800,
        productSnapshot: { unitCost: 400, scopeBasedPricing: "None" },
      }),
      makeItem({
        adjustedPrice: 200,
        productSnapshot: { unitCost: 150, scopeBasedPricing: "None" },
      }),
    ];
    const result = computeMargin(items);
    expect(result.totalRevenue).toBe(1000);
    expect(result.totalCost).toBe(550);
    expect(result.grossProfit).toBe(450);
    expect(result.marginPercent).toBe(45);
  });
});

// ── resolveMarginThresholds ────────────────────────────────────────────────────
describe("resolveMarginThresholds", () => {
  const defaultTargets = {
    global: { green: 50, yellow: 30 },
    productLines: {},
  };

  it("returns global thresholds when no per-line overrides exist", () => {
    const result = resolveMarginThresholds(["Line A"], defaultTargets);
    expect(result).toEqual({ green: 50, yellow: 30 });
  });

  it("returns global thresholds when active lines have no override", () => {
    const targets = {
      global: { green: 50, yellow: 30 },
      productLines: { "Other Line": { green: 60, yellow: 40 } },
    };
    const result = resolveMarginThresholds(["Line A"], targets);
    expect(result).toEqual({ green: 50, yellow: 30 });
  });

  // Edge case 3 — per-line override priority
  it("uses the highest green override among active product lines", () => {
    const targets = {
      global: { green: 50, yellow: 30 },
      productLines: {
        "Line A": { green: 65, yellow: 45 },
        "Line B": { green: 55, yellow: 35 },
      },
    };
    const result = resolveMarginThresholds(["Line A", "Line B"], targets);
    expect(result.green).toBe(65); // most restrictive
    expect(result.yellow).toBe(45);
  });

  it("works with Mongoose Map (supports .get())", () => {
    const map = new Map([["Line X", { green: 70, yellow: 50 }]]);
    const targets = { global: { green: 50, yellow: 30 }, productLines: map };
    const result = resolveMarginThresholds(["Line X"], targets);
    expect(result.green).toBe(70);
    expect(result.yellow).toBe(50);
  });

  it("falls back to global defaults when marginTargets is null/undefined", () => {
    const result = resolveMarginThresholds([], null);
    expect(result).toEqual({ green: 50, yellow: 30 });
  });
});

// ── resolveMarginStatus ────────────────────────────────────────────────────────
describe("resolveMarginStatus", () => {
  const thresholds = { green: 50, yellow: 30 };

  it("returns null for null marginPercent", () => {
    expect(resolveMarginStatus(null, thresholds)).toBeNull();
  });

  it("returns null for undefined marginPercent", () => {
    expect(resolveMarginStatus(undefined, thresholds)).toBeNull();
  });

  it("returns green when margin >= green threshold", () => {
    expect(resolveMarginStatus(50, thresholds)).toBe("green");
    expect(resolveMarginStatus(75, thresholds)).toBe("green");
    expect(resolveMarginStatus(100, thresholds)).toBe("green");
  });

  it("returns yellow when margin is between yellow and green thresholds", () => {
    expect(resolveMarginStatus(30, thresholds)).toBe("yellow");
    expect(resolveMarginStatus(49.9, thresholds)).toBe("yellow");
  });

  it("returns red when margin is below yellow threshold", () => {
    expect(resolveMarginStatus(0, thresholds)).toBe("red");
    expect(resolveMarginStatus(15, thresholds)).toBe("red");
    expect(resolveMarginStatus(29.9, thresholds)).toBe("red");
  });

  it("uses default thresholds (50/30) when thresholds arg is null", () => {
    expect(resolveMarginStatus(60, null)).toBe("green");
    expect(resolveMarginStatus(40, null)).toBe("yellow");
    expect(resolveMarginStatus(20, null)).toBe("red");
  });
});

// ── marginStatusToApprovalTier ────────────────────────────────────────────────
describe("marginStatusToApprovalTier", () => {
  it("maps red → Executive Review", () => {
    expect(marginStatusToApprovalTier("red")).toBe("Executive Review");
  });

  it("maps yellow → Manager Review", () => {
    expect(marginStatusToApprovalTier("yellow")).toBe("Manager Review");
  });

  it("maps green → null (no approval needed)", () => {
    expect(marginStatusToApprovalTier("green")).toBeNull();
  });

  it("maps null → null", () => {
    expect(marginStatusToApprovalTier(null)).toBeNull();
  });
});

// ── resolveHigherApprovalTier ─────────────────────────────────────────────────
describe("resolveHigherApprovalTier", () => {
  it("returns null when both tiers are null", () => {
    expect(resolveHigherApprovalTier(null, null)).toBeNull();
  });

  it("returns the non-null tier when only one is set", () => {
    expect(resolveHigherApprovalTier("Manager Review", null)).toBe(
      "Manager Review",
    );
    expect(resolveHigherApprovalTier(null, "Manager Review")).toBe(
      "Manager Review",
    );
  });

  // Edge case 4 — margin red + discount Manager Review → Executive Review wins
  it("returns Executive Review when margin=red and discount=Manager Review", () => {
    const marginTier = "Executive Review"; // from marginStatusToApprovalTier("red")
    const discountTier = "Manager Review";
    expect(resolveHigherApprovalTier(discountTier, marginTier)).toBe(
      "Executive Review",
    );
  });

  // Edge case 5 — margin yellow + no discount → Manager Review
  it("returns Manager Review when margin=yellow and discount=null", () => {
    const marginTier = "Manager Review"; // from marginStatusToApprovalTier("yellow")
    const discountTier = null;
    expect(resolveHigherApprovalTier(discountTier, marginTier)).toBe(
      "Manager Review",
    );
  });

  it("returns Executive Review when both are Executive Review", () => {
    expect(
      resolveHigherApprovalTier("Executive Review", "Executive Review"),
    ).toBe("Executive Review");
  });

  it("returns Executive Review when discount tier is higher", () => {
    expect(
      resolveHigherApprovalTier("Executive Review", "Manager Review"),
    ).toBe("Executive Review");
  });
});
