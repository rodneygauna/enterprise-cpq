/**
 * Discount governance service — §7.8 FR-DISC-1, FR-DISC-2, FR-DISC-3.
 *
 * All functions are pure / side-effect-free so they are fully testable.
 */

/**
 * Returns the maximum line-item discount percentage across all selectedItems.
 *
 * Only items with adjustmentDirection === "discount" and
 * adjustmentType === "percentage" count toward the routing tier.
 * Flat discounts are ignored for threshold routing (amount is product-specific).
 *
 * @param {object[]} selectedItems - quote.selectedItems array
 * @returns {number} 0–100
 */
function computeMaxLineItemDiscountPercent(selectedItems = []) {
  let max = 0;
  for (const item of selectedItems) {
    if (
      item.adjustmentDirection === "discount" &&
      item.adjustmentType === "percentage" &&
      typeof item.adjustmentValue === "number"
    ) {
      if (item.adjustmentValue > max) max = item.adjustmentValue;
    }
  }
  return max;
}

/**
 * Determines the approval tier required for the given max discount %.
 *
 * @param {number} maxDiscountPercent
 * @param {{ managerReviewPercent: number, executiveReviewPercent: number }} thresholds
 * @returns {"Manager Review" | "Executive Review" | null}
 *   null = no approval required (auto-approve)
 */
function resolveApprovalTier(maxDiscountPercent, thresholds) {
  const { managerReviewPercent = 10, executiveReviewPercent = 25 } =
    thresholds ?? {};

  if (maxDiscountPercent > executiveReviewPercent) return "Executive Review";
  if (maxDiscountPercent > managerReviewPercent) return "Manager Review";
  return null;
}

/**
 * Determines the best (highest-value) volume discount for the given membership count.
 *
 * Volume discount rules are matched by membersThreshold ascending —
 * the highest threshold that the count equals or exceeds wins.
 *
 * @param {number} membershipCount
 * @param {Array<{ membersThreshold: number, discountPercent: number }>} volumeRules
 * @returns {number} discount % to apply (0 if no rule matches)
 */
function computeVolumeDiscountPercent(membershipCount, volumeRules = []) {
  if (!volumeRules.length || !membershipCount) return 0;

  const applicable = volumeRules
    .filter((r) => membershipCount >= r.membersThreshold)
    .sort((a, b) => b.membersThreshold - a.membersThreshold);

  return applicable.length ? applicable[0].discountPercent : 0;
}

module.exports = {
  computeMaxLineItemDiscountPercent,
  resolveApprovalTier,
  computeVolumeDiscountPercent,
};
