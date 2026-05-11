const mongoose = require("mongoose");

// ── Enums (mirrors PRD Section 4 / mongoose-models.instructions.md) ─────────
const PRODUCT_TYPES = ["Core", "Child", "Add-on"];
const PRICING_MODELS = [
  "PMPM",
  "Flat Fee",
  "Monthly Fee",
  "Per Unit / Transaction",
  "Per User / License",
  "Hourly Rate",
];
const PRICING_STRATEGIES = ["Standard", "Tiered", "Volume Bands"];
const BILLING_TYPES = [
  "One-Time",
  "Recurring (Monthly)",
  "Usage / Transactional",
  "Time & Materials",
];
const SCOPE_BASED_PRICING = ["None", "All", "Implementation Only"];

const tierSchema = new mongoose.Schema(
  {
    min: { type: Number, required: true },
    price: { type: Number, required: true },
  },
  { _id: false },
);

const volumeBandSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    maxMembers: { type: Number }, // null/undefined = no upper bound (final band)
    price: { type: Number, required: true },
    implPrice: { type: Number, default: 0 },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    productLineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductLine",
      default: null,
    },
    type: { type: String, enum: PRODUCT_TYPES, default: "Core" },
    pricingModel: { type: String, enum: PRICING_MODELS, default: "PMPM" },
    pricingStrategy: {
      type: String,
      enum: PRICING_STRATEGIES,
      default: "Standard",
    },
    billingType: {
      type: String,
      enum: BILLING_TYPES,
      default: "Recurring (Monthly)",
    },
    basePrice: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
    implementationFee: { type: Number, default: 0, min: 0 },
    overagePrice: { type: Number, default: 0, min: 0 },
    isBaselineProduct: { type: Boolean, default: false },
    isQuantityBased: { type: Boolean, default: false },
    inheritTierVolumesFromCore: { type: Boolean, default: false },
    scopeBasedPricing: {
      type: String,
      enum: SCOPE_BASED_PRICING,
      default: "None",
    },
    tiers: { type: [tierSchema], default: [] },
    volumeBands: { type: [volumeBandSchema], default: [] },
    compatibleCoreIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],
    recommendedProductIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],
    description: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// Case-insensitive sparse unique index on SKU (optional field)
productSchema.index(
  { sku: 1 },
  { unique: true, sparse: true, collation: { locale: "en", strength: 2 } },
);
// Index for product line lookups (FR-LINE-3 guard + catalog filtering)
productSchema.index({ productLineId: 1 });

module.exports = mongoose.model("Product", productSchema);
module.exports.PRODUCT_TYPES = PRODUCT_TYPES;
module.exports.PRICING_MODELS = PRICING_MODELS;
module.exports.PRICING_STRATEGIES = PRICING_STRATEGIES;
module.exports.BILLING_TYPES = BILLING_TYPES;
module.exports.SCOPE_BASED_PRICING = SCOPE_BASED_PRICING;
