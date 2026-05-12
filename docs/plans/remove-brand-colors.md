# Plan: Remove Brand Colors

## TL;DR

Remove the `primaryColor` and `accentColor` fields permanently from the Enterprise CPQ settings
system. These fields are not consumed by the current CSS/theming approach, making them dead code
that adds maintenance overhead and validation complexity without delivering user value. After this
change, the Settings page will only expose Company Name and Logo; Bootstrap default colors will
always be used; and `primaryColor`/`accentColor` will not appear anywhere in the API, schema,
context, or UI.

---

## Problem Statement

The current system exposes color picker inputs for Primary Brand Color and Accent Brand Color in
the Settings page (`FR-BRAND-1`). Although these values are stored in the database and injected at
runtime into Bootstrap CSS custom properties (`--bs-primary`, `--bs-secondary`) via
`BrandingContext`, the new CSS/theming approach does not actually leverage dynamic color injection.
As a result:

- The feature is functionally dead code — the colors are stored and published but produce no
  observable difference in the UI.
- The API surface is larger than needed (hex validation logic, allowed-field whitelisting,
  two additional DB fields in every settings response).
- Configurable colors increase the risk of admins inadvertently setting inaccessible
  (low-contrast) color values, which would violate WCAG 2.1 AA.

This affects `super_admin` users who see the color picker fields on the Settings page. Because the
colors are never used, no other role is affected.

---

## Desired Behavior & Success Criteria

- `GET /api/settings` response **does not include** `primaryColor` or `accentColor`.
- `PUT /api/settings` **does not accept** `primaryColor` or `accentColor` (fields silently ignored
  or not in the allowed whitelist).
- The Settings page (super_admin view) shows only: Company Name and Logo. No color pickers.
- `BrandingContext` continues to provide `companyName` and `logoUrl` to `Layout` and `Sidebar`;
  CSS custom property injection for `--bs-primary`/`--bs-secondary` is removed.
- Bootstrap default colors (`#0d6efd` primary, `#6c757d` secondary) are always used.
- Tooltip entries `TOOLTIPS.settings.primaryColor` and `TOOLTIPS.settings.accentColor` are removed.
- All existing tests pass; color-specific test cases are removed or updated.
- No references to `primaryColor` or `accentColor` remain in any production source file.

---

## Phase Alignment

**Phase 1 — Active.** This is a permanent simplification of section 7.2 (Company Branding &
Settings), which is an active Phase 1 feature.

**Cross-phase dependency:**

- **FR-PROP-2 (Phase 3):** The PRD references brand colors for PDF proposal generation. Since
  `primaryColor` and `accentColor` are being permanently removed, Phase 3 proposal implementation
  will need to approach proposal styling differently (e.g., hardcoded Bootstrap defaults or a
  separate, scoped proposal-theme field). This is explicitly deferred.

---

## Out-of-Scope

- `companyName` and `logoUrl` fields — these remain fully functional; do not remove them.
- `BrandingContext` itself — the context stays; only the color-related fields, functions (`hexToRgb`,
  `applyBsColor`), and CSS property injection are removed.
- The Settings page layout and structure — do not reorganize or redesign; only remove the two color
  field groups.
- Discount threshold and margin target settings — untouched.
- Product Line `displayColor` field — this is a separate, per-product-line color that is still
  used for grouping UI; do not remove it.
- SMTP, Salesforce, and other Phase 2/3 stub fields in the schema — untouched.

---

## Affected Files

| Layer     | File                                                      | Change Type |
| --------- | --------------------------------------------------------- | ----------- |
| Model     | `backend/src/models/Settings.js`                          | Modify      |
| Route     | `backend/src/routes/settings.js`                          | Modify      |
| Service   | `backend/src/services/settingsService.js`                 | Modify      |
| Seed      | `backend/seeds/settings.js`                               | Modify      |
| Context   | `frontend/src/context/BrandingContext.jsx`                | Modify      |
| Page      | `frontend/src/pages/Settings.jsx`                         | Modify      |
| Utility   | `frontend/src/utils/tooltips.js`                          | Modify      |
| Test (BE) | `backend/src/routes/__tests__/settings.test.js`           | Modify      |
| Test (FE) | `frontend/src/pages/__tests__/Settings.test.jsx`          | Modify      |
| Test (FE) | `frontend/src/context/__tests__/BrandingContext.test.jsx` | Modify      |
| Docs      | `docs/PRD.md`                                             | Modify      |

---

## Implementation Steps

### Backend

- [ ] **Settings.js model** — Remove the `primaryColor` and `accentColor` fields from the Mongoose
      schema. (The remaining schema fields: `companyName`, `logoUrl`, discount thresholds, margin
      targets, volume discount rules, Salesforce config, SMTP config.)
- [ ] **settings.js route (PUT /api/settings)** — Remove `primaryColor` and `accentColor` from the
      `ALLOWED` field whitelist. Remove hex-format validation rules for both fields.
- [ ] **settingsService.js** — Remove `primaryColor` and `accentColor` from the `DEFAULTS`
      constant used by `getSettings()`.
- [ ] **seeds/settings.js** — Remove `primaryColor` and `accentColor` from the seed document.

### Frontend

- [ ] **BrandingContext.jsx** — Remove `primaryColor` and `accentColor` from the `DEFAULTS`
      object. Remove the `hexToRgb()` helper function. Remove the `applyBsColor()` helper function.
      Remove all `document.documentElement.style.setProperty()` calls for `--bs-primary`,
      `--bs-primary-rgb`, `--bs-secondary`, and `--bs-secondary-rgb`. Remove `primaryColor` and
      `accentColor` from the context value shape. Keep `companyName` and `logoUrl` unchanged.
