---
description: "Scaffold all layers for a new product: Mongoose schema, Express CRUD routes, and React admin form with all FR-PROD-2 fields."
argument-hint: "Product name or description (optional)"
agent: "agent"
---

Scaffold a complete new product feature for Enterprise CPQ, covering all three layers.

Reference [docs/PRD.md](../../docs/PRD.md) section FR-PROD-2 for the full product field list before generating any code.

## Step 1 — Mongoose Model (`backend/src/models/Product.js`)

If the file does not yet exist, create it. If it does, confirm the schema matches all fields in FR-PROD-2.

Include all fields:

- `name`, `sku`, `productLineId` (ref: ProductLine), `type`, `pricingModel`, `pricingStrategy`, `billingType`
- `basePrice`, `unitCost`, `implementationFee`, `overagePrice`
- `isBaselineProduct`, `isQuantityBased`, `inheritTierVolumesFromCore`
- `scopeBasedPricing`, `tiers[]`, `volumeBands[]`
- `compatibleCoreIds[]`, `recommendedProductIds[]`
- `description`, `createdBy`

Use the exact enum arrays from [mongoose-models.instructions.md](../instructions/mongoose-models.instructions.md).

Export enum arrays alongside the model for use in route validation.

## Step 2 — Express Router (`backend/src/routes/products.js`)

Implement the following routes, applying middleware per [backend.instructions.md](../instructions/backend.instructions.md):

| Method | Path                          | Auth     | Role               |
| ------ | ----------------------------- | -------- | ------------------ |
| GET    | `/api/products`               | required | any authenticated  |
| GET    | `/api/products/:id`           | required | any authenticated  |
| POST   | `/api/products`               | required | admin, super_admin |
| PUT    | `/api/products/:id`           | required | admin, super_admin |
| DELETE | `/api/products/:id`           | required | admin, super_admin |
| POST   | `/api/products/:id/duplicate` | required | admin, super_admin |

Validation rules:

- `name` — required, non-empty string
- `pricingModel` — required, must be in PRICING_MODELS enum
- `pricingStrategy` — required, must be in PRICING_STRATEGIES enum
- `type` — required, must be in PRODUCT_TYPES enum
- `sku` — optional but must be unique if provided (catch duplicate key error → 409)
- `productLineId` — optional, must be valid MongoId if provided

## Step 3 — React Admin Form (`frontend/src/pages/admin/ProductForm.jsx`)

Create a form component for creating and editing a product. This form is used by both the "New Product" and "Edit Product" pages.

Render all FR-PROD-2 fields grouped into logical sections:

1. **Basic Info** — Name, SKU, Product Line (select), Type, Description
2. **Pricing** — Pricing Model, Pricing Strategy, Billing Type, Base Price, Unit Cost, Implementation Fee, Overage Price
3. **Flags** — Is Baseline Product, Is Quantity Based, Inherit Tier Volumes From Core, Scope-Based Pricing
4. **Tiers** — Dynamic add/remove rows for `{min, price}` (shown when strategy is `Tiered`)
5. **Volume Bands** — Dynamic add/remove rows for `{label, maxMembers, price, implPrice}` (shown when strategy is `Volume Bands`)
6. **Relationships** — Compatible Core IDs (multi-select), Recommended Product IDs (multi-select)

Follow [frontend.instructions.md](../instructions/frontend.instructions.md) for Axios, Bootstrap, and role guard patterns.
Follow [accessibility.instructions.md](../instructions/accessibility.instructions.md) — every input must have a `<label>`.

## Step 4 — Wire Up Routes

Register the products router in `backend/src/app.js`:

```js
app.use("/api/products", require("./routes/products"));
```

Register the admin pages in the React router under a `RequireRole` guard for `admin` and `super_admin`.
