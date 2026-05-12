# Plan: Modern UI Design System

## TL;DR

Layer a cohesive modern design system on top of the existing Bootstrap 5 dependency without replacing
it. The work introduces a single custom CSS file of design tokens (CSS custom properties), the
**Inter + Plus Jakarta Sans** font pairing, Bootstrap Icons integration across all buttons, polished
component overrides (cards, buttons, tables, forms, navbar), **glassmorphism surface effects**
(modals, sidebar, offcanvas panels via `backdrop-filter`), a restructured **persistent sidebar
navigation** in `Layout.jsx`, and a lightweight dark-mode toggle stored in `localStorage`. No
backend changes, no new admin controls, no CSS preprocessor migration. Every page and component
benefits automatically because the tokens cascade through Bootstrap's own custom-property layer.

---

## Problem Statement

Users are satisfied with the functional behavior of Enterprise CPQ but have asked for a more modern
aesthetic. The current UI uses raw Bootstrap 5.3.3 utility classes with no custom CSS. Two CSS
variables (`--bs-primary`, `--bs-secondary`) are injected at runtime by `BrandingContext`, but there
is no design-token layer for typography, spacing rhythm, shadows, border radii, or component
surface polish. The result is a visually generic interface that lacks the premium feel expected of an
enterprise SaaS product.

---

## Desired Behavior & Success Criteria

- A single `frontend/src/styles/theme.css` file defines all custom design tokens and Bootstrap
  overrides; no color values are hardcoded in any JSX file.
- **Inter** (body) + **Plus Jakarta Sans** (headings) font pairing applied globally via `<link>` in
  `index.html` with `font-display: swap`.
- Bootstrap Icons installed as an npm package; **every button** in the application carries an icon +
  text combination.
- Cards, buttons, tables, forms, and the navbar have polished visual treatment (consistent border
  radius, subtle drop shadows, refined hover states) without changing any component logic.
- **Glassmorphism surface effects** (`backdrop-filter: blur()` + semi-transparent background) applied
  to the sidebar, modals, offcanvas panels, and `OffcanvasDrawer` component, with a graceful
  `@supports` fallback for GPU configurations that do not support `backdrop-filter`.
- `Layout.jsx` restructured to use a **persistent left sidebar navigation** on ≥ md breakpoints;
  on smaller viewports the sidebar collapses to an offcanvas hamburger menu (reusing the existing
  `OffcanvasDrawer`).
- A dark-mode toggle button is visible in the sidebar (or topbar on mobile) for all user roles.
- Toggling dark mode switches the root `data-bs-theme` attribute between `"light"` and `"dark"`;
  the preference is persisted to `localStorage` and restored on page load.
- All modified UI elements continue to pass WCAG 2.1 AA contrast ratios in both light and dark
  modes.
- No Bootstrap version upgrade required; Bootstrap 5.3.3 remains the dependency.
- No new backend routes, models, or services are introduced.
- The `BrandingContext` dynamic primary/secondary injection continues to work as today.

---

## Phase Alignment

**Cross-cutting concern — not tied to Phase 1, 2, or 3.** This is a platform-level UI polish layer
that benefits all phases and can be delivered independently of any feature work. It has no
cross-phase dependencies. It should be implemented early so that all future Phase 1 completions and
Phase 2/3 screens inherit the design system automatically.

No PRD phase conflict. No user confirmation required.

---

## Out-of-Scope

- No complete component library replacement (e.g. no shadcn/ui, MUI, Ant Design, or Chakra UI).
- No CSS preprocessor (SCSS/Less/PostCSS) migration — plain CSS custom properties only.
- No removal of Bootstrap as a dependency.
- No per-user theme persistence to the database (Settings model is not touched).
- No new admin-only theme editor or Settings page changes.
- No custom icon design or SVG sprite system — Bootstrap Icons npm package only.
- No animation library integration (framer-motion, etc.).
- No Storybook or design-system documentation site.

---

## Affected Files