- [ ] **Settings.jsx** — Remove the Primary Color and Accent Color form field groups (color picker
      `<input type="color">`, hex text `<input>`, associated `<label>`, `<FieldHelp>` tooltip,
      and `invalid-feedback` divs). Remove `primaryColor` and `accentColor` from the `form` state
      initializer and the `validate()` function. Remove the `HEX_RE` regex constant if it is used
      exclusively for color validation. Remove `applyBsColor` calls from `handleSubmit`. Remove
      `primaryColor` and `accentColor` from the data payload passed to `updateSettings()`.
- [ ] **tooltips.js** — Remove `TOOLTIPS.settings.primaryColor` and `TOOLTIPS.settings.accentColor`
      entries from the `settings` namespace.

### Tests

- [ ] **settings.test.js (backend)** — Remove or update test cases that assert on `primaryColor`
      and `accentColor` in GET responses. Remove the PUT test case that submits `primaryColor:
    "#123456"`. Remove the PUT validation test case for invalid hex color format. Update any
      `expect(res.body.data)` assertions that currently include these fields.
- [ ] **Settings.test.jsx (frontend)** — Remove test cases for color picker rendering, hex
      validation errors for color fields, and color error clearing. Keep all other tests (role guard,
      company name validation, logo, save flow, toast messages).
- [ ] **BrandingContext.test.jsx (frontend)** — Remove test cases that verify `--bs-primary`,
      `--bs-primary-rgb`, `--bs-secondary`, and `--bs-secondary-rgb` CSS custom property injection.
      Keep tests for basic rendering, `companyName` propagation, and error fallback.

### Seed Data

- [ ] Verify `backend/seeds/settings.js` no longer seeds `primaryColor` or `accentColor`. If the
      MongoDB collection already has a singleton document with these fields, the fields will remain
      on the existing document (Mongoose schema changes do not auto-migrate existing data). Run
      `make reset` in a dev environment to reseed with clean data after the schema change.

### Accessibility

- [ ] No new accessible UI is introduced. Removing configurable colors eliminates the risk of
      admins setting inaccessible contrast values. No WCAG audit action required beyond verifying
      the remaining Settings form still has correct label associations and error message linkage.

---

## NFR Impact

| NFR             | Impact                                                                                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security        | **Positive** — Reduced API surface (fewer fields in allowed whitelist, fewer validation paths).                                                                                               |
| Performance     | **Positive** — `BrandingContext` no longer performs CSS custom property injection on every app mount; slightly faster initial render. No quote builder recalc path involved.                  |
| Accessibility   | **Positive** — Bootstrap default colors (`#0d6efd` on white background ≈ 4.7:1 ratio) meet WCAG 2.1 AA. Removing user-configurable colors eliminates the risk of non-compliant color choices. |
| Browser support | No impact — CSS custom property manipulation was already restricted to `BrandingContext`; its removal is transparent to the browser.                                                          |

---

## Open Questions

None. All interview questions have been answered.

---

## Deferred Items

| Item                                                      | Rationale                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FR-PROP-2 (Phase 3)** — PDF proposals with brand colors | `primaryColor` and `accentColor` are being permanently removed. Phase 3 will need to approach proposal styling differently (e.g., a separate proposal-theme configuration or hardcoded Bootstrap defaults).                                                                                                                  |
| **Database migration**                                    | Existing singleton `settings` documents in deployed instances will retain `primaryColor` and `accentColor` fields as orphaned data. A migration script (e.g., using `$unset`) can be written as a separate task if needed for cleanup; it is not required for the application to function correctly after the schema change. |

---

## Draft PRD Section

> **Note:** This change modifies existing section **7.2 Company Branding & Settings** rather than
> adding a new section. The revised text below replaces the current FR-BRAND-1, FR-BRAND-2, and
> FR-BRAND-3 entries. It also requires minor edits to FR-TTIP-8 (section 7.13) and the `settings`
> data model entry in section 8.

### Revised Section 7.2 — Company Branding & Settings

```markdown
#### 7.2 Company Branding & Settings

- **FR-BRAND-1:** A Super Admin settings page to configure: Company Name and Logo (file upload).
- **FR-BRAND-2:** The application uses Bootstrap 5 default colors throughout; brand color
  customization is not supported. Company Name and Logo are the only configurable brand identity
  fields.
- **FR-BRAND-3:** Default state is a neutral "Enterprise CPQ" identity with a placeholder logo
  until configured.
```

### Revised FR-TTIP-8 (Settings fields, section 7.13)

Replace:

```
- **Settings:** `companyName`, `primaryColor`, `accentColor`, `logoUrl`, …
```

With:

```
- **Settings:** `companyName`, `logoUrl`, `managerReviewPercent`, `executiveReviewPercent`,
  margin `global.green`, margin `global.yellow`
```

### Revised Data Model — `settings` (section 8)

Replace:

```
id, companyName, logoUrl, primaryColor, accentColor,
discountThresholds{…}, …
```

With:

```
id, companyName, logoUrl,
discountThresholds{managerReviewPercent, executiveReviewPercent},
marginTargets{global{green, yellow}, productLines{…}},
volumeDiscountRules[], salesforceConfig, smtpConfig
```
