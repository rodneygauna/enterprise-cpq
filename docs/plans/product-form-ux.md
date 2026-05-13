# Plan: Product Form UX Enhancements

## TL;DR

Redesign the product add/edit form from a flat single-screen dump of all 20 fields into a
multi-step wizard with conditional field visibility driven by pricing model and strategy selection,
grouped sections with clear headings, inline validation feedback, and a live price preview panel.
The `TiersEditor` and `VolumeBandsEditor` sub-components are extracted from the 1 200-LOC
`Products.jsx` monolith into standalone reusable components. No backend changes are required.

---

## Problem Statement

Sales Operations admins who configure the product catalog find the current add/edit form
overwhelming: all ~20 fields are displayed simultaneously regardless of which pricing model or
strategy is selected, providing no guidance about which fields are relevant to the current
configuration. For example, the Tiers editor is visible even when "Standard" strategy is chosen;
`compatibleCoreIds` is shown even for Core-type products; `isBaselineProduct` is shown even for
Child/Add-on types. There is no live feedback on how current form values translate into a customer
price, requiring users to mentally compute pricing while filling out the form. Finally, the entire
add/edit form logic lives inside a single ~1 200-LOC page file, making it difficult to test or
reuse across other pages (e.g., the future Quote Builder).

---

## Desired Behavior & Success Criteria

- Form fields are organized into five logical, labelled steps/sections:
  1. **Identity** — Name, SKU, Product Line, Type, Description
  2. **Pricing Configuration** — Pricing Model, Pricing Strategy, Billing Type, Scope-Based Pricing
  3. **Pricing Details** — price inputs and editors conditional on Pricing Strategy; live preview
  4. **Behavior Flags** — Boolean flags, conditionally visible per product type
  5. **Relationships** — Compatible Core IDs, Recommended Product IDs
- Fields that are not applicable to the current selection are hidden (removed from tab order and
  ARIA tree via `display:none`) — not merely greyed out:
  - `basePrice` → shown only when `pricingStrategy === "Standard"`
  - `TiersEditor` → shown only when `pricingStrategy === "Tiered"`
  - `VolumeBandsEditor` → shown only when `pricingStrategy === "Volume Bands"`
  - `overagePrice` → shown only when `pricingModel === "Per Unit / Transaction"`
  - `isBaselineProduct` → shown only when `type === "Core"`
  - `inheritTierVolumesFromCore` + `compatibleCoreIds` → shown only when `type === "Child"`
- A live price preview panel in Step 3 recalculates in real-time as price-related fields change,
  displaying effective monthly price, annual total, and implementation fee where applicable.
- Validation messages are field-level and descriptive (e.g., "At least one tier is required when
  Pricing Strategy is Tiered"; "Price must be ≥ 0").
- The read-only product view drawer is redesigned to show only contextually relevant information:
  - Organized into the same five section groups (Identity, Pricing Configuration, Pricing Details,
    Behavior Flags, Relationships) using `<h6>` section headings as dividers.
  - Applies the same conditional visibility rules as the edit wizard (FR-PROD-10): pricing fields
    that do not apply to the product's strategy/model are omitted entirely, not shown as "—" or
    "$0.00".
  - Boolean flags that are `false` and not relevant to the product's type are omitted (e.g.,
    "Inherit Tier Volumes From Core: No" is hidden for Core-type products).
  - Tiers and volume bands are rendered as readable tables rather than a plain list.
  - The view drawer also uses `offcanvas-lg` for consistency with the edit drawer.
- `TiersEditor` and `VolumeBandsEditor` are extracted to `frontend/src/components/` for reuse.
- `ProductForm` wizard is its own component at `frontend/src/components/ProductForm.jsx`.
- All new and modified UI meets WCAG 2.1 AA: labels, aria-required, aria-describedby for errors,
  aria-live for the live preview, keyboard-navigable wizard step navigation.

---

## Phase Alignment

**Phase 1 — Active.** This is a pure enhancement to the existing 7.4 Product Catalog Management
feature. No Phase 2 or Phase 3 features are brought forward.

