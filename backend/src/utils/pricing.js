/**
 * pricing.js — Pure pricing calculation functions for §7.5 Quote Builder.
 *
 * All functions are side-effect free and fully testable.
 * This file is mirrored at frontend/src/utils/pricing.js (ES module syntax).
 *
 * Pricing model formulas (FR-QUOTE-6):
 *   PMPM                  = basePrice × membershipCount × termMonths
 *   Flat Fee              = basePrice × quantity
 *   Monthly Fee           = basePrice × termMonths
 *   Per Unit/Transaction  = basePrice × annualUnits ÷ 12 × termMonths
 *   Per User/License      = basePrice × seats × termMonths
 *   Hourly Rate           = basePrice × estimatedHours
 *
 * Pricing strategy resolution (FR-QUOTE-7):
 *   Standard   → uses basePrice directly
 *   Tiered     → finds highest tier.min ≤ volume; uses that tier's price
 *   Volume Bands → membership falls into a named band; uses that band's price
 */

/**
 * Resolves the effective price for a tiered pricing strategy.
 * @param {Array<{min: number, price: number}>} tiers - Sorted array of tier breakpoints
 * @param {number} volume - Membership count or quantity
 * @returns {number} Resolved tier price, or 0 if tiers is empty
 */
function resolveTieredPrice(tiers, volume) {
  if (!tiers || tiers.length === 0) return 0;
  // Sort descending by min; return first tier whose min ≤ volume
  const sorted = [...tiers].sort((a, b) => b.min - a.min);
  const match = sorted.find((t) => volume >= t.min);
  return match ? match.price : sorted[sorted.length - 1].price;
}

/**
 * Resolves the effective price and impl fee for a volume-band pricing strategy.
 * @param {Array<{label: string, maxMembers: number|null, price: number, implPrice: number}>} bands
 * @param {number} membershipCount
 * @returns {{ price: number, implPrice: number, bandIndex: number }}
 */
function resolveVolumeBand(bands, membershipCount) {
  if (!bands || bands.length === 0)
    return { price: 0, implPrice: 0, bandIndex: -1 };
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    // Final band has no upper bound (maxMembers null/undefined)
    if (band.maxMembers == null || membershipCount <= band.maxMembers) {
      return { price: band.price, implPrice: band.implPrice, bandIndex: i };
    }
  }
  // Fallback: last band
  const last = bands[bands.length - 1];
  return {
    price: last.price,
    implPrice: last.implPrice,
    bandIndex: bands.length - 1,
  };
}

/**
 * Calculates the total contract value for a single line item.
 *
 * @param {object} product - Product document
 * @param {object} params
 * @param {number} params.membershipCount - Total membership count for the quote
 * @param {number} params.termMonths - Contract term length in months
 * @param {number} [params.quantity=1] - Manually entered quantity (for quantity-based products)
 * @param {number} [params.annualUnits=0] - Annual transaction volume (Per Unit/Transaction model)
 * @param {number} [params.estimatedHours=0] - Hours estimate (Hourly Rate model)
 * @param {number} [params.parentBandIndex=-1] - Resolved band index from parent Core (for inheritance)
 * @returns {{ extendedPrice: number, implementationFee: number, effectivePrice: number }}
 */
