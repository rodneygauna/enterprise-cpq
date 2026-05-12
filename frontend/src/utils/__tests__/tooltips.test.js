/**
 * tooltips.test.js — Unit tests for the central tooltip registry (FR-TTIP-5).
 *
 * Validates structural and content constraints so regressions are caught before
 * any string change ships.
 */
import { describe, it, expect } from "vitest";
import { TOOLTIPS } from "../tooltips";

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Recursively flatten a namespace object to [key, value] pairs. */
function flatEntries(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return typeof v === "object" && v !== null
      ? flatEntries(v, path)
      : [[path, v]];
  });
}

const ALL_ENTRIES = flatEntries(TOOLTIPS);

// ── Structure tests ───────────────────────────────────────────────────────────
describe("TOOLTIPS registry — structure", () => {
  it("exports a TOOLTIPS object", () => {
    expect(typeof TOOLTIPS).toBe("object");
    expect(TOOLTIPS).not.toBeNull();
  });

  it("has all required top-level namespaces", () => {
    expect(TOOLTIPS).toHaveProperty("quoteBuilder");
    expect(TOOLTIPS).toHaveProperty("products");
    expect(TOOLTIPS).toHaveProperty("settings");
    expect(TOOLTIPS).toHaveProperty("productLines");
    expect(TOOLTIPS).toHaveProperty("users");
  });
});

// ── Value quality tests ────────────────────────────────────────────────────────
describe("TOOLTIPS registry — values", () => {
  it("every value is a non-empty string", () => {
    for (const [path, value] of ALL_ENTRIES) {
      expect(typeof value, `${path} should be a string`).toBe("string");
      expect(
        value.trim().length,
        `${path} should not be empty`,
      ).toBeGreaterThan(0);
    }
  });

  it("no value contains raw HTML tags", () => {
    const HTML_TAG_RE = /<[a-z][\s\S]*?>/i;
    for (const [path, value] of ALL_ENTRIES) {
      expect(HTML_TAG_RE.test(value), `${path} should not contain HTML`).toBe(
        false,
      );
    }
  });

  it("all values are unique — no duplicate tooltip text", () => {
    const seen = new Map();
    for (const [path, value] of ALL_ENTRIES) {
      if (seen.has(value)) {
        throw new Error(
          `Duplicate tooltip text found at "${path}" and "${seen.get(value)}": "${value}"`,
        );
      }
      seen.set(value, path);
    }
  });
});

// ── Required key coverage (FR-TTIP-8) ─────────────────────────────────────────
describe("TOOLTIPS.quoteBuilder — required keys", () => {
  const requiredKeys = [
    "clientName",
    "effectiveDate",
    "membershipCount",
    "termLength",
    "annualUplift",
    "adjustmentDirection",
    "adjustmentType",
    "adjustmentValue",
  ];
  it.each(requiredKeys)("has key: %s", (key) => {
    expect(TOOLTIPS.quoteBuilder).toHaveProperty(key);
  });
});

describe("TOOLTIPS.products — required keys", () => {
  const requiredKeys = [
    "sku",
    "productLineId",
    "type",
    "pricingModel",
    "pricingStrategy",
    "billingType",
    "basePrice",
    "unitCost",
    "implementationFee",
    "overagePrice",
    "isBaselineProduct",
    "isQuantityBased",
    "inheritTierVolumesFromCore",
    "tiers",
    "volumeBands",
    "scopeBasedPricing",
    "compatibleCoreIds",
    "recommendedProductIds",
  ];
  it.each(requiredKeys)("has key: %s", (key) => {
    expect(TOOLTIPS.products).toHaveProperty(key);
  });
});

describe("TOOLTIPS.settings — required keys", () => {
  const requiredKeys = [
    "companyName",
    "logoUrl",
    "managerReviewPercent",
    "executiveReviewPercent",
    "marginGreen",
    "marginYellow",
  ];
  it.each(requiredKeys)("has key: %s", (key) => {
    expect(TOOLTIPS.settings).toHaveProperty(key);
  });
});

describe("TOOLTIPS.productLines — required keys", () => {
  it.each(["name", "displayColor"])("has key: %s", (key) => {
    expect(TOOLTIPS.productLines).toHaveProperty(key);
  });
});

describe("TOOLTIPS.users — required keys", () => {
  it.each(["inviteEmail", "inviteRole"])("has key: %s", (key) => {
    expect(TOOLTIPS.users).toHaveProperty(key);
  });
});
