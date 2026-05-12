/**
 * Seed data for the quotes collection (§7.5 / §7.6 / §7.8).
 *
 * Generates 7 representative quotes covering all statuses (Draft,
 * Manager Review, Executive Review, Approved, Rejected) with a variety of
 * membership sizes, term lengths, product combinations, and adjustment
 * scenarios — including two quotes pending in the approval queue.
 *
 * Financial totals are computed programmatically via the shared pricing
 * utility so the seed stays consistent if pricing logic ever changes.
 *
 * Runs after seedUsers, seedProductLines, and seedProductCatalog.
 * Generic client names — no real company data.
 */

const { calculateLineItem } = require("../src/utils/pricing");

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Applies a line-item adjustment to a price.
 * @param {number} price
 * @param {{ direction: string, type: string, value: number }} adj
 * @returns {number}
 */
function applyAdjustment(price, adj) {
  if (!adj || !adj.value) return price;
  const delta =
    adj.type === "percentage" ? price * (adj.value / 100) : adj.value;
  return adj.direction === "discount" ? price - delta : price + delta;
}

/**
 * Builds the selectedItems array and computes the quote summary totals from
 * a list of line-item descriptors.
 *
 * @param {Array<{product: object, params?: object, adjustment?: object}>} lineItems
 * @param {number} membershipCount
 * @param {number} termMonths
 * @returns {{ selectedItems: Array, summary: object }}
 */
function buildQuoteItems(lineItems, membershipCount, termMonths) {
  let totalPMPM = 0;
  let totalMonthlyFees = 0;
  let totalImplementation = 0;
  let grossTCV = 0;

  const selectedItems = lineItems.map(
    ({ product, params = {}, adjustment }) => {
      const { extendedPrice, implementationFee } = calculateLineItem(product, {
        ...params,
        membershipCount,
        termMonths,
      });

      const adjustedPrice = adjustment
        ? applyAdjustment(extendedPrice, adjustment)
        : extendedPrice;

      if (product.pricingModel === "PMPM") {
        totalPMPM += adjustedPrice / (membershipCount || 1) / termMonths;
      } else if (product.pricingModel === "Monthly Fee") {
        totalMonthlyFees += adjustedPrice / termMonths;
      }

      grossTCV += adjustedPrice;
      totalImplementation += implementationFee;

      return {
        productId: product._id,
        productSnapshot: product,
        quantity: params.quantity ?? 1,
        annualUnits: params.annualUnits ?? 0,
        estimatedHours: params.estimatedHours ?? 0,
        adjustmentDirection: adjustment?.direction ?? null,
        adjustmentType: adjustment?.type ?? null,
        adjustmentValue: adjustment?.value ?? 0,
        extendedPrice,
        implementationFee,
        adjustedPrice,
      };
    },
  );

  const monthlyTotal = totalPMPM * membershipCount + totalMonthlyFees;
  const arr = monthlyTotal * 12;

  return {
    selectedItems,
    summary: {
      totalPMPM: Math.round(totalPMPM * 10000) / 10000,
      totalMonthlyFees: Math.round(totalMonthlyFees * 100) / 100,
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      implementationTotal: Math.round(totalImplementation * 100) / 100,
      grossTCV: Math.round(grossTCV * 100) / 100,
    },
  };
}