**Cross-phase benefits (deferred):** The extracted `TiersEditor` and `VolumeBandsEditor` components
will be available for the Quote Builder (7.5) if it ever needs inline tier/band editing.

---

## Out-of-Scope

- **FR-PROD-6** (bulk-add modal) — explicitly deferred
- **FR-PROD-4 / FR-PROD-5** (import/export) — no changes to XLSX workflow
- Mobile-first layout redesign beyond Bootstrap 5 responsive defaults
- Backend API changes — no new endpoints, no schema modifications
- Quote Builder integration of product-form components — future Phase 1/2 task
- Pricing formula changes — `calculateLineItem` and related utils are untouched

---

## Affected Files

| Layer     | File                                                           | Change Type |
| --------- | -------------------------------------------------------------- | ----------- |
| Component | `frontend/src/components/ProductForm.jsx`                      | **Create**  |
| Component | `frontend/src/components/ProductDetail.jsx`                    | **Create**  |
| Component | `frontend/src/components/TiersEditor.jsx`                      | **Create**  |
| Component | `frontend/src/components/VolumeBandsEditor.jsx`                | **Create**  |
| Page      | `frontend/src/pages/Products.jsx`                              | **Modify**  |
| Utility   | `frontend/src/utils/pricing.js`                                | **Modify**  |
| Test (FE) | `frontend/src/components/__tests__/ProductForm.test.jsx`       | **Create**  |
| Test (FE) | `frontend/src/components/__tests__/ProductDetail.test.jsx`     | **Create**  |
| Test (FE) | `frontend/src/components/__tests__/TiersEditor.test.jsx`       | **Create**  |
| Test (FE) | `frontend/src/components/__tests__/VolumeBandsEditor.test.jsx` | **Create**  |
| Test (FE) | `frontend/src/pages/__tests__/Products.test.jsx`               | **Modify**  |

---

## Implementation Steps

### Backend

No backend changes required.

### Frontend

- [ ] **Extract `TiersEditor`** — move the existing inline `TiersEditor` component from
      `Products.jsx` to `frontend/src/components/TiersEditor.jsx` with no logic changes; export
      as default; add full prop types / JSDoc.
- [ ] **Extract `VolumeBandsEditor`** — same pattern as above for `VolumeBandsEditor`.
- [ ] **Add `previewPrice(form, previewMembershipCount, previewTermMonths)` utility** to
      `frontend/src/utils/pricing.js` — wraps `calculateLineItem` with safe fallbacks for
      incomplete form state; returns `{ monthlyPrice, annualTotal, implementationFee }`.
- [ ] **Create `ProductForm.jsx`** multi-step wizard:
  - Props: `initialValues`, `productLines`, `allProducts`, `onSubmit`, `onCancel`, `saving`
  - Internal state: `step` (1–5), `form`, `formErrors`
  - Step progress indicator: `<nav aria-label="Product form steps">` with step buttons; completed
    steps show a checkmark; current step has `aria-current="step"`.
  - **Step 1 — Identity**: `name` (required), `sku`, `productLineId` (select), `type` (select),
    `description` (textarea). All inputs have `<label htmlFor>` and `aria-required` where required.
  - **Step 2 — Pricing Configuration**: `pricingModel` (select), `pricingStrategy` (select),
    `billingType` (select), `scopeBasedPricing` (select). Include `FieldHelp` tooltips per
    `TOOLTIPS.products.*`.
  - **Step 3 — Pricing Details**: Conditional rendering per strategy/model:
    - `pricingStrategy === "Standard"` → `basePrice` input
    - `pricingStrategy === "Tiered"` → `<TiersEditor>` (no `basePrice`)
    - `pricingStrategy === "Volume Bands"` → `<VolumeBandsEditor>` (no `basePrice`)
    - Always visible: `unitCost`, `implementationFee`
    - `pricingModel === "Per Unit / Transaction"` → `overagePrice`
    - Live price preview panel (`aria-live="polite"`) showing monthly / annual / impl fee using
      `previewPrice`; preview inputs for membership count and term months (defaulting to 1 000 and
      12 respectively).
  - **Step 4 — Behavior Flags**:
    - `isQuantityBased` checkbox (always visible)
    - `isBaselineProduct` checkbox (only when `type === "Core"`)
    - `inheritTierVolumesFromCore` checkbox (only when `type === "Child"`)
  - **Step 5 — Relationships**:
    - `compatibleCoreIds` multi-select (only when `type === "Child"`)
    - `recommendedProductIds` multi-select (all products except self, always visible)
  - Next / Back buttons; Submit button on Step 5; Cancel button on all steps.
  - Per-step validation runs on "Next" click; full validation on Submit.
  - All validation error messages linked to their field via `aria-describedby`.
