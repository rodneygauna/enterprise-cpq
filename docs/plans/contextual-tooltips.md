# Plan: Contextual Tooltips

## TL;DR

Add a reusable `FieldHelp` component — a small ℹ icon that renders a Bootstrap 5 tooltip on hover,
focus, and click — and apply it consistently to every meaningful form field and UI element across
all existing pages. The feature establishes a documented tooltip convention that all future Phase 2
and Phase 3 fields must follow by default, eliminating the current gap where complex pricing terms
(PMPM, tier pricing, annual uplift) are presented with no in-app explanation.

---

## Problem Statement

New sales reps and admins encounter domain-specific pricing terminology (PMPM, volume bands, tier
pricing, annual uplift, adjustment type/direction) with no in-context explanation. They must either
ask a colleague or leave the application to find documentation. This creates onboarding friction,
increases support burden, and leads to mis-configured quotes. The current app has scattered, ad-hoc
hint text (a `.form-text` div on Password, a `title=` attribute on collapsed sidebar icons) with no
unified tooltip system, no coverage on the highest-complexity pages (Quote Builder, Products,
Settings governance fields), and no documented convention for future contributors to follow.

---

## Desired Behavior & Success Criteria

- A reusable `FieldHelp` component exists in `frontend/src/components/FieldHelp.jsx`.
- Every form field deemed "needs explanation" has a `<FieldHelp text="..." />` element next to its label.
- Tooltip appears on hover, keyboard focus (Tab), and click/touch tap.
- Tooltip closes on Escape, on blur, and on outside click.
- The component renders an `aria-describedby` relationship between the icon trigger and the tooltip text so screen readers announce the explanation.
- The component is keyboard-accessible: Tab reaches the icon button, Space/Enter toggles it.
- Tooltips do not block adjacent input interaction on mobile.
- All existing `.form-text` hint spans (Register, ProductLines, ResetPassword) remain in place alongside the new system (they serve different purposes — always-visible validation hints vs. on-demand contextual help).
- A `TOOLTIP_CONVENTION.md` note is added to `docs/` describing how to add a tooltip to a new field.
- No new npm packages added; Bootstrap 5 tooltip JS module used exclusively.

---

## Phase Alignment

**Phase 1 — Active.** This is a horizontal enhancement to the existing Phase 1 UI.
The `FieldHelp` component and convention also serve Phase 2 and Phase 3 field additions — the
component is implemented once and reused as new fields are added.

**Cross-phase dependencies:** None. This feature has no dependency on any unimplemented PRD section.

---

## Out-of-Scope

- Admin-configurable tooltip content via Settings (all tooltip text is hardcoded in JSX).
- Tooltips on read-only display elements (dashboard tables, summary panels, multi-year forecast table).
- Onboarding tours or multi-step product walkthroughs.
- Rich HTML, images, or media inside tooltips — plain text only.
- Persisting tooltip-dismissed or tooltip-seen state in the database.
- Role-differentiated tooltip content (all roles see identical tooltips).

---

## Affected Files

| Layer     | File                                                   | Change Type |
| --------- | ------------------------------------------------------ | ----------- |
| Component | `frontend/src/components/FieldHelp.jsx`                | Create      |
| Utility   | `frontend/src/utils/tooltips.js`                       | Create      |
| Style     | `frontend/src/styles/theme.css`                        | Modify      |
| Page      | `frontend/src/pages/QuoteBuilder.jsx`                  | Modify      |
| Page      | `frontend/src/pages/Products.jsx`                      | Modify      |
| Page      | `frontend/src/pages/Settings.jsx`                      | Modify      |
| Page      | `frontend/src/pages/ProductLines.jsx`                  | Modify      |
| Page      | `frontend/src/pages/Users.jsx`                         | Modify      |
| Component | `frontend/src/components/QuoteSummaryPanel.jsx`        | Modify      |
| Test (FE) | `frontend/src/components/__tests__/FieldHelp.test.jsx` | Create      |
| Test (FE) | `frontend/src/utils/__tests__/tooltips.test.js`        | Create      |
| Docs      | `docs/TOOLTIP_CONVENTION.md`                           | Create      |

---

## Implementation Steps

### Backend

- No backend changes required.

### Frontend