function calculateLineItem(product, params) {
  const {
    membershipCount = 0,
    termMonths = 12,
    quantity = 1,
    annualUnits = 0,
    estimatedHours = 0,
    parentBandIndex = -1,
  } = params;

  const volume = product.isQuantityBased ? quantity : membershipCount;

  // ── Resolve effective price based on strategy ─────────────────────────────
  let effectivePrice = product.basePrice || 0;
  let implFee = product.implementationFee || 0;

  if (product.pricingStrategy === "Tiered") {
    effectivePrice = resolveTieredPrice(product.tiers, volume);
  } else if (product.pricingStrategy === "Volume Bands") {
    // If child inherits parent band index, use that index directly
    const bandIndex =
      product.inheritTierVolumesFromCore && parentBandIndex >= 0
        ? parentBandIndex
        : resolveVolumeBand(product.volumeBands, membershipCount).bandIndex;
    const band =
      product.volumeBands[bandIndex] ??
      product.volumeBands[product.volumeBands.length - 1];
    if (band) {
      effectivePrice = band.price;
      implFee = band.implPrice || 0;
    }
  }

  // ── Scope-based: excluded from TCV ───────────────────────────────────────
  if (product.scopeBasedPricing === "All") {
    return { extendedPrice: 0, implementationFee: 0, effectivePrice: 0 };
  }
  if (product.scopeBasedPricing === "Implementation Only") {
    implFee = 0; // TBD — exclude from totals
  }

  // ── Calculate extended price by pricing model ─────────────────────────────
  let extendedPrice = 0;

  switch (product.pricingModel) {
    case "PMPM":
      // For Standard: effectivePrice = PMPM rate; total = PMPM × members × months
      // For Tiered:   effectivePrice from tier = total monthly fee; effective PMPM = fee / members
      extendedPrice =
        product.pricingStrategy === "Tiered"
          ? effectivePrice * termMonths // tier price is total monthly fee
          : effectivePrice * membershipCount * termMonths;
      // isQuantityBased (e.g. per-form PMPM): multiply price and impl fee by quantity
      if (product.isQuantityBased) {
        extendedPrice *= quantity;
        implFee *= quantity;
      }
      break;
    case "Flat Fee":
      extendedPrice = effectivePrice * quantity;
      break;
    case "Monthly Fee":
      extendedPrice = effectivePrice * termMonths;
      break;
    case "Per Unit / Transaction":
      extendedPrice = ((effectivePrice * annualUnits) / 12) * termMonths;
      break;
    case "Per User / License":
      extendedPrice = effectivePrice * quantity * termMonths;
      break;
    case "Hourly Rate":
      extendedPrice = effectivePrice * estimatedHours;
      break;
    default:
      extendedPrice = 0;
  }

  return {
    extendedPrice: Math.round(extendedPrice * 100) / 100,
    implementationFee: Math.round(implFee * 100) / 100,
    effectivePrice: Math.round(effectivePrice * 100) / 100,
  };
}

/**
 * Applies a line-item adjustment (discount or uplift).
 * @param {number} baseAmount
 * @param {{ type: 'percentage'|'flat', value: number, direction: 'discount'|'uplift' }} adjustment
 * @returns {number} Adjusted amount
 */
function applyLineItemAdjustment(baseAmount, adjustment) {
  if (!adjustment || !adjustment.value) return baseAmount;
  const { type, value, direction } = adjustment;
  const delta = type === "percentage" ? baseAmount * (value / 100) : value;
  return direction === "discount"
    ? Math.round((baseAmount - delta) * 100) / 100
    : Math.round((baseAmount + delta) * 100) / 100;
}

/**
 * Calculates the financial summary for a full quote.
 * @param {Array} lineItems - Array of { product, params, adjustment? }
 * @param {number} membershipCount
 * @param {number} termMonths
 * @param {{ type: 'discount'|'surcharge', discountType: 'percentage'|'flat', value: number }} [globalAdj]
 * @returns {object} Quote summary totals
 */