- [ ] **Refactor `Products.jsx`**:
  - Remove inline `TiersEditor`, `VolumeBandsEditor`, and form JSX.
  - Import `ProductForm`, `TiersEditor`, `VolumeBandsEditor` from `components/`.
  - Replace the add/edit `<OffcanvasDrawer>` body with `<ProductForm>`; set drawer size to
    `offcanvas-lg`.
  - Replace the view drawer flat `<dl>` with a **`ProductDetail`** component (see below); set
    view drawer size to `offcanvas-lg`.
- [ ] **Create `ProductDetail.jsx`** (`frontend/src/components/ProductDetail.jsx`) — read-only
      view of a product organized into the same five section groups as the edit wizard:
  - Uses `<h6>` dividers for section headings.
  - Applies FR-PROD-10 conditional visibility: omits fields that do not apply to the product's
    `type`, `pricingStrategy`, or `pricingModel` rather than showing "—" or "$0.00" placeholders.
  - Omits boolean flags that are `false` and contextually irrelevant to the product type.
  - Renders tiers as a two-column `<table>` (Min Volume / Price) and volume bands as a four-column
    `<table>` (Band / Max Members / Price / Impl. Fee).
  - Resolves `compatibleCoreIds` and `recommendedProductIds` to product names (passed as props).
  - Meets WCAG 2.1 AA: all tables have `<caption>`, `<th scope="col">` headings; section headings
    use proper heading hierarchy.
- [ ] **Descriptive validation messages** — update `validateProduct` helper in `Products.jsx` (or
      move it into `ProductForm.jsx`) with the field-level messages defined in FR-PROD-12.

### Tests

- [ ] **`TiersEditor.test.jsx`** — renders with empty tiers; adds a tier row; removes a tier row;
      shows validation error when min or price is empty; calls `onChange` with updated array.
- [ ] **`VolumeBandsEditor.test.jsx`** — renders with empty bands; adds a band row; removes a row;
      shows validation error; handles null maxMembers (unlimited); calls `onChange`.
- [ ] **`ProductForm.test.jsx`**:
  - Renders Step 1 by default; "Next" advances to Step 2.
  - "Back" on Step 2 returns to Step 1.
  - Attempting "Next" on Step 1 without `name` shows validation error linked via aria-describedby.
  - Step 3: `basePrice` visible for Standard strategy; hidden for Tiered.
  - Step 3: `TiersEditor` visible for Tiered; hidden for Standard.
  - Step 3: `overagePrice` visible only for Per Unit / Transaction.
  - Step 4: `isBaselineProduct` visible for Core type; hidden for Child.
  - Step 4: `inheritTierVolumesFromCore` visible for Child; hidden for Core.
  - Step 5: `compatibleCoreIds` visible for Child; hidden for Core.
  - Live preview panel has `aria-live="polite"`.
  - Submit on Step 5 calls `onSubmit` with correct payload.
  - `saving=true` disables Submit button.
  - Cancel on any step calls `onCancel`.