| Layer     | File                                                 | Change Type         |
| --------- | ---------------------------------------------------- | ------------------- |
| Style     | `frontend/src/styles/theme.css`                      | Create              |
| Entry     | `frontend/index.html`                                | Modify              |
| Entry     | `frontend/src/main.jsx`                              | Modify              |
| Component | `frontend/src/components/Layout.jsx`                 | Modify (structural) |
| Component | `frontend/src/components/Sidebar.jsx`                | Create              |
| Component | `frontend/src/components/OffcanvasDrawer.jsx`        | Modify              |
| Component | `frontend/src/components/QuoteSummaryPanel.jsx`      | Modify              |
| Component | `frontend/src/components/MultiYearForecast.jsx`      | Modify              |
| Page      | `frontend/src/pages/Login.jsx`                       | Modify              |
| Page      | `frontend/src/pages/Register.jsx`                    | Modify              |
| Page      | `frontend/src/pages/ForgotPassword.jsx`              | Modify              |
| Page      | `frontend/src/pages/ResetPassword.jsx`               | Modify              |
| Page      | `frontend/src/pages/AcceptInvite.jsx`                | Modify              |
| Page      | `frontend/src/pages/QuoteBuilder.jsx`                | Modify              |
| Page      | `frontend/src/pages/QuoteDashboard.jsx`              | Modify              |
| Page      | `frontend/src/pages/Products.jsx`                    | Modify              |
| Page      | `frontend/src/pages/ProductLines.jsx`                | Modify              |
| Page      | `frontend/src/pages/Users.jsx`                       | Modify              |
| Page      | `frontend/src/pages/Settings.jsx`                    | Modify              |
| Page      | `frontend/src/pages/ApprovalQueue.jsx`               | Modify              |
| Dep       | `frontend/package.json`                              | Modify              |
| Test (FE) | `frontend/src/styles/__tests__/theme.test.js`        | Create              |
| Test (FE) | `frontend/src/components/__tests__/Sidebar.test.jsx` | Create              |

---

## Implementation Steps

### 1 — Install Bootstrap Icons

- [ ] Add `bootstrap-icons` to `frontend/package.json` dependencies.
- [ ] Import `bootstrap-icons/font/bootstrap-icons.css` in `frontend/src/main.jsx` (after Bootstrap CSS).

### 2 — Font Integration

- [ ] Add `<link>` preconnects and stylesheet for **Inter** + **Plus Jakarta Sans** (or chosen pairing)
      from Google Fonts to `frontend/index.html`.
- [ ] Use `font-display: swap` strategy (handled by Google Fonts URL parameter `&display=swap`).
- [ ] Update `<meta name="viewport">` if not already present for mobile-first rendering.

### 3 — Create the Design Token CSS File

Create `frontend/src/styles/theme.css` with the following sections:

#### a. Typography tokens

```css
:root {
  --cpq-font-sans: "Inter", system-ui, sans-serif;
  --cpq-font-heading: "Plus Jakarta Sans", "Inter", system-ui, sans-serif;
  --cpq-font-size-base: 0.9375rem; /* 15px */
  --bs-body-font-family: var(--cpq-font-sans);
  --bs-heading-font-family: var(--cpq-font-heading);
}
```

#### b. Spacing & radius tokens

```css
:root {
  --cpq-radius-sm: 0.375rem;
  --cpq-radius-md: 0.625rem;
  --cpq-radius-lg: 1rem;
  --cpq-radius-pill: 50rem;
  --bs-border-radius: var(--cpq-radius-md);
  --bs-border-radius-lg: var(--cpq-radius-lg);
  --bs-border-radius-sm: var(--cpq-radius-sm);
}
```

#### c. Shadow tokens

```css
:root {
  --cpq-shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.06);
  --cpq-shadow-sm: 0 1px 4px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
  --cpq-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.04);
  --cpq-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
  --bs-box-shadow: var(--cpq-shadow-sm);
  --bs-box-shadow-lg: var(--cpq-shadow-lg);
}
```

#### d. Card overrides

```css
.card {
  box-shadow: var(--cpq-shadow-sm);
  border: 1px solid rgba(0, 0, 0, 0.07);
}
.card-header {
  font-family: var(--cpq-font-heading);
  font-weight: 600;
  letter-spacing: -0.01em;
}
```

#### e. Button overrides

