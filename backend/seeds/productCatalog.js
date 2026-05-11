/**
 * Seed data for the product catalog (§7.4).
 *
 * Generic examples — no real company names, pricing, or proprietary data.
 *
 * This module is loaded lazily by productService.resetCatalog() and directly
 * by the seed runner (seeds/index.js).
 *
 * NOTE: productLineId fields are resolved by name at runtime inside
 * seedProductCatalog() below, so this data is safe to export as a plain array.
 */

/**
 * Products with productLineName for seed resolution.
 * At runtime, productLineName is converted to a real productLineId.
 */
const productCatalogSeed = [
  // ── Core products ──────────────────────────────────────────────────────────
  {
    name: "Care Management Platform",
    sku: "CMP-001",
    productLineName: "Care Management",
    type: "Core",
    pricingModel: "PMPM",
    pricingStrategy: "Standard",
    billingType: "Recurring (Monthly)",
    scopeBasedPricing: "None",
    basePrice: 10.0,
    unitCost: 4.0,
    implementationFee: 15000,
    overagePrice: 0,
    isBaselineProduct: true,
    isQuantityBased: false,
    inheritTierVolumesFromCore: false,
    tiers: [],
    volumeBands: [],
    description: "Full-featured care management and coordination platform.",
  },
  {
    name: "Behavioral Health Core",
    sku: "BH-001",
    productLineName: "Behavioral Health",
    type: "Core",
    pricingModel: "PMPM",
    pricingStrategy: "Tiered",
    billingType: "Recurring (Monthly)",
    scopeBasedPricing: "None",
    basePrice: 0,
    unitCost: 3.5,
    implementationFee: 12000,
    overagePrice: 0,
    isBaselineProduct: false,
    isQuantityBased: false,
    inheritTierVolumesFromCore: false,
    tiers: [
      { min: 0, price: 12.0 },
      { min: 1000, price: 10.0 },
      { min: 5000, price: 8.5 },
      { min: 20000, price: 7.0 },
    ],
    volumeBands: [],
    description: "Core behavioral health and mental wellness module.",
  },
  {
    name: "Pharmacy Benefits Management",
    sku: "PBM-001",
    productLineName: "Pharmacy Benefits",
    type: "Core",
    pricingModel: "PMPM",
    pricingStrategy: "Volume Bands",
    billingType: "Recurring (Monthly)",
    scopeBasedPricing: "None",
    basePrice: 0,
    unitCost: 5.0,
    implementationFee: 0,
    overagePrice: 0,
    isBaselineProduct: false,
    isQuantityBased: false,
    inheritTierVolumesFromCore: false,
    tiers: [],
    volumeBands: [
      {
        label: "Starter (< 2,000)",
        maxMembers: 1999,
        price: 18.0,
        implPrice: 20000,
      },
      {
        label: "Growth (2,000–9,999)",
        maxMembers: 9999,
        price: 14.0,
        implPrice: 15000,
      },
      {
        label: "Enterprise (10,000+)",
        maxMembers: null,
        price: 10.5,
        implPrice: 10000,
      },
    ],
    description: "Full pharmacy benefit management with formulary management.",
  },

  // ── Child products ─────────────────────────────────────────────────────────
  {
    name: "Care Gaps Analytics Module",
    sku: "CMP-CG-001",
    productLineName: "Care Management",
    type: "Child",
    pricingModel: "Monthly Fee",
    pricingStrategy: "Standard",
    billingType: "Recurring (Monthly)",
    scopeBasedPricing: "None",
    basePrice: 2500,
    unitCost: 800,
    implementationFee: 3000,
    overagePrice: 0,
    isBaselineProduct: false,
    isQuantityBased: false,
    inheritTierVolumesFromCore: true,
    tiers: [],
    volumeBands: [],
    description: "Analytics module for identifying and closing care gaps.",
  },
  {
    name: "Crisis Intervention Module",
    sku: "BH-CI-001",
    productLineName: "Behavioral Health",
    type: "Child",
    pricingModel: "PMPM",
    pricingStrategy: "Standard",
    billingType: "Recurring (Monthly)",
    scopeBasedPricing: "None",
    basePrice: 1.5,
    unitCost: 0.5,
    implementationFee: 2000,
    overagePrice: 0,
    isBaselineProduct: false,
    isQuantityBased: false,
    inheritTierVolumesFromCore: true,
    tiers: [],
    volumeBands: [],
    description: "24/7 crisis intervention and escalation module.",
  },

  // ── Add-on products ────────────────────────────────────────────────────────
  {
    name: "Member Engagement Portal",
    sku: "ADD-MEP-001",
    productLineName: "Wellness Programs",
    type: "Add-on",
    pricingModel: "Per User / License",
    pricingStrategy: "Standard",
    billingType: "Recurring (Monthly)",
    scopeBasedPricing: "None",
    basePrice: 3.0,
    unitCost: 1.0,
    implementationFee: 5000,
    overagePrice: 0,
    isBaselineProduct: false,
    isQuantityBased: true,
    inheritTierVolumesFromCore: false,
    tiers: [],
    volumeBands: [],
    description: "Self-service member portal for wellness program enrollment.",
  },
  {
    name: "Implementation & Training Services",
    sku: "SVC-IMPL-001",
    productLineName: null,
    type: "Add-on",
    pricingModel: "Hourly Rate",
    pricingStrategy: "Standard",
    billingType: "One-Time",
    scopeBasedPricing: "Implementation Only",
    basePrice: 175,
    unitCost: 80,
    implementationFee: 0,
    overagePrice: 0,
    isBaselineProduct: false,
    isQuantityBased: false,
    inheritTierVolumesFromCore: false,
    tiers: [],
    volumeBands: [],
    description: "Professional services for implementation and staff training.",
  },
  {
    name: "Dental & Vision Basic Bundle",
    sku: "DV-BASIC-001",
    productLineName: "Dental & Vision",
    type: "Core",
    pricingModel: "Flat Fee",
    pricingStrategy: "Standard",
    billingType: "Recurring (Monthly)",
    scopeBasedPricing: "None",
    basePrice: 8000,
    unitCost: 3000,
    implementationFee: 5000,
    overagePrice: 0,
    isBaselineProduct: false,
    isQuantityBased: false,
    inheritTierVolumesFromCore: false,
    tiers: [],
    volumeBands: [],
    description: "Basic dental and vision benefits administration bundle.",
  },
];

/**
 * Seed function — resolves productLine names to IDs and inserts products.
 * Skips if products already exist.
 *
 * @param {import("mongoose").Model} Product
 * @param {import("mongoose").Model} ProductLine
 */
async function seedProductCatalog(Product, ProductLine) {
  const count = await Product.countDocuments();
  if (count > 0) {
    console.log(`  Products: ${count} already exist — skipping seed.`);
    return;
  }

  // Build name → _id map
  const lines = await ProductLine.find({}, "_id name").lean();
  const lineMap = {};
  for (const line of lines) {
    lineMap[line.name] = line._id;
  }

  const docs = productCatalogSeed.map(({ productLineName, ...rest }) => ({
    ...rest,
    productLineId: productLineName ? (lineMap[productLineName] ?? null) : null,
  }));

  await Product.insertMany(docs);
  console.log(`  Products: inserted ${docs.length} records.`);
}

/**
 * Plain array export for productService.resetCatalog().
 * productLineId fields are omitted — reset uses name resolution inside resetCatalog.
 */
module.exports = productCatalogSeed;
module.exports.seedProductCatalog = seedProductCatalog;
