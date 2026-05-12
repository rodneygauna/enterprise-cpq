const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: "Enterprise CPQ" },
    logoUrl: { type: String },
    primaryColor: { type: String, default: "#0d6efd" },
    accentColor: { type: String, default: "#6c757d" },

    // Phase 2 — Discount governance (stub fields, not exposed via API yet)
    discountThresholds: {
      managerReviewPercent: { type: Number, default: 10 },
      executiveReviewPercent: { type: Number, default: 25 },
    },

    // Phase 2 — Margin scoring (FR-MARGIN-2)
    marginTargets: {
      global: {
        green: { type: Number, default: 50 },
        yellow: { type: Number, default: 30 },
      },
      // Map of productLine name → { green: Number, yellow: Number }
      productLines: { type: Map, of: { green: Number, yellow: Number } },
    },

    // Phase 2 — Volume discounts (stub field)
    volumeDiscountRules: [
      { membersThreshold: Number, discountPercent: Number },
    ],

    // Phase 3 — Salesforce (stub fields)
    salesforceConfig: {
      consumerKey: String,
      consumerSecret: String,
      instanceUrl: String,
    },

    // Phase 3 — SMTP (stub fields)
    smtpConfig: {
      host: String,
      port: Number,
      user: String,
      pass: String,
      from: String,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Settings", settingsSchema);