function calculateQuoteSummary(
  lineItems,
  membershipCount,
  termMonths,
  globalAdj,
) {
  let totalPMPM = 0;
  let totalMonthlyFees = 0;
  let totalImplementation = 0;
  let grossTCV = 0;

  for (const item of lineItems) {
    const { extendedPrice, implementationFee } = calculateLineItem(
      item.product,
      { ...item.params, membershipCount, termMonths },
    );

    const adjusted = item.adjustment
      ? applyLineItemAdjustment(extendedPrice, item.adjustment)
      : extendedPrice;

    if (item.product.pricingModel === "PMPM") {
      totalPMPM += adjusted / (membershipCount || 1) / termMonths;
    } else if (item.product.pricingModel === "Monthly Fee") {
      totalMonthlyFees += adjusted / termMonths;
    }

    grossTCV += adjusted;
    totalImplementation += implementationFee;
  }

  const monthlyTotal = totalPMPM * membershipCount + totalMonthlyFees;
  const arr = monthlyTotal * 12;

  let globalAdjustmentAmount = 0;
  if (globalAdj && globalAdj.value) {
    globalAdjustmentAmount =
      globalAdj.discountType === "percentage"
        ? grossTCV * (globalAdj.value / 100)
        : globalAdj.value;
    if (globalAdj.type === "surcharge") globalAdjustmentAmount *= -1;
  }

  const netTCV = Math.round((grossTCV - globalAdjustmentAmount) * 100) / 100;

  return {
    totalPMPM: Math.round(totalPMPM * 10000) / 10000,
    totalMonthlyFees: Math.round(totalMonthlyFees * 100) / 100,
    monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    arr: Math.round(arr * 100) / 100,
    implementationTotal: Math.round(totalImplementation * 100) / 100,
    grossTCV: Math.round(grossTCV * 100) / 100,
    globalAdjustmentAmount: Math.round(globalAdjustmentAmount * 100) / 100,
    netTCV,
  };
}

/**
 * Computes a year-by-year revenue breakdown for multi-year quotes (FR-QUOTE-13).
 *
 * - One-time fees (billingType "One-Time" or pricingModel "Flat Fee") appear in Year 1 only.
 * - Recurring items get the annual uplift factor applied from Year 2 onwards.
 *
 * @param {Array} lineItems  - Same shape as calculateQuoteSummary lineItems
 * @param {number} membershipCount
 * @param {number} termMonths  - Total contract term; must be > 12 to produce output
 * @param {number} annualUplift - Percentage uplift (e.g. 3 = 3%)
 * @returns {Array<{year: number, revenue: number}>} Empty array if termMonths ≤ 12
 */
function computeYearlySummary(
  lineItems,
  membershipCount,
  termMonths,
  annualUplift,
) {
  const numYears = Math.ceil(termMonths / 12);
  if (numYears <= 1) return [];

  const result = [];

  for (let year = 1; year <= numYears; year++) {
    // Last year may be a partial year
    const yearMonths = year < numYears ? 12 : termMonths % 12 || 12;
    const upliftFactor = Math.pow(1 + (annualUplift || 0) / 100, year - 1);
    let yearRevenue = 0;

    for (const item of lineItems) {
      const isOneTime =
        item.product.billingType === "One-Time" ||
        item.product.pricingModel === "Flat Fee";

      if (isOneTime) {
        // Attribute full one-time cost to Year 1 only
        if (year === 1) {
          const { extendedPrice } = calculateLineItem(item.product, {
            ...item.params,
            membershipCount,
          });
          const adjusted = item.adjustment
            ? applyLineItemAdjustment(extendedPrice, item.adjustment)
            : extendedPrice;
          yearRevenue += adjusted;
        }
      } else {
        // Recurring: 12 months per year (partial for last year) with uplift
        const { extendedPrice } = calculateLineItem(item.product, {
          ...item.params,
          membershipCount,
          termMonths: yearMonths,
        });
        const adjusted = item.adjustment
          ? applyLineItemAdjustment(extendedPrice, item.adjustment)
          : extendedPrice;
        yearRevenue += adjusted * upliftFactor;
      }
    }

    result.push({ year, revenue: Math.round(yearRevenue * 100) / 100 });
  }

  return result;
}

module.exports = {
  resolveTieredPrice,
  resolveVolumeBand,
  calculateLineItem,
  applyLineItemAdjustment,
  calculateQuoteSummary,
  computeYearlySummary,
};