/**
 * Computes a year-by-year revenue breakdown for multi-year quotes (FR-QUOTE-13).
 * Mirrors the logic in frontend/src/utils/pricing.js#computeYearlySummary.
 *
 * @param {Array} lineItems - Same shape as buildQuoteItems
 * @param {number} membershipCount
 * @param {number} termMonths
 * @param {number} annualUplift - Percentage, e.g. 3 = 3%
 * @returns {Array<{year: number, revenue: number}>}
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
    const yearMonths = year < numYears ? 12 : termMonths % 12 || 12;
    const upliftFactor = Math.pow(1 + (annualUplift || 0) / 100, year - 1);
    let yearRevenue = 0;

    for (const { product, params = {}, adjustment } of lineItems) {
      const isOneTime =
        product.billingType === "One-Time" ||
        product.pricingModel === "Flat Fee";

      if (isOneTime) {
        if (year === 1) {
          const { extendedPrice } = calculateLineItem(product, {
            ...params,
            membershipCount,
            termMonths: yearMonths,
          });
          yearRevenue += adjustment
            ? applyAdjustment(extendedPrice, adjustment)
            : extendedPrice;
        }
      } else {
        const { extendedPrice } = calculateLineItem(product, {
          ...params,
          membershipCount,
          termMonths: yearMonths,
        });
        const adjusted = adjustment
          ? applyAdjustment(extendedPrice, adjustment)
          : extendedPrice;
        yearRevenue += adjusted * upliftFactor;
      }
    }

    result.push({ year, revenue: Math.round(yearRevenue * 100) / 100 });
  }

  return result;
}

// ── Main seed function ────────────────────────────────────────────────────────

/**
 * @param {import("mongoose").Model} Quote
 * @param {import("mongoose").Model} User
 * @param {import("mongoose").Model} Product
 * @param {import("mongoose").Model} ProductLine
 */
