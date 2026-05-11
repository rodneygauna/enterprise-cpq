const mongoose = require("mongoose");

/**
 * ProductLine — admin-configurable groupings for products.
 * PRD §7.3 FR-LINE-1, FR-LINE-2.
 *
 * Fields:
 *   name         — display label (required, unique case-insensitive)
 *   displayColor — optional hex color for badges/pills in the UI
 *   sortOrder    — integer position; lower = first; managed by the reorder endpoint
 */
const productLineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    displayColor: {
      type: String,
      trim: true,
      default: null,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Case-insensitive unique index on name
productLineSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

// Fast lookup by sort position (used by list endpoint)
productLineSchema.index({ sortOrder: 1 });

module.exports = mongoose.model("ProductLine", productLineSchema);