- [ ] **`ProductDetail.test.jsx`**:
  - Renders product name as the section title.
  - For a Standard/PMPM product: shows `basePrice`; does not render TiersEditor table or
    VolumeBands table; does not show `overagePrice` row.
  - For a Tiered product: renders tiers table with `<caption>` and `<th scope="col">`;
    does not show `basePrice` row.
  - For a Volume Bands product: renders volume bands table; final band shows "Unlimited" for
    max members when `maxMembers` is null.
  - For a Core type: shows `isBaselineProduct` only when `true`; never shows
    `inheritTierVolumesFromCore` or `compatibleCoreIds`.
  - For a Child type: shows `compatibleCoreIds` resolved to product names; never shows
    `isBaselineProduct`.
  - Boolean flags that are `false` are omitted from the rendered output.
  - `recommendedProductIds` resolved to product names; hidden when empty.
  - All section heading `<h6>` elements are present.
  - Meets WCAG: tables have `<caption>` and `<th scope="col">` elements.

### Seed Data

No seed data changes required.

### Accessibility

- [ ] Wizard step progress indicator: `<nav aria-label="Product form steps">`; each step button has
      `aria-current="step"` when active; completed steps have a visually and programmatically
      indicated "completed" state.
- [ ] All `<input>`, `<select>`, `<textarea>` elements have explicit `<label htmlFor="...">`.
- [ ] Required fields include `(required)` text in the label and `aria-required="true"` on the input.
- [ ] Conditionally hidden fields use `display:none` (not `opacity` or `visibility`) so they are
      excluded from keyboard tab order and the ARIA tree.
- [ ] All validation error messages rendered in a `<div role="alert">` or linked via
      `aria-describedby` to their field.
- [ ] Live price preview section: `<section aria-live="polite" aria-label="Live price preview">`.
- [ ] `TiersEditor` / `VolumeBandsEditor` add-row and remove-row buttons have descriptive
      `aria-label` values (e.g., `aria-label="Add tier"`, `aria-label="Remove tier 1"`).
- [ ] Color contrast for all new text/background combinations must meet 4.5:1 (normal text) or
      3:1 (large text / UI components).

---

## NFR Impact

| NFR               | Assessment                                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Security**      | No new API endpoints. Existing auth/role enforcement unchanged. Frontend validation is supplementary — backend is source of truth. No OWASP risk change. |
| **Performance**   | `previewPrice` is a pure synchronous function; no async calls in the pricing hot path. No impact on the < 100ms quote-builder recalc budget.             |
| **Accessibility** | Full WCAG 2.1 AA audit required for `ProductForm`, `ProductDetail`, `TiersEditor`, `VolumeBandsEditor`, wizard navigation, and the live preview panel.   |
| **Env Vars**      | None new.                                                                                                                                                |

---

## Open Questions

_All resolved._

1. **Live preview defaults** — Preview panel uses editable inputs with defaults (1 000 members, 12-month term). ✅ Resolved
2. **Wizard enforcement** — "Next" is blocked until the current step passes validation; backward navigation to any previously visited step is always allowed. ✅ Resolved
3. **Offcanvas size** — The existing `OffcanvasDrawer` is widened to `offcanvas-lg`. ✅ Resolved

---

## Deferred Items

- **FR-PROD-6** — Bulk-add modal (explicitly out of scope per user)
- **FR-PROD-4 / FR-PROD-5** — Import/export improvements (explicitly out of scope)
- Quote Builder integration of `TiersEditor` / `VolumeBandsEditor` — future Phase 2/3
- Mobile-first layout redesign beyond Bootstrap 5 defaults
- Unit Cost guidance tooltip update to surface COGS/margin context (Phase 2 Margin Scoring)

---

## Draft PRD Section

### 7.X (TBD) — Product Form UX Enhancements

Improves the product add/edit experience with a multi-step wizard, conditional field visibility,
a live price preview panel, and WCAG 2.1 AA compliance. Supplements FR-PROD-1 and FR-PROD-2;
no schema changes.

**FR-PROD-9:** The product add/edit form must be organized into five sequential sections presented
as a wizard:

