/**
 * pricing.js — Pure pricing calculation functions for §7.5 Quote Builder.
 *
 * This file mirrors backend/src/utils/pricing.js exactly (ES module syntax).
 * All functions are side-effect free and fully testable.
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
 *   Standard    → uses basePrice directly
 *   Tiered      → finds highest tier.min ≤ volume; uses that tier's price
 *   Volume Bands → membership falls into a named band; uses that band's price
 */

/**
 * Resolves the effective price for a tiered pricing strategy.
 * @param {Array<{min: number, price: number}>} tiers - Sorted array of tier breakpoints
 * @param {number} volume - Membership count or quantity
 * @returns {number} Resolved tier price, or 0 if tiers is empty
 */
export function resolveTieredPrice(tiers, volume) {
  if (!tiers || tiers.length === 0) return 0;
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
export function resolveVolumeBand(bands, membershipCount) {
  if (!bands || bands.length === 0)
    return { price: 0, implPrice: 0, bandIndex: -1 };
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    if (band.maxMembers == null || membershipCount <= band.maxMembers) {
      return { price: band.price, implPrice: band.implPrice, bandIndex: i };
    }
  }
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
 * @param {number} params.membershipCount
 * @param {number} params.termMonths
 * @param {number} [params.quantity=1]
 * @param {number} [params.annualUnits=0]
 * @param {number} [params.estimatedHours=0]
 * @param {number} [params.parentBandIndex=-1]
 * @returns {{ extendedPrice: number, implementationFee: number, effectivePrice: number }}
 */
export function calculateLineItem(product, params) {
  const {
    membershipCount = 0,
    termMonths = 12,
    quantity = 1,
    annualUnits = 0,
    estimatedHours = 0,
    parentBandIndex = -1,
  } = params;

  const volume = product.isQuantityBased ? quantity : membershipCount;

  let effectivePrice = product.basePrice || 0;
  let implFee = product.implementationFee || 0;

  if (product.pricingStrategy === "Tiered") {
    effectivePrice = resolveTieredPrice(product.tiers, volume);
  } else if (product.pricingStrategy === "Volume Bands") {
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

  if (product.scopeBasedPricing === "All") {
    return { extendedPrice: 0, implementationFee: 0, effectivePrice: 0 };
  }
  if (product.scopeBasedPricing === "Implementation Only") {
    implFee = 0;
  }

  let extendedPrice = 0;

  switch (product.pricingModel) {
    case "PMPM":
      extendedPrice =
        product.pricingStrategy === "Tiered"
          ? effectivePrice * termMonths
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
export function applyLineItemAdjustment(baseAmount, adjustment) {
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
export function calculateQuoteSummary(
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
export function computeYearlySummary(
  lineItems,
  membershipCount,
  termMonths,
  annualUplift,
) {
  const numYears = Math.ceil(termMonths / 12);
  if (numYears <= 1) return [];

  const result = [];

  for (let year = 1; year <= numYears; year++) {
    const yearMonths = year < numYears ? 12 : termMonths % 12 || 12;
    const upliftFactor = Math.pow(1 + (annualUplift || 0) / 100, year - 1);
    let yearRevenue = 0;

    for (const item of lineItems) {
      const isOneTime =
        item.product.billingType === "One-Time" ||
        item.product.pricingModel === "Flat Fee";

      if (isOneTime) {
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

// ── §7.9 Margin Scoring ───────────────────────────────────────────────────────

/**
 * Computes the blended margin for a quote (FR-MARGIN-1).
 *
 * Items where productSnapshot.scopeBasedPricing (or item.product.scopeBasedPricing)
 * equals "All" are excluded from both revenue and cost.
 *
 * @param {object[]} selectedItems  array of quote line items
 *   Each item is expected to have:
 *     - adjustedPrice: number (post-adjustment extended revenue)
 *     - quantity: number (defaults to 1)
 *     - productSnapshot: { unitCost?, scopeBasedPricing? }  OR  item.product: {...}
 * @returns {{ totalRevenue: number, totalCost: number, grossProfit: number, marginPercent: number|null }}
 */
export function computeMargin(selectedItems = []) {
  let totalRevenue = 0;
  let totalCost = 0;

  for (const item of selectedItems) {
    const snap = item.productSnapshot ?? item.product ?? {};
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
 * Determines the margin traffic-light status (FR-MARGIN-3).
 *
 * Uses the most restrictive per-line override (highest green threshold) among
 * the quote's active product-line names; falls back to global thresholds.
 *
 * @param {number|null} marginPercent
 * @param {{ global?: { green?: number, yellow?: number }, productLines?: object }} marginTargets
 * @param {string[]} activeProductLineNames
 * @returns {"green"|"yellow"|"red"|null}
 */
export function resolveMarginStatus(
  marginPercent,
  marginTargets,
  activeProductLineNames = [],
) {
  if (marginPercent === null || marginPercent === undefined) return null;

  const g = marginTargets?.global ?? {};
  let effectiveGreen = g.green ?? 50;
  let effectiveYellow = g.yellow ?? 30;

  const lineOverrides = marginTargets?.productLines ?? {};
  for (const name of activeProductLineNames) {
    const ov = lineOverrides[name];
    if (ov && typeof ov.green === "number" && ov.green > effectiveGreen) {
      effectiveGreen = ov.green;
      effectiveYellow = ov.yellow ?? effectiveYellow;
    }
  }

  if (marginPercent >= effectiveGreen) return "green";
  if (marginPercent >= effectiveYellow) return "yellow";
  return "red";
}

/**
 * Calculates a live price preview for the ProductForm wizard (FR-PROD-11).
 *
 * Converts form state (string-typed fields from controlled inputs) into a
 * product-like object and delegates to calculateLineItem with preview inputs.
 *
 * Notes:
 *  - "Per Unit / Transaction" and "Hourly Rate" models return $0 because those
 *    pricing models require quantity/hours inputs not present in the preview.
 *  - Invalid numeric strings are treated as 0 rather than throwing.
 *
 * @param {object} form - ProductForm state (fields may be empty strings)
 * @param {number} [membershipCount=1000] - Preview membership count
 * @param {number} [termMonths=12] - Preview term in months
 * @returns {{ monthlyPrice: number, annualTotal: number, implementationFee: number }}
 */
export function previewPrice(form, membershipCount = 1000, termMonths = 12) {
  const mc = Math.max(0, Number(membershipCount) || 0);
  const tm = Math.max(1, Number(termMonths) || 12);

  const product = {
    pricingModel: form.pricingModel || "PMPM",
    pricingStrategy: form.pricingStrategy || "Standard",
    scopeBasedPricing: form.scopeBasedPricing || "None",
    basePrice:
      form.basePrice !== "" && form.basePrice != null
        ? Math.max(0, Number(form.basePrice) || 0)
        : 0,
    implementationFee:
      form.implementationFee !== "" && form.implementationFee != null
        ? Math.max(0, Number(form.implementationFee) || 0)
        : 0,
    isQuantityBased: Boolean(form.isQuantityBased),
    inheritTierVolumesFromCore: Boolean(form.inheritTierVolumesFromCore),
    tiers: (form.tiers || []).map((t) => ({
      min: Number(t.min) || 0,
      price: Number(t.price) || 0,
    })),
    volumeBands: (form.volumeBands || []).map((b) => ({
      label: b.label || "",
      maxMembers:
        b.maxMembers !== "" && b.maxMembers != null
          ? Number(b.maxMembers)
          : null,
      price: Number(b.price) || 0,
      implPrice: Number(b.implPrice) || 0,
    })),
  };

  const result = calculateLineItem(product, {
    membershipCount: mc,
    termMonths: tm,
    quantity: 1,
    annualUnits: 0,
    estimatedHours: 0,
  });

  const monthlyPrice =
    tm > 0 ? Math.round((result.extendedPrice / tm) * 100) / 100 : 0;

  return {
    monthlyPrice,
    annualTotal: result.extendedPrice,
    implementationFee: result.implementationFee,
  };
}