#### 1. Create central tooltip registry (`frontend/src/utils/tooltips.js`)

- Exports a single named-export object `TOOLTIPS` (a plain JS object, no framework dependency).
- Organized into namespaced sub-objects matching the page/domain: `TOOLTIPS.quoteBuilder`, `TOOLTIPS.products`, `TOOLTIPS.settings`, `TOOLTIPS.productLines`, `TOOLTIPS.users`.
- Every key is a camelCase field name (matching the form field name); every value is a plain string containing the tooltip text.
- This is the **single source of truth** for all tooltip copy. No tooltip text strings appear anywhere else in the codebase.
- New fields added in Phase 2 and Phase 3 must add their entry to this file before the `FieldHelp` is wired in the component.

Example structure:

```
TOOLTIPS.quoteBuilder.membershipCount  → "Total number of covered members..."
TOOLTIPS.products.pricingModel         → "Flat: a single fixed price..."
TOOLTIPS.settings.managerReviewPercent → "Discounts at or above..."
```

#### 2. Create `FieldHelp` component (`frontend/src/components/FieldHelp.jsx`)

- Accepts props: `text` (required String — callers pass `TOOLTIPS.<namespace>.<field>`), `id` (optional String for aria), `placement` (optional: `top` | `right` | `bottom` | `left`, default `top`).
- Renders a `<button type="button">` with `aria-label="Help"` and a Bootstrap Icons `bi-info-circle` icon.
- Initializes a Bootstrap 5 tooltip on the button element via `useEffect` using `window.bootstrap.Tooltip`.
- Disposes the tooltip on component unmount.
- Uses `aria-describedby` to link the trigger button to a visually hidden `<span>` containing the tooltip text for screen readers.
- Assigns a stable `id` (generated from `text` or passed via prop) for the `aria-describedby` target.
- Applies no custom inline styles — uses `ms-1 text-muted` Bootstrap utility classes on the button.

#### 3. Add tooltip CSS tokens to `theme.css`

- Add a `/* Tooltips */` section with custom properties for tooltip `z-index`, max-width override, and font-size — using `--bs-tooltip-*` Bootstrap variables.
- Ensure Bootstrap's tooltip arrow and background work in both light and dark mode.

#### 4. Apply `FieldHelp` to `QuoteBuilder.jsx`

Import `TOOLTIPS` from `../utils/tooltips` and pass `TOOLTIPS.quoteBuilder.<field>` as the `text` prop. Fields to annotate:

- `clientName`, `effectiveDate`, `membershipCount`, `termLength`, `annualUplift`

#### 5. Apply `FieldHelp` to `QuoteSummaryPanel.jsx`

Import `TOOLTIPS` from `../utils/tooltips` and pass `TOOLTIPS.quoteBuilder.<field>` as the `text` prop. Fields to annotate:

- `adjustmentDirection`, `adjustmentType`, `adjustmentValue`

#### 6. Apply `FieldHelp` to `Products.jsx`

Import `TOOLTIPS` from `../utils/tooltips` and pass `TOOLTIPS.products.<field>` as the `text` prop. Fields to annotate:

- `sku`, `productLineId`, `type`, `pricingModel`, `pricingStrategy`, `billingType`, `basePrice`, `unitCost`, `implementationFee`, `overagePrice`, `isBaselineProduct`, `isQuantityBased`, `inheritTierVolumesFromCore`, `tiers`, `volumeBands`, `compatibleCoreIds`, `recommendedProductIds`

#### 7. Apply `FieldHelp` to `Settings.jsx`

Import `TOOLTIPS` from `../utils/tooltips` and pass `TOOLTIPS.settings.<field>` as the `text` prop. Fields to annotate:

- `companyName`, `primaryColor`, `accentColor`, `logoUrl`, `managerReviewPercent`, `executiveReviewPercent`, `marginGreen`, `marginYellow`

#### 8. Apply `FieldHelp` to `ProductLines.jsx`

Import `TOOLTIPS` from `../utils/tooltips` and pass `TOOLTIPS.productLines.<field>` as the `text` prop. Fields to annotate:

- `name`, `displayColor`

#### 9. Apply `FieldHelp` to `Users.jsx`

Import `TOOLTIPS` from `../utils/tooltips` and pass `TOOLTIPS.users.<field>` as the `text` prop. Fields to annotate:

- `inviteEmail`, `inviteRole`

### Tests

#### 10. Create `frontend/src/components/__tests__/FieldHelp.test.jsx`

- Renders without throwing.
- Renders a `<button>` element with `aria-label="Help"`.
- Renders a visually hidden `<span>` containing the full tooltip text.
- Keyboard: fires focus event without error.
- Snapshot test for default and custom `placement` prop.
- Test that `window.bootstrap.Tooltip` constructor is called on mount.
- Test that `tooltip.dispose()` is called on unmount.

#### 11. Create `frontend/src/utils/__tests__/tooltips.test.js`

- Verifies the `TOOLTIPS` object is exported and is a plain object.
- Verifies required top-level namespaces exist: `quoteBuilder`, `products`, `settings`, `productLines`, `users`.
- Verifies every required field key (from FR-TTIP-8) is present and its value is a non-empty string.
- Verifies no value contains HTML tags (plain-text-only enforcement).
- Verifies no value is a duplicate of another (each field has unique copy).

### Seed Data

- No seed data changes required.

### Accessibility

- The `FieldHelp` trigger must be a `<button type="button">` (not a `<span>` or `<div>`) to receive native keyboard focus.
- Visible focus indicator must meet WCAG 2.1 AA (`:focus-visible` outline using `--bs-focus-ring-*` variables).
- `aria-label="Help"` provides the accessible name for the icon-only button.
- Tooltip text element must have `role="tooltip"` and be linked via `aria-describedby` on the trigger.
- Tooltip must not auto-dismiss on a timer (user-controlled visibility only).
- On mobile/touch devices, the tooltip must open on tap and remain open until a second tap or an outside tap dismisses it (Bootstrap 5's default touch behavior).
- Do not use `title` attribute for tooltip content — it is not keyboard-accessible.

### Documentation

#### 12. Create `docs/TOOLTIP_CONVENTION.md`

- Explains the two-part pattern: (a) add the string to `frontend/src/utils/tooltips.js` under the correct namespace, then (b) add `<FieldHelp text={TOOLTIPS.<ns>.<field>} />` next to the label.
- States the rule: "Every form input whose purpose or business impact is not immediately obvious to a new sales rep must have a `<FieldHelp>` element."
- Includes a full before/after code snippet showing a label with and without `FieldHelp`.
- Lists the `tooltips.js` namespace convention (`quoteBuilder`, `products`, `settings`, `productLines`, `users`) and instructs contributors to add a new namespace when introducing a new page or domain.
- References the PRD section `FR-TTIP-*`.

---

## NFR Impact

| NFR             | Assessment                                                                                                                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Performance     | Zero impact on quote builder recalculation path. `FieldHelp` is a pure display component; no calculation logic. Bootstrap tooltip initialization runs in `useEffect` after paint.                                                         |
| Security        | No new API endpoints. No user input accepted. No XSS surface (tooltip text is hardcoded JSX strings, never interpolated from user data or API responses).                                                                                 |
| Accessibility   | Addressed in full in the Accessibility implementation step above. WCAG 2.1 AA compliant by design: semantic button element, `aria-label`, `aria-describedby`, `role="tooltip"`, keyboard-triggered, Escape-dismissible, touch-compatible. |
| Bundle size     | Bootstrap tooltip JS module (~5 KB minified) is already present in the installed `bootstrap` package; no new dependency weight.                                                                                                           |
| Browser support | Bootstrap 5 tooltips are supported in all evergreen browsers (Chrome, Firefox, Safari, Edge).                                                                                                                                             |

---

## Open Questions

1. Should `FieldHelp` show the tooltip on focus of the _input itself_ in addition to the info icon, or only on icon hover/focus? (User selected "icon only" but the accessibility story is stronger if the input also references the tooltip via `aria-describedby`.)
2. Should `TOOLTIP_CONVENTION.md` specify a recommended character limit per tooltip string to keep copy consistent and scannable?
3. For the `Products.jsx` `tiers[]` and `volumeBands[]` array fields, the tooltip appears on the section header label — is that sufficient, or should each individual row input also have its own tooltip?
4. Should the `tooltips.js` file be organized by page (current plan) or by model/domain (e.g. `TOOLTIPS.quote`, `TOOLTIPS.product`)? Page-based is simpler to navigate; model-based aligns with the backend domain model.

---

## Deferred Items

- **Admin-configurable tooltip content:** Explicitly out of scope per user interview. Deferred indefinitely.
- **Tooltips on read-only display elements** (QuoteSummaryPanel totals, MultiYearForecast table cells): Deferred — display-only elements do not require contextual help.
- **Onboarding tour / walkthrough:** Out of scope. Would be planned as a separate feature.
- **Role-differentiated tooltip content:** Out of scope. All roles see identical text.
- **Persisting tooltip-seen state:** Out of scope. Tooltips are always available on demand.

---

## Draft PRD Section

### 7.13 Contextual Tooltips

Adds a reusable `FieldHelp` component that renders an ℹ icon next to form field labels; hovering,
focusing, or tapping the icon displays a plain-text Bootstrap 5 tooltip explaining the field's
purpose and business significance. Establishes a tooltip convention all future phases must follow.

- **FR-TTIP-1:** Every form input in the application whose purpose or business impact is not
  immediately obvious must display a `FieldHelp` icon (`bi-info-circle`) immediately after its
  `<label>` text.

- **FR-TTIP-2:** The tooltip component must be activated by: mouse hover over the icon, keyboard
  focus on the icon (via Tab), and touch tap on mobile devices.

- **FR-TTIP-3:** The tooltip must be dismissible via: mouse-out, blur (keyboard), Escape key,
  and second tap on mobile.

- **FR-TTIP-4:** The tooltip trigger must be a `<button type="button">` element with
  `aria-label="Help"` and `role="tooltip"` on the tooltip content container, linked via
  `aria-describedby`, to meet WCAG 2.1 AA (Success Criteria 1.3.1, 4.1.2).

- **FR-TTIP-5:** All tooltip text must be defined in a single central registry file
  (`frontend/src/utils/tooltips.js`) exported as a `TOOLTIPS` object with namespaced sub-objects
  per domain (e.g. `TOOLTIPS.quoteBuilder`, `TOOLTIPS.products`). No tooltip string may appear
  inline in a component or page. Content must be plain text only (no HTML, images, or rich media).
  The registry is not configurable via the Settings UI.

- **FR-TTIP-6:** The implementation must use Bootstrap 5's built-in `Tooltip` JavaScript module
  (already a project dependency). No additional npm packages may be added.

- **FR-TTIP-7:** A tooltip convention document (`docs/TOOLTIP_CONVENTION.md`) must be created
  and maintained, specifying the rule for when a `FieldHelp` is required and how to add one.

- **FR-TTIP-8:** Tooltip coverage is required on, at minimum, the following fields:
  - **Quote Builder:** `clientName`, `effectiveDate`, `membershipCount`, `termLength`,
    `annualUplift`, `adjustmentDirection`, `adjustmentType`, `adjustmentValue`
  - **Product Catalog:** `sku`, `productLineId`, `type`, `pricingModel`, `pricingStrategy`,
    `billingType`, `basePrice`, `unitCost`, `implementationFee`, `overagePrice`,
    `isBaselineProduct`, `isQuantityBased`, `inheritTierVolumesFromCore`, `tiers[]`,
    `volumeBands[]`, `compatibleCoreIds`, `recommendedProductIds`
  - **Settings:** `companyName`, `primaryColor`, `accentColor`, `logoUrl`,
    `managerReviewPercent`, `executiveReviewPercent`, margin `global.green`, margin
    `global.yellow`
  - **Product Lines:** `name`, `displayColor`
  - **Users:** `inviteEmail`, `inviteRole`

- **FR-TTIP-9:** All new fields introduced in Phase 2 and Phase 3 must follow the same
  tooltip convention; the convention document must be consulted when implementing any new form field.

#### Cross-References

- Extends FR-AUTH-1 (login / register forms — existing `.form-text` hints remain; `FieldHelp`
  added only where appropriate)
- See also FR-PROD-1 through FR-PROD-4 (Product Catalog fields annotated per FR-TTIP-8)
- See also FR-QUOTE-1 through FR-QUOTE-7 (Quote Builder fields annotated per FR-TTIP-8)
- See also FR-BRAND-1 (Settings fields annotated per FR-TTIP-8)