| Step | Label                 | Fields                                                                             |
| ---- | --------------------- | ---------------------------------------------------------------------------------- |
| 1    | Identity              | Name, SKU, Product Line, Type, Description                                         |
| 2    | Pricing Configuration | Pricing Model, Pricing Strategy, Billing Type, Scope-Based Pricing                 |
| 3    | Pricing Details       | Price inputs and editors — conditional per strategy (see FR-PROD-10); live preview |
| 4    | Behavior Flags        | Boolean flags — conditionally visible per type (see FR-PROD-10)                    |
| 5    | Relationships         | Compatible Core IDs (Child only), Recommended Product IDs                          |

**FR-PROD-10:** The following fields must be conditionally shown or hidden based on current form
state. Hidden fields must be excluded from keyboard tab order and the ARIA tree (`display:none`):

| Field                        | Visible when                                |
| ---------------------------- | ------------------------------------------- |
| `basePrice`                  | `pricingStrategy === "Standard"`            |
| TiersEditor                  | `pricingStrategy === "Tiered"`              |
| VolumeBandsEditor            | `pricingStrategy === "Volume Bands"`        |
| `overagePrice`               | `pricingModel === "Per Unit / Transaction"` |
| `isBaselineProduct`          | `type === "Core"`                           |
| `inheritTierVolumesFromCore` | `type === "Child"`                          |
| `compatibleCoreIds`          | `type === "Child"`                          |

**FR-PROD-11:** Step 3 must include a live price preview panel that recalculates in real-time as
price-related fields change. It must display:

- Effective monthly price
- Annual total
- Implementation fee (if applicable)

The preview panel must include editable "preview inputs" for membership count (default: 1 000) and
term months (default: 12) so admins can model different scenarios without saving. The panel must
use `aria-live="polite"` so screen readers announce value changes.

**FR-PROD-12:** All form validation messages must be field-level and descriptive:

| Condition                                           | Message                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `name` is empty                                     | "Product name is required"                                                      |
| `sku` exceeds 100 characters                        | "SKU must be 100 characters or fewer"                                           |
| Price field is negative                             | "Price must be 0 or greater"                                                    |
| Strategy is Tiered but `tiers` is empty             | "At least one tier is required when Pricing Strategy is Tiered"                 |
| Strategy is Volume Bands but `volumeBands` is empty | "At least one volume band is required when Pricing Strategy is Volume Bands"    |
| Band `maxMembers` is not a positive integer or null | "Maximum members must be a positive whole number, or leave blank for unlimited" |

All messages must be linked to their respective field via `aria-describedby`.

**FR-PROD-13:** `TiersEditor` and `VolumeBandsEditor` must be extracted from `Products.jsx` into
standalone components at `frontend/src/components/TiersEditor.jsx` and
`frontend/src/components/VolumeBandsEditor.jsx` so they can be reused by the Quote Builder or
other future pages.

**FR-PROD-14:** The read-only product view drawer must be redesigned as a `ProductDetail` component
that presents only contextually relevant information:

- Organized into the same five section groups as the edit wizard (Identity, Pricing Configuration,
  Pricing Details, Behavior Flags, Relationships) using `<h6>` dividers.
- Applies the same FR-PROD-10 conditional visibility rules: fields that do not apply to the
  product's `type`, `pricingStrategy`, or `pricingModel` are omitted entirely — never shown as
  "—" or "$0.00".
- Boolean flags that are `false` and contextually irrelevant to the product type are hidden.
- Tiers rendered as a two-column table (Min Volume / Price); volume bands as a four-column table
  (Band / Max Members / Price / Impl. Fee); tables include `<caption>` and `<th scope="col">`.
- `compatibleCoreIds` and `recommendedProductIds` resolved and displayed as product names.
- View drawer uses `offcanvas-lg` for consistency with the edit drawer.

**Data model changes:** None — the Product schema (FR-PROD-2) is unchanged.

**Cross-references:** FR-PROD-1, FR-PROD-2, FR-TTIP-8 (product field tooltips), NFR-7 (WCAG 2.1 AA)
