---
applyTo: "backend/src/models/**"
description: "Use when creating or editing Mongoose models. Covers schema conventions, all PRD enums, timestamps, soft-delete, and embed vs reference rules."
---

# Mongoose Model Conventions

## File Structure

One file per collection. Export the compiled model as default:

```js
// src/models/Product.js
const mongoose = require('mongoose');
const schema = new mongoose.Schema({ ... }, { timestamps: true });
module.exports = mongoose.model('Product', schema);
```

---

## All PRD Enums

Use these exact values. Copy the array into both the schema and `express-validator` `isIn()` calls.

```js
// User roles
const ROLES = [
  "super_admin",
  "admin",
  "executive",
  "sales_manager",
  "sales_rep",
];

// Product type
const PRODUCT_TYPES = ["Core", "Child", "Add-on"];

// Pricing model
const PRICING_MODELS = [
  "PMPM",
  "Flat Fee",
  "Monthly Fee",
  "Per Unit / Transaction",
  "Per User / License",
  "Hourly Rate",
];

// Pricing strategy
const PRICING_STRATEGIES = ["Standard", "Tiered", "Volume Bands"];

// Billing type
const BILLING_TYPES = [
  "One-Time",
  "Recurring (Monthly)",
  "Usage / Transactional",
  "Time & Materials",
];

// Scope-based pricing
const SCOPE_BASED_PRICING = ["None", "All", "Implementation Only"];

// Quote status
const QUOTE_STATUSES = ["Draft", "Submitted", "Approved", "Rejected"];

// Margin status
const MARGIN_STATUSES = ["green", "yellow", "red"];
```

---

## PRD Section 8 — Data Models

### `users`

```js
{
  email:                { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash:         { type: String },          // null for OAuth-only accounts
  firstName:            { type: String, required: true, trim: true },
  lastName:             { type: String, required: true, trim: true },
  role:                 { type: String, enum: ROLES, default: 'sales_rep' },
  salesforceId:         { type: String },
  isActive:             { type: Boolean, default: true },
  lastLogin:            { type: Date },
  passwordResetToken:   { type: String },
  passwordResetExpires: { type: Date },
  inviteToken:          { type: String },
  inviteExpires:        { type: Date },
}
```

### `productLines`

```js
{
  name:         { type: String, required: true, trim: true },
  displayColor: { type: String },
  sortOrder:    { type: Number, default: 0 },
}
```

### `products`

```js
{
  name:                      { type: String, required: true, trim: true },
  sku:                       { type: String, trim: true },
  productLineId:             { type: mongoose.Schema.Types.ObjectId, ref: 'ProductLine' },
  type:                      { type: String, enum: PRODUCT_TYPES },
  pricingModel:              { type: String, enum: PRICING_MODELS },
  pricingStrategy:           { type: String, enum: PRICING_STRATEGIES, default: 'Standard' },
  billingType:               { type: String, enum: BILLING_TYPES },
  basePrice:                 { type: Number, default: 0 },
  unitCost:                  { type: Number, default: 0 },
  implementationFee:         { type: Number, default: 0 },
  overagePrice:              { type: Number, default: 0 },
  isBaselineProduct:         { type: Boolean, default: false },
  isQuantityBased:           { type: Boolean, default: false },
  inheritTierVolumesFromCore:{ type: Boolean, default: false },
  scopeBasedPricing:         { type: String, enum: SCOPE_BASED_PRICING, default: 'None' },
  tiers:                     [{ min: Number, price: Number }],
  volumeBands:               [{ label: String, maxMembers: Number, price: Number, implPrice: Number }],
  compatibleCoreIds:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  recommendedProductIds:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  description:               { type: String },
  createdBy:                 { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}
```

### `quotes`

```js
{
  clientName:             { type: String, required: true, trim: true },
  effectiveDate:          { type: Date },
  termLength:             { type: Number, default: 12 },
  annualUplift:           { type: Number, default: 0 },
  membershipCount:        { type: Number, default: 0 },
  salesforceOpportunityId:{ type: String },
  ownerId:                { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status:                 { type: String, enum: QUOTE_STATUSES, default: 'Draft' },
  approvedBy:             { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvalComment:        { type: String },
  selectedItems:          [QuoteItemSchema],   // embedded sub-documents
  globalAdjustmentType:   { type: String, enum: ['discount', 'surcharge'] },
  globalDiscountType:     { type: String, enum: ['percentage', 'flat'] },
  globalDiscountValue:    { type: Number, default: 0 },
  grossTCV:               { type: Number, default: 0 },
  globalAdjustmentAmount: { type: Number, default: 0 },
  netTCV:                 { type: Number, default: 0 },
  totalPMPM:              { type: Number, default: 0 },
  totalMonthlyFees:       { type: Number, default: 0 },
  monthlyTotal:           { type: Number, default: 0 },
  arr:                    { type: Number, default: 0 },
  implementationTotal:    { type: Number, default: 0 },
  marginPercent:          { type: Number },
  marginStatus:           { type: String, enum: MARGIN_STATUSES },
  yearlySummary:          [{ year: Number, revenue: Number }],
  productLineIds:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProductLine' }],
  hasScopeBasedItems:     { type: Boolean, default: false },
}
```

### `settings` (singleton — always upsert by a fixed ID or `{}`)

```js
{
  companyName:  { type: String, default: 'Enterprise CPQ' },
  logoUrl:      { type: String },
  primaryColor: { type: String, default: '#0d6efd' },
  accentColor:  { type: String, default: '#6c757d' },
  discountThresholds: {
    managerReviewPercent:   { type: Number, default: 10 },
    executiveReviewPercent: { type: Number, default: 25 },
  },
  marginTargets: {
    global: { green: { type: Number, default: 50 }, yellow: { type: Number, default: 30 } },
    productLines: { type: Map, of: { green: Number, yellow: Number } },
  },
  volumeDiscountRules: [{ membersThreshold: Number, discountPercent: Number }],
  salesforceConfig: {
    consumerKey:   String,
    consumerSecret:String,
    instanceUrl:   String,
  },
  smtpConfig: {
    host: String, port: Number, user: String, pass: String, from: String,
  },
}
```

---

## Schema Rules

- Always use `{ timestamps: true }` — adds `createdAt` and `updatedAt` automatically
- Soft-delete users via `isActive: false`; **never call `User.deleteOne()`**
- Embed sub-documents (e.g. `QuoteItem`, `tiers`, `volumeBands`) when they have no independent lifecycle
- Use `ObjectId` references (`ref:`) for cross-collection relationships (products → productLines, quotes → users)
- Add sparse indexes on optional unique fields: `{ index: true, sparse: true }` on `sku`
- Export enum arrays alongside the model so routes can import them for validation
