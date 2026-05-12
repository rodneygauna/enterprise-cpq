const mongoose = require("mongoose");

// ── Enums (mirrors PRD Section 8 / mongoose-models.instructions.md) ──────────
const QUOTE_STATUSES = ["Draft", "Submitted", "Approved", "Rejected"];
const ADJUSTMENT_DIRECTIONS = ["discount", "uplift"];
const ADJUSTMENT_TYPES = ["percentage", "flat"];
const GLOBAL_ADJUSTMENT_TYPES = ["discount", "surcharge"];

// ── QuoteItem sub-schema ──────────────────────────────────────────────────────
const quoteItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    // Full product document snapshot at save time — preserves historical accuracy
    productSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    quantity: { type: Number, default: 1, min: 0 },
    annualUnits: { type: Number, default: 0, min: 0 },
    estimatedHours: { type: Number, default: 0, min: 0 },
    // Line-item adjustment (FR-QUOTE-10)
    adjustmentDirection: {
      type: String,
      enum: [...ADJUSTMENT_DIRECTIONS, null],
      default: null,
    },
    adjustmentType: {
      type: String,
      enum: [...ADJUSTMENT_TYPES, null],
      default: null,
    },
    adjustmentValue: { type: Number, default: 0, min: 0 },
    // Computed values stored at save time
    extendedPrice: { type: Number, default: 0 },
    implementationFee: { type: Number, default: 0 },
    adjustedPrice: { type: Number, default: 0 },
  },
  { _id: true },
);

// ── YearlySummary sub-schema ──────────────────────────────────────────────────
const yearlySummarySchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    revenue: { type: Number, required: true },
  },
  { _id: false },
);

// ── Quote schema ──────────────────────────────────────────────────────────────
const quoteSchema = new mongoose.Schema(
  {
    // Header (FR-QUOTE-1)
    clientName: { type: String, required: true, trim: true },
    effectiveDate: { type: Date, default: null },
    membershipCount: { type: Number, default: 0, min: 0 },
    termLength: { type: Number, default: 12, min: 1 },
    annualUplift: { type: Number, default: 0, min: 0 },

    // Selected products with params and computed prices (FR-QUOTE-3/4/5)
    selectedItems: { type: [quoteItemSchema], default: [] },

    // Active product lines (FR-QUOTE-2)
    activeProductLineIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "ProductLine" },
    ],

    // Global adjustment (FR-QUOTE-11)
    globalAdjustmentType: {
      type: String,
      enum: [...GLOBAL_ADJUSTMENT_TYPES, null],
      default: null,
    },
    globalDiscountType: {
      type: String,
      enum: ADJUSTMENT_TYPES,
      default: "percentage",
    },
    globalDiscountValue: { type: Number, default: 0, min: 0 },

    // Computed summary totals (FR-QUOTE-12) — stored for listing performance
    grossTCV: { type: Number, default: 0 },
    globalAdjustmentAmount: { type: Number, default: 0 },
    netTCV: { type: Number, default: 0 },
    totalPMPM: { type: Number, default: 0 },
    totalMonthlyFees: { type: Number, default: 0 },
    monthlyTotal: { type: Number, default: 0 },
    arr: { type: Number, default: 0 },
    implementationTotal: { type: Number, default: 0 },

    // Multi-year forecast (FR-QUOTE-13)
    yearlySummary: { type: [yearlySummarySchema], default: [] },

    // Metadata
    productLineIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "ProductLine" },
    ],
    hasScopeBasedItems: { type: Boolean, default: false },

    // Status & ownership
    status: {
      type: String,
      enum: QUOTE_STATUSES,
      default: "Draft",
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvalComment: { type: String, trim: true, default: "" },
    salesforceOpportunityId: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Role-scoped listing (FR-DASH-1)
quoteSchema.index({ ownerId: 1, createdAt: -1 });
quoteSchema.index({ status: 1 });
quoteSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Quote", quoteSchema);
module.exports.QUOTE_STATUSES = QUOTE_STATUSES;
module.exports.ADJUSTMENT_DIRECTIONS = ADJUSTMENT_DIRECTIONS;
module.exports.ADJUSTMENT_TYPES = ADJUSTMENT_TYPES;
module.exports.GLOBAL_ADJUSTMENT_TYPES = GLOBAL_ADJUSTMENT_TYPES;