```css
.btn {
  font-weight: 500;
  letter-spacing: 0.01em;
  transition: all 0.15s ease;
}
.btn-primary {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}
.btn-primary:hover {
  filter: brightness(1.08);
}
```

#### f. Table overrides

```css
.table {
  font-size: 0.9rem;
}
.table th {
  font-family: var(--cpq-font-heading);
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  color: var(--bs-secondary);
}
```

#### g. Form overrides

```css
.form-control,
.form-select {
  box-shadow: var(--cpq-shadow-xs);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.form-control:focus,
.form-select:focus {
  box-shadow: 0 0 0 3px rgba(var(--bs-primary-rgb), 0.18);
}
.form-label {
  font-weight: 500;
  font-size: 0.875rem;
}
```

#### h. Navbar overrides

```css
.navbar {
  box-shadow: var(--cpq-shadow-sm);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.navbar-brand {
  font-family: var(--cpq-font-heading);
  font-weight: 700;
  letter-spacing: -0.02em;
}
```

#### i. Dark mode tokens

```css
[data-bs-theme="dark"] {
  --cpq-shadow-sm:
    0 1px 4px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.04);
  --cpq-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --bs-border-color: rgba(255, 255, 255, 0.1);
}
[data-bs-theme="dark"] .card {
  border-color: rgba(255, 255, 255, 0.08);
}
```

#### j. Glassmorphism tokens

```css
:root {
  --cpq-glass-bg: rgba(255, 255, 255, 0.65);
  --cpq-glass-blur: blur(14px);
  --cpq-glass-border: 1px solid rgba(255, 255, 255, 0.35);
}
[data-bs-theme="dark"] {
  --cpq-glass-bg: rgba(30, 30, 40, 0.7);
  --cpq-glass-border: 1px solid rgba(255, 255, 255, 0.1);
}
/* Applied as a utility class; @supports ensures graceful degradation */
@supports (backdrop-filter: blur(1px)) {
  .cpq-glass {
    background: var(--cpq-glass-bg);
    backdrop-filter: var(--cpq-glass-blur);
    -webkit-backdrop-filter: var(--cpq-glass-blur);
    border: var(--cpq-glass-border);
  }
}
/* Fallback for browsers without backdrop-filter */
.cpq-glass {
  background: var(--bs-body-bg);
  border: var(--cpq-glass-border);
}
```

> The `.cpq-glass` utility class is applied to: the persistent `Sidebar` component, `OffcanvasDrawer`,
> modal headers, and any floating panels. It must NOT be applied to form controls or table rows.

### 4 — Import theme.css in main.jsx

- [ ] In `frontend/src/main.jsx`, add `import './styles/theme.css'` **after** the Bootstrap import
      so tokens override Bootstrap defaults correctly.

### 5 — Persistent Sidebar Navigation

- [ ] Create `frontend/src/components/Sidebar.jsx`:
  - Renders a `<nav>` on the left side of the viewport, visible at Bootstrap `md` breakpoint and
    above (use `d-none d-md-flex` + CSS width ~240px with `position: sticky; top: 0; height: 100vh`).
  - Applies `.cpq-glass` for the glassmorphism surface effect.
  - Contains all navigation links currently in the top navbar (mapped from the same role-aware
    `RequireRole` logic).
  - Includes the brand logo / name at the top and the dark-mode toggle at the bottom.
  - All nav links use Bootstrap Icons icon + visible text label. Active route is highlighted using
    `useLocation()` from React Router.
  - Keyboard-navigable; each link has appropriate `aria-current="page"` when active.
- [ ] Refactor `frontend/src/components/Layout.jsx`:
  - Replace the current full-width top `<nav>` with a two-column flex/grid layout:
    `Sidebar` (fixed left) + `<main>` (flexible right, `overflow-y: auto`).
  - On `< md` viewports: hide `Sidebar`, show a minimal top bar with hamburger button that opens
    the existing `OffcanvasDrawer` (now carrying the same nav links + dark-mode toggle).
  - `OffcanvasDrawer` receives `.cpq-glass` styling.

### 6 — Dark Mode Toggle