async function seedQuotes(Quote, User, Product, ProductLine) {
  const count = await Quote.countDocuments();
  if (count > 0) {
    console.log(`  Quotes: ${count} already exist — skipping seed.`);
    return;
  }

  // ── Resolve users ─────────────────────────────────────────────────────────
  const [salesRep, salesMgr, exec] = await Promise.all([
    User.findOne({ email: "salesrep@example.com" }).lean(),
    User.findOne({ email: "salesmanager@example.com" }).lean(),
    User.findOne({ email: "executive@example.com" }).lean(),
  ]);

  if (!salesRep || !salesMgr || !exec) {
    console.warn(
      "  Quotes: one or more required seed users not found — skipping.",
    );
    return;
  }

  // ── Resolve product line ──────────────────────────────────────────────────
  const healthPortalsLine = await ProductLine.findOne({
    name: "Health Portals",
  }).lean();
  if (!healthPortalsLine) {
    console.warn(
      "  Quotes: 'Health Portals' product line not found — skipping.",
    );
    return;
  }

  // ── Resolve products ──────────────────────────────────────────────────────
  const skus = [
    "NAV-BASE-001", // Platform Baseline (isBaselineProduct)
    "NAV-MBR-001", // Member Portal
    "NAV-PRV-001", // Provider Portal
    "NAV-APP-001", // Member Mobile App
    "NAV-EMP-001", // Employer Portal
    "NAV-CPS-001", // Consumer Provider Search (Standard PMPM)
    "NAV-SHC-001", // Streaming Health Content (Standard PMPM)
  ];

  const productDocs = await Promise.all(
    skus.map((sku) => Product.findOne({ sku }).lean()),
  );

  const [
    baseline,
    memberPortal,
    providerPortal,
    mobileApp,
    employerPortal,
    consumerSearch,
    streamingContent,
  ] = productDocs;

  if (productDocs.some((p) => !p)) {
    const missing = skus.filter((_, i) => !productDocs[i]);
    console.warn(
      `  Quotes: products not found (${missing.join(", ")}) — skipping.`,
    );
    return;
  }

  const lineIds = [healthPortalsLine._id];

  // ── Quote 1 — Regional Health Partners (Draft) ────────────────────────────
  // Small plan, 12-month term, two products, no adjustments.
  const q1 = (() => {
    const members = 25000;
    const term = 12;
    const lineItems = [
      { product: baseline, params: {} },
      { product: memberPortal, params: {} },
    ];
    const { selectedItems, summary } = buildQuoteItems(
      lineItems,
      members,
      term,
    );
    return {
      clientName: "Regional Health Partners",
      effectiveDate: new Date("2026-07-01"),
      membershipCount: members,
      termLength: term,
      annualUplift: 0,
      selectedItems,
      activeProductLineIds: lineIds,
      globalAdjustmentType: null,
      globalDiscountType: "percentage",
      globalDiscountValue: 0,
      ...summary,
      globalAdjustmentAmount: 0,
      netTCV: summary.grossTCV,
      yearlySummary: [],
      productLineIds: lineIds,
      hasScopeBasedItems: false,
      status: "Draft",
      ownerId: salesRep._id,
    };
  })();

  // ── Quote 2 — Lakeside Blue Cross (Manager Review, 12% line-item discount) ──
  // Mid-size plan, 24-month term with 3% annual uplift, four products.
  // A 12% discount on the Member Portal exceeds the 10% manager threshold,
  // routing this quote to the sales manager approval queue.
  const q2 = (() => {
    const members = 85000;
    const term = 24;
    const uplift = 3;
    const discount12 = { direction: "discount", type: "percentage", value: 12 };
    const lineItems = [
      { product: baseline, params: {} },
      { product: memberPortal, params: {}, adjustment: discount12 },
      { product: providerPortal, params: {} },
      { product: consumerSearch, params: {} },
    ];
    const { selectedItems, summary } = buildQuoteItems(
      lineItems,
      members,
      term,
    );
    return {
      clientName: "Lakeside Blue Cross",
      effectiveDate: new Date("2026-08-01"),
      membershipCount: members,
      termLength: term,
      annualUplift: uplift,
      selectedItems,
      activeProductLineIds: lineIds,
      globalAdjustmentType: null,
      globalDiscountType: "percentage",
      globalDiscountValue: 0,
      ...summary,
      globalAdjustmentAmount: 0,
      netTCV: summary.grossTCV,
      yearlySummary: computeYearlySummary(lineItems, members, term, uplift),
      productLineIds: lineIds,
      hasScopeBasedItems: false,
      status: "Manager Review",
      ownerId: salesRep._id,
    };
  })();

  // ── Quote 3 — Summit Health Alliance (Approved) ────────────────────────────
  // Large enterprise plan, 36-month term with 2% annual uplift, four products.
  const q3 = (() => {
    const members = 320000;
    const term = 36;
    const uplift = 2;
    const lineItems = [
      { product: baseline, params: {} },
      { product: memberPortal, params: {} },
      { product: mobileApp, params: {} },
      { product: providerPortal, params: {} },
    ];
    const { selectedItems, summary } = buildQuoteItems(
      lineItems,
      members,
      term,
    );
    return {
      clientName: "Summit Health Alliance",
      effectiveDate: new Date("2025-01-01"),
      membershipCount: members,
      termLength: term,
      annualUplift: uplift,
      selectedItems,
      activeProductLineIds: lineIds,
      globalAdjustmentType: null,
      globalDiscountType: "percentage",
      globalDiscountValue: 0,
      ...summary,
      globalAdjustmentAmount: 0,
      netTCV: summary.grossTCV,
      yearlySummary: computeYearlySummary(lineItems, members, term, uplift),
      productLineIds: lineIds,
      hasScopeBasedItems: false,
      status: "Approved",
      ownerId: salesMgr._id,
      approvedBy: exec._id,
      approvalComment: "Strong strategic fit and healthy margins. Approved.",
    };
  })();

  // ── Quote 4 — Northern Plains Health (Rejected) ────────────────────────────
  // Small plan; sales rep applied a 15% line-item discount that exceeded the
  // approval threshold — rejected by the executive.
  const q4 = (() => {
    const members = 12000;
    const term = 12;
    const discount15 = { direction: "discount", type: "percentage", value: 15 };
    const lineItems = [
      { product: baseline, params: {} },
      { product: memberPortal, params: {}, adjustment: discount15 },
    ];
    const { selectedItems, summary } = buildQuoteItems(
      lineItems,
      members,
      term,
    );
    return {
      clientName: "Northern Plains Health",
      effectiveDate: new Date("2026-06-01"),
      membershipCount: members,
      termLength: term,
      annualUplift: 0,
      selectedItems,
      activeProductLineIds: lineIds,
      globalAdjustmentType: null,
      globalDiscountType: "percentage",
      globalDiscountValue: 0,
      ...summary,
      globalAdjustmentAmount: 0,
      netTCV: summary.grossTCV,
      yearlySummary: [],
      productLineIds: lineIds,
      hasScopeBasedItems: false,
      status: "Rejected",
      ownerId: salesRep._id,
      approvedBy: exec._id,
      approvalComment:
        "Discount exceeds approved threshold without sufficient strategic justification. Please resubmit with revised pricing.",
    };
  })();

  // ── Quote 5 — Coastal Wellness Plan (Draft) ────────────────────────────────
  // Mid-size plan; sales manager exploring a member, employer, and content bundle.
  const q5 = (() => {
    const members = 50000;
    const term = 12;
    const lineItems = [
      { product: baseline, params: {} },
      { product: memberPortal, params: {} },
      { product: employerPortal, params: {} },
      { product: streamingContent, params: {} },
    ];
    const { selectedItems, summary } = buildQuoteItems(
      lineItems,
      members,
      term,
    );
    return {
      clientName: "Coastal Wellness Plan",
      effectiveDate: new Date("2026-09-01"),
      membershipCount: members,
      termLength: term,
      annualUplift: 0,
      selectedItems,
      activeProductLineIds: lineIds,
      globalAdjustmentType: null,
      globalDiscountType: "percentage",
      globalDiscountValue: 0,
      ...summary,
      globalAdjustmentAmount: 0,
      netTCV: summary.grossTCV,
      yearlySummary: [],
      productLineIds: lineIds,
      hasScopeBasedItems: false,
      status: "Draft",
      ownerId: salesMgr._id,
    };
  })();

  // ── Quote 6 — Prairie States Health (Executive Review, 28% line-item discount)
  // Large plan; the sales rep applied a 28% discount on all core products,
  // exceeding the 25% executive threshold and routing to the executive queue.
  const q6 = (() => {
    const members = 175000;
    const term = 24;
    const uplift = 2;
    const discount28 = { direction: "discount", type: "percentage", value: 28 };
    const lineItems = [
      { product: baseline, params: {} },
      { product: memberPortal, params: {}, adjustment: discount28 },
      { product: mobileApp, params: {} },
      { product: providerPortal, params: {} },
      { product: consumerSearch, params: {} },
    ];
    const { selectedItems, summary } = buildQuoteItems(
      lineItems,
      members,
      term,
    );
    return {
      clientName: "Prairie States Health",
      effectiveDate: new Date("2026-10-01"),
      membershipCount: members,
      termLength: term,
      annualUplift: uplift,
      selectedItems,
      activeProductLineIds: lineIds,
      globalAdjustmentType: null,
      globalDiscountType: "percentage",
      globalDiscountValue: 0,
      ...summary,
      globalAdjustmentAmount: 0,
      netTCV: summary.grossTCV,
      yearlySummary: computeYearlySummary(lineItems, members, term, uplift),
      productLineIds: lineIds,
      hasScopeBasedItems: false,
      status: "Executive Review",
      ownerId: salesRep._id,
    };
  })();

  // ── Quote 7 — Heartland Managed Care (Manager Review, 18% line-item discount)
  // Mid-size plan owned by the sales manager; 18% discount on streaming content
  // exceeds the 10% manager threshold, routing to manager approval queue.
  const q7 = (() => {
    const members = 62000;
    const term = 12;
    const discount18 = { direction: "discount", type: "percentage", value: 18 };
    const lineItems = [
      { product: baseline, params: {} },
      { product: memberPortal, params: {} },
      { product: streamingContent, params: {}, adjustment: discount18 },
      { product: employerPortal, params: {} },
    ];
    const { selectedItems, summary } = buildQuoteItems(
      lineItems,
      members,
      term,
    );
    return {
      clientName: "Heartland Managed Care",
      effectiveDate: new Date("2026-09-15"),
      membershipCount: members,
      termLength: term,
      annualUplift: 0,
      selectedItems,
      activeProductLineIds: lineIds,
      globalAdjustmentType: null,
      globalDiscountType: "percentage",
      globalDiscountValue: 0,
      ...summary,
      globalAdjustmentAmount: 0,
      netTCV: summary.grossTCV,
      yearlySummary: [],
      productLineIds: lineIds,
      hasScopeBasedItems: false,
      status: "Manager Review",
      ownerId: salesMgr._id,
    };
  })();

  await Quote.insertMany([q1, q2, q3, q4, q5, q6, q7]);
  console.log("  Quotes: inserted 7 records.");
}

module.exports = seedQuotes;
