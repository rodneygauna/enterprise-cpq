/**
 * tooltips.js — Central tooltip registry (FR-TTIP-5)
 *
 * Single source of truth for all contextual tooltip text in the application.
 * No tooltip string may appear inline in any component or page.
 *
 * Organisation: namespaced by domain / page.
 * To add a new tooltip:
 *   1. Add the key + plain-text string to the correct namespace below.
 *   2. Reference it in the component: <FieldHelp text={TOOLTIPS.<ns>.<key>} />
 *
 * See docs/TOOLTIP_CONVENTION.md for the full convention.
 */

export const TOOLTIPS = {
  // ── Quote Builder (QuoteBuilder.jsx + QuoteSummaryPanel.jsx) ───────────────
  quoteBuilder: {
    clientName:
      "The name of the client or prospect this quote is being prepared for.",
    effectiveDate:
      "The contract start date. Multi-year pricing and annual uplift are calculated from this date.",
    membershipCount:
      "Total number of covered members. Used in PMPM pricing calculations — the monthly recurring fee equals base price × member count.",
    termLength:
      "Contract duration in months. A term of 12 = 1 year; 24 = 2 years. Annual uplift is applied at each 12-month anniversary.",
    annualUplift:
      "Percentage price increase applied to recurring fees at each contract year anniversary. For example, 3% means year-2 recurring fees are 3% higher than year-1.",
    adjustmentDirection:
      "Choose whether to increase (surcharge) or decrease (discount) the total quote value using the global adjustment below.",
    adjustmentType:
      "Percent applies the adjustment as a fraction of the total; Flat applies a fixed dollar amount.",
    adjustmentValue:
      "The magnitude of the adjustment. Combined with direction and type to calculate the final adjusted total.",
  },

  // ── Product Catalog (Products.jsx) ────────────────────────────────────────
  products: {
    sku: "Stock Keeping Unit — a unique internal identifier for this product. Used in exports and Salesforce sync.",
    productLineId:
      "The product line this product belongs to. Products in the same line share display color and grouping in quotes.",
    type: "Core products are the primary sold item. Child products are bundled dependents that appear automatically when a compatible Core is selected and inherit its volume. Add-on products are optional enhancements a sales rep can attach to any quote.",
    pricingModel:
      "PMPM (Per Member Per Month): price scales with membership count. Flat Fee: a single fixed price. Monthly Fee: a recurring monthly charge. Per Unit / Transaction: priced per recorded transaction. Per User / License: priced per seat. Hourly Rate: priced per hour of work.",
    pricingStrategy:
      "Standard: a single flat rate. Tiered: each unit is priced at the rate for its own quantity bracket (step-pricing). Volume Bands: all units are priced at the rate for the total quantity tier.",
    billingType:
      "One-Time: charged once at contract start. Recurring (Monthly): charged each month. Usage / Transactional: charged based on actual usage. Time & Materials: charged based on time logged.",
    basePrice:
      "The standard list price for this product before any discounts or adjustments.",
    unitCost:
      "Your internal cost to deliver this product. Used to calculate gross margin. Not visible to the buyer.",
    implementationFee:
      "A one-time setup fee charged at contract start in addition to any recurring fees.",
    overagePrice:
      "Price per unit charged when usage exceeds the contracted quantity (applicable to usage-based products).",
    isBaselineProduct:
      "Baseline products are included in every quote as required line items and cannot be removed by a sales rep.",
    isQuantityBased:
      "When enabled, sales reps can enter a custom quantity for this product on the quote. When disabled, it is sold as a single unit.",
    inheritTierVolumesFromCore:
      "When enabled, this add-on product uses the same tier or volume thresholds as the core product it is linked to, rather than its own separate tiers.",
    tiers:
      "Pricing tiers define price breakpoints by quantity. Add as many rows as needed. Each tier's minimum quantity determines when that price takes effect.",
    volumeBands:
      "Volume bands define price thresholds for volume-based pricing. When total quantity falls within a band, all units are priced at that band's per-unit rate.",
    scopeBasedPricing:
      "None: pricing is fully defined and included in quote totals. All: the entire price is TBD — the line item displays a 'Requires Scope Review' badge and is excluded from TCV totals. Implementation Only: the implementation fee is TBD (excluded from totals) while recurring fees display normally.",
    compatibleCoreIds:
      "Select the core products this add-on can be paired with. Sales reps will only see this add-on when a compatible core is already on the quote.",
    recommendedProductIds:
      "Products listed here will be suggested to sales reps as complementary items when this product is on a quote.",
  },

  // ── Settings (Settings.jsx) ───────────────────────────────────────────────
  settings: {
    companyName:
      "Displayed in the application header and included in exported proposals.",
    logoUrl:
      "Upload your company logo. Displayed in the application and on exported PDF proposals.",
    managerReviewPercent:
      "Discounts at or above this percentage require a Sales Manager to approve the quote before it can be sent.",
    executiveReviewPercent:
      "Discounts at or above this percentage require an Executive to approve the quote before it can be sent. Set this higher than the manager-level threshold.",
    marginGreen:
      "Quotes with a gross margin at or above this percentage are considered healthy (green traffic light). Margin = (revenue − cost) ÷ revenue.",
    marginYellow:
      "Quotes with a gross margin between this value and the green threshold are flagged for review (yellow traffic light). Quotes below this value are red and require Executive Review.",
  },

  // ── Product Lines (ProductLines.jsx) ──────────────────────────────────────
  productLines: {
    name: "The internal name of this product line. Displayed as a group heading in the quote builder and product catalog.",
    displayColor:
      "Hex color code used to color-code this product line's entries in the quote builder and dashboard. Enter a 6-digit hex value (e.g. #0d6efd).",
  },

  // ── Users (Users.jsx) ─────────────────────────────────────────────────────
  users: {
    inviteEmail:
      "The email address of the person being invited. They will receive an activation link valid for 24 hours to set up their account.",
    inviteRole:
      "Determines what the invited user can see and do in the system. Sales Reps can build quotes; Sales Managers can approve discounts; Admins manage products and users; Executives have read-only access to all quotes.",
  },
};