- [ ] In `Sidebar.jsx` (desktop) and `OffcanvasDrawer.jsx` (mobile):
  - Add a `useDarkMode` hook exported from `frontend/src/hooks/useDarkMode.js` that reads/writes
    `localStorage` key `cpq-theme` and sets `document.documentElement.setAttribute('data-bs-theme', value)`.
  - On mount, restore the saved preference (default: `'light'`).
  - Toggle button uses `bi-moon-stars-fill` (dark mode active) / `bi-sun-fill` (light mode active).
  - Button has `aria-label="Toggle dark mode"` and `aria-pressed` state.

### 7 — Auth Page Polish

- [ ] Wrap auth forms (`Login`, `Register`, `ForgotPassword`, `ResetPassword`, `AcceptInvite`) in a
      centered card with `cpq-shadow-md` and a subtle brand gradient header area. These pages do not
      use the sidebar layout (no authenticated nav).

### 8 — Apply Bootstrap Icons to All Buttons

- [ ] Audit every `<button>` and `<Button>` in all 12 pages and 6 components.
- [ ] Add a `<i className="bi bi-...">` + non-breaking space before button label text for all
      action buttons. Suggested icon map:
  - Save / Submit → `bi-check-lg`
  - Delete / Remove → `bi-trash3`
  - Add / Create / New → `bi-plus-lg`
  - Edit → `bi-pencil`
  - Export → `bi-download`
  - Back / Cancel → `bi-arrow-left` / `bi-x-lg`
  - Search / Filter → `bi-search`
  - Refresh → `bi-arrow-clockwise`
  - Settings → `bi-gear`
  - Invite / Users → `bi-person-plus`
- [ ] Every icon must have a visible text label alongside it (no icon-only buttons except the dark
      mode toggle, which has `aria-label`).

### 9 — Page-Level Table & Card Polish

- [ ] Confirm data tables in `Products`, `ProductLines`, `Users`, `QuoteDashboard`, `ApprovalQueue`
      receive the new `.table` overrides automatically (no class changes required).
- [ ] Confirm cards in `QuoteBuilder`, `QuoteSummaryPanel`, `Settings` receive new shadow tokens
      automatically.

### 10 — Accessibility Audit

- [ ] Run a contrast check on all custom token color combinations (light + dark) against WCAG 2.1 AA
      (4.5:1 body text, 3:1 UI components).
- [ ] Ensure dark mode toggle has `aria-label="Toggle dark mode"` and `aria-pressed` state.
- [ ] Verify all Bootstrap Icon usage has visible text label or `aria-label`.
- [ ] Test keyboard navigation through all modified flows, including sidebar nav and offcanvas mobile menu.
- [ ] Verify `@supports` glassmorphism fallback renders correctly in a browser with `backdrop-filter` disabled.

---

## NFR Impact

| NFR             | Impact                                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Performance** | One additional CSS file (~4–6 KB gzipped). Google Fonts adds 2 network requests (mitigated by `preconnect`). Sidebar re-render is a React state change; no recalc path impact.                                              |
| **Security**    | `localStorage` stores only the string `"light"` or `"dark"` — no PII. No new API surface.                                                                                                                                   |
| **WCAG 2.1 AA** | All new tokens must pass contrast audit. Dark mode toggle requires `aria-label` + `aria-pressed`. All icon buttons need visible text labels. Sidebar `nav` must have `aria-label`. Active links need `aria-current="page"`. |
| **Browser**     | CSS custom properties and `data-bs-theme` (Bootstrap 5.3+) are supported in all modern evergreen browsers. `backdrop-filter` is unsupported in some older Chromium versions; `@supports` fallback is mandatory.             |
| **Bundle size** | Bootstrap Icons font adds ~100 KB. Consider icon subset in a future iteration. Glassmorphism `backdrop-filter` has a minor GPU compositing cost — avoid applying `.cpq-glass` to frequently-scrolled elements.              |

---

## Open Questions

_All open questions resolved during planning session (May 12, 2026):_

1. **Font choice** ✅ — Inter + Plus Jakarta Sans confirmed.
2. **Glassmorphism** ✅ — Apply broadly: sidebar, modals, offcanvas panels. `@supports` fallback required.
3. **Sidebar nav** ✅ — Include in this iteration via new `Sidebar.jsx` component.
4. **Bootstrap Icons scope** ✅ — All buttons receive icon + text treatment.

