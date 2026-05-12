/**
 * Margin scoring service — §7.9 FR-MARGIN-1 through FR-MARGIN-4.
 *
 * All functions are pure / side-effect-free so they are fully testable.
 *
 * Margin formula (FR-MARGIN-1):
 *   Total Revenue = sum of adjustedPrice for items where scopeBasedPricing !== "All"
 *   Total Cost    = sum of (unitCost × quantity) for same items
 *   Gross Profit  = Total Revenue − Total Cost
 *   Margin %      = (Gross Profit ÷ Total Revenue) × 100
 *   If Total Revenue = 0 (all scope-based), margin = null.
 */

/**
 * Computes the blended margin for a quote.
 *
 * @param {object[]} selectedItems  - quote.selectedItems array (stored on the quote)
 * @returns {{ totalRevenue: number, totalCost: number, grossProfit: number, marginPercent: number|null }}
 */
function computeMargin(selectedItems = []) {
  let totalRevenue = 0;
  let totalCost = 0;

  for (const item of selectedItems) {
    const snap = item.productSnapshot || {};
    // Exclude scope-based "All" items from both revenue and cost
    if (snap.scopeBasedPricing === "All") continue;

    totalRevenue += item.adjustedPrice ?? 0;

    const unitCost = typeof snap.unitCost === "number" ? snap.unitCost : 0;
    const qty =
      typeof item.quantity === "number" && item.quantity > 0
        ? item.quantity
        : 1;
    totalCost += unitCost * qty;
  }

  totalRevenue = Math.round(totalRevenue * 100) / 100;
  totalCost = Math.round(totalCost * 100) / 100;
  const grossProfit = Math.round((totalRevenue - totalCost) * 100) / 100;

  const marginPercent =
    totalRevenue > 0
      ? Math.round((grossProfit / totalRevenue) * 10000) / 100
      : null;

  return { totalRevenue, totalCost, grossProfit, marginPercent };
}

/**
 * Resolves the effective green/yellow thresholds for a quote, taking into
 * account per-product-line overrides (FR-MARGIN-2).
 *
 * Strategy: find the most restrictive (highest green threshold) override among
 * the quote's active product-line names; fall back to global if none applies.
 *
 * @param {string[]} activeLineNames  - Names of the product lines active in the quote
 * @param {{ global: { green: number, yellow: number }, productLines?: Map|object }} marginTargets
 * @returns {{ green: number, yellow: number }}
 */
function resolveMarginThresholds(activeLineNames = [], marginTargets) {
  const global = {
    green: marginTargets?.global?.green ?? 50,
    yellow: marginTargets?.global?.yellow ?? 30,
  };

  // productLines may be a Mongoose Map or a plain object
  const lineOverrides = marginTargets?.productLines;
  if (!lineOverrides || activeLineNames.length === 0) return global;

  const getOverride = (name) => {
    if (typeof lineOverrides.get === "function") return lineOverrides.get(name);
    return lineOverrides[name];
  };

  let best = null; // most restrictive = highest green threshold
  for (const name of activeLineNames) {
    const override = getOverride(name);
    if (
      override &&
      typeof override.green === "number" &&
      typeof override.yellow === "number"
    ) {
      if (!best || override.green > best.green) best = override;
    }
  }

  return best ?? global;
}

/**
 * Maps a margin percentage to a traffic-light status (FR-MARGIN-3).
 *
 * @param {number|null} marginPercent
 * @param {{ green: number, yellow: number }} thresholds
 * @returns {"green" | "yellow" | "red" | null}
 *   null = cannot be determined (no revenue / all scope-based)
 */
function resolveMarginStatus(marginPercent, thresholds) {
  if (marginPercent === null || marginPercent === undefined) return null;
  const { green = 50, yellow = 30 } = thresholds ?? {};
  if (marginPercent >= green) return "green";
  if (marginPercent >= yellow) return "yellow";
  return "red";
}

/**
 * Translates a margin status to an approval routing tier (FR-MARGIN-3/4).
 *
 * @param {"green"|"yellow"|"red"|null} marginStatus
 * @returns {"Manager Review" | "Executive Review" | null}
 */
function marginStatusToApprovalTier(marginStatus) {
  if (marginStatus === "red") return "Executive Review";
  if (marginStatus === "yellow") return "Manager Review";
  return null;
}

/**
 * Combines the discount-based tier and the margin-based tier, returning the
 * higher of the two (FR-MARGIN-4).  Higher = Executive > Manager > null.
 *
 * @param {"Manager Review"|"Executive Review"|null} discountTier
 * @param {"Manager Review"|"Executive Review"|null} marginTier
 * @returns {"Manager Review"|"Executive Review"|null}
 */
function resolveHigherApprovalTier(discountTier, marginTier) {
  const rank = { null: 0, "Manager Review": 1, "Executive Review": 2 };
  const d = rank[discountTier] ?? 0;
  const m = rank[marginTier] ?? 0;
  if (d === 0 && m === 0) return null;
  return d >= m ? discountTier : marginTier;
}

module.exports = {
  computeMargin,
  resolveMarginThresholds,
  resolveMarginStatus,
  marginStatusToApprovalTier,
  resolveHigherApprovalTier,
};
