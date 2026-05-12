/**
 * discountService unit tests — §7.8 FR-DISC-1, FR-DISC-2, FR-DISC-3
 *
 * Pure function tests; no DB required.
 *
 * Coverage:
 *   computeMaxLineItemDiscountPercent
 *     - returns 0 for empty array
 *     - returns 0 when no discount adjustments
 *     - ignores uplift adjustments
 *     - ignores flat discount adjustments
 *     - returns highest percentage discount across items
 *
 *   resolveApprovalTier
 *     - returns null when discount is 0 (no threshold exceeded)
 *     - returns null when discount equals manager threshold (boundary: > not >=)
 *     - returns "Manager Review" when discount exceeds manager threshold
 *     - returns "Executive Review" when discount exceeds executive threshold
 *     - uses default thresholds (10 / 25) when thresholds is null
 *
 *   computeVolumeDiscountPercent
 *     - returns 0 for empty rules
 *     - returns 0 when membership is 0
 *     - returns 0 when no rule threshold is met
 *     - returns matching rule discount
 *     - returns highest matching tier when multiple thresholds are met
 */

const {
  computeMaxLineItemDiscountPercent,
  resolveApprovalTier,
  computeVolumeDiscountPercent,
} = require("../../src/services/discountService");

// ─── computeMaxLineItemDiscountPercent ────────────────────────────────────────
describe("computeMaxLineItemDiscountPercent", () => {
  it("returns 0 for empty array", () => {
    expect(computeMaxLineItemDiscountPercent([])).toBe(0);
  });

  it("returns 0 when no discount adjustments", () => {
    const items = [
      { adjustmentDirection: null, adjustmentType: null, adjustmentValue: 0 },
    ];
    expect(computeMaxLineItemDiscountPercent(items)).toBe(0);
  });

  it("ignores uplift adjustments", () => {
    const items = [
      {
        adjustmentDirection: "uplift",
        adjustmentType: "percentage",
        adjustmentValue: 20,
      },
    ];
    expect(computeMaxLineItemDiscountPercent(items)).toBe(0);
  });

  it("ignores flat discount adjustments", () => {
    const items = [
      {
        adjustmentDirection: "discount",
        adjustmentType: "flat",
        adjustmentValue: 5000,
      },
    ];
    expect(computeMaxLineItemDiscountPercent(items)).toBe(0);
  });

  it("returns highest percentage discount across items", () => {
    const items = [
      {
        adjustmentDirection: "discount",
        adjustmentType: "percentage",
        adjustmentValue: 5,
      },
      {
        adjustmentDirection: "discount",
        adjustmentType: "percentage",
        adjustmentValue: 30,
      },
      {
        adjustmentDirection: "discount",
        adjustmentType: "percentage",
        adjustmentValue: 15,
      },
    ];
    expect(computeMaxLineItemDiscountPercent(items)).toBe(30);
  });
});

// ─── resolveApprovalTier ──────────────────────────────────────────────────────
describe("resolveApprovalTier", () => {
  const thresholds = { managerReviewPercent: 10, executiveReviewPercent: 25 };

  it("returns null when discount is 0", () => {
    expect(resolveApprovalTier(0, thresholds)).toBeNull();
  });

  it("returns null when discount exactly equals manager threshold (> not >=)", () => {
    expect(resolveApprovalTier(10, thresholds)).toBeNull();
  });

  it("returns Manager Review when discount exceeds manager threshold", () => {
    expect(resolveApprovalTier(10.1, thresholds)).toBe("Manager Review");
  });

  it("returns Manager Review when discount is between thresholds", () => {
    expect(resolveApprovalTier(20, thresholds)).toBe("Manager Review");
  });

  it("returns Manager Review when discount exactly equals executive threshold (> not >=)", () => {
    expect(resolveApprovalTier(25, thresholds)).toBe("Manager Review");
  });

  it("returns Executive Review when discount exceeds executive threshold", () => {
    expect(resolveApprovalTier(25.1, thresholds)).toBe("Executive Review");
  });

  it("uses default thresholds (10/25) when thresholds is null", () => {
    expect(resolveApprovalTier(15, null)).toBe("Manager Review");
    expect(resolveApprovalTier(26, null)).toBe("Executive Review");
    expect(resolveApprovalTier(5, null)).toBeNull();
  });
});

// ─── computeVolumeDiscountPercent ─────────────────────────────────────────────
describe("computeVolumeDiscountPercent", () => {
  it("returns 0 for empty rules", () => {
    expect(computeVolumeDiscountPercent(50000, [])).toBe(0);
  });

  it("returns 0 when membershipCount is 0", () => {
    const rules = [{ membersThreshold: 10000, discountPercent: 5 }];
    expect(computeVolumeDiscountPercent(0, rules)).toBe(0);
  });

  it("returns 0 when no rule threshold is met", () => {
    const rules = [{ membersThreshold: 100000, discountPercent: 10 }];
    expect(computeVolumeDiscountPercent(50000, rules)).toBe(0);
  });

  it("returns matching rule discount", () => {
    const rules = [{ membersThreshold: 10000, discountPercent: 5 }];
    expect(computeVolumeDiscountPercent(50000, rules)).toBe(5);
  });

  it("returns highest matching tier when multiple thresholds are met", () => {
    const rules = [
      { membersThreshold: 10000, discountPercent: 5 },
      { membersThreshold: 50000, discountPercent: 10 },
      { membersThreshold: 200000, discountPercent: 15 },
    ];
    // 75k members → qualifies for 10k and 50k tiers; 50k tier wins
    expect(computeVolumeDiscountPercent(75000, rules)).toBe(10);
    // 250k members → all three tiers; 200k tier wins
    expect(computeVolumeDiscountPercent(250000, rules)).toBe(15);
  });
});