---

## Deferred Items

| Item                                    | Rationale                                                           |
| --------------------------------------- | ------------------------------------------------------------------- |
| CSS preprocessor (SCSS/Less)            | Explicitly excluded by user in Q6.                                  |
| Component library replacement           | Explicitly excluded by user in Q6.                                  |
| Per-user dark mode DB persistence       | "No new controls added" (Q2); `localStorage` is sufficient for MVP. |
| Custom icon SVG sprite system           | Out of scope; Bootstrap Icons npm is sufficient.                    |
| Animation library (framer-motion, etc.) | Not requested; adds bundle weight.                                  |
| Storybook / design docs site            | Not requested; can be added in a future iteration.                  |
| Sidebar navigation                      | ~~Deferred~~ — confirmed IN SCOPE by user (May 12, 2026).           |

---

## Draft PRD Section

```markdown
### 7.12 Modern UI Design System

A cross-cutting design-system layer that adds design tokens, typography, component polish, Bootstrap
Icons, and a dark-mode toggle on top of the existing Bootstrap 5 dependency without replacing it or
introducing a CSS preprocessor.

- **FR-UIDS-1:** The application shall define all design tokens (typography, spacing, shadow, border
  radius) as CSS custom properties in a single `theme.css` file imported after Bootstrap. No color
  values shall be hardcoded in any JSX file.

- **FR-UIDS-2:** A curated font pairing (sans-serif body font + heading font) shall be applied
  globally via `<link>` in `index.html` using `font-display: swap` to prevent layout shift.

- **FR-UIDS-3:** Bootstrap Icons shall be installed as an npm package. **Every button** in the
  application shall carry a Bootstrap Icon paired with a visible text label. Standalone icon-only
  controls (e.g. dark mode toggle) shall carry `aria-label` in lieu of visible text.

- **FR-UIDS-4:** Cards, buttons, tables, forms, and the navbar shall receive polished visual
  treatment (consistent border radius, subtle drop shadows, refined hover states) via `theme.css`
  overrides, without modifying component logic.

- **FR-UIDS-5:** A dark-mode toggle button shall be present in the application navbar, visible to
  all user roles. Activating the toggle shall switch the root `data-bs-theme` attribute between
  `"light"` and `"dark"`. The toggle shall carry `aria-label="Toggle dark mode"` and
  `aria-pressed` reflecting the current state.

- **FR-UIDS-6:** The user's dark-mode preference shall be persisted to `localStorage` under the key
  `cpq-theme` and restored on page load. No database persistence is required.

- **FR-UIDS-7:** All UI elements introduced or modified by this feature shall pass WCAG 2.1 AA
  contrast ratios (≥ 4.5:1 for normal text, ≥ 3:1 for large text and UI components) in both light
  and dark modes. (Extends NFR-7 in Section 6.)

- **FR-UIDS-8:** The existing `BrandingContext` dynamic injection of `--bs-primary` and
  `--bs-secondary` shall continue to function as today; `theme.css` shall not override these
  variables in a way that breaks runtime branding.

- **FR-UIDS-9:** The application shall apply glassmorphism surface effects (`backdrop-filter: blur()`
  - semi-transparent background) to the sidebar, offcanvas drawer, and modal headers using a
    `.cpq-glass` utility class. An `@supports` CSS block shall provide a solid-background fallback
    for browsers that do not support `backdrop-filter`.

- **FR-UIDS-10:** The application shell (`Layout.jsx`) shall be restructured to present a persistent
  left sidebar navigation at the Bootstrap `md` breakpoint and above. On viewports smaller than
  `md`, the sidebar shall collapse and be accessible via an offcanvas hamburger menu. The sidebar
  shall display brand name, all role-gated navigation links (each with Bootstrap Icon + text label),
  and the dark-mode toggle. The active route shall be indicated via `aria-current="page"` and a
  distinct visual style.

#### New Environment Variables

None.

#### New Dependencies

| Package           | Purpose                              |
| ----------------- | ------------------------------------ |
| `bootstrap-icons` | Icon set; imported via CSS font file |
```
