---
description: "Master workflow prompt for implementing a complete PRD feature end-to-end: backend models + routes, frontend pages + components, tests, seed data, accessibility audit, and test run. Use when starting work on any PRD section."
argument-hint: "PRD section number and title (e.g. '7.1 Authentication' or '7.4 Product Catalog')"
agent: "agent"
---

Implement a complete Enterprise CPQ feature end-to-end.

**Before writing a single line of code, complete Steps 1 and 2 in full.**

---

## Step 1 — Read the PRD

Open [docs/PRD.md](../../docs/PRD.md) and read the section referenced in the argument (e.g. "7.1 Authentication").

Summarize:

- The feature requirements (FR-\* items)
- The data models involved (Section 8)
- Any dependencies on other PRD sections or previously implemented features
- Which user roles are affected and what permissions apply

---

## Step 2 — Clarify Before Building

Ask the user these questions before proceeding. Wait for answers.

1. Are there any requirements in this section you want to defer or descope for now?
2. Are there any existing files I should read before creating new ones (routes, models, components)?
3. Any specific edge cases or business rules you want prioritized in tests?

Do not proceed to Step 3 until the user responds.

---

## Step 3 — Backend Implementation

Follow [backend.instructions.md](../instructions/backend.instructions.md) and [mongoose-models.instructions.md](../instructions/mongoose-models.instructions.md).

- [ ] Create or update Mongoose model(s) in `backend/src/models/`
  - All fields from PRD Section 8 for the relevant collection(s)
  - Correct enums, timestamps, indexes, and soft-delete patterns
- [ ] Create or update Express route file(s) in `backend/src/routes/`
  - All endpoints required by the feature
  - Middleware chain: `authenticate → requireRole → validation → validate → handler`
  - Standard response shape: `{ data, error, meta }`
  - Input validation with `express-validator` on every endpoint
- [ ] Extract business logic into `backend/src/services/` if the handler exceeds ~20 lines
- [ ] Register new routers in `backend/src/app.js`
- [ ] Add any required env variables to `.env.example`

---

## Step 4 — Frontend Implementation

Follow [frontend.instructions.md](../instructions/frontend.instructions.md) and [accessibility.instructions.md](../instructions/accessibility.instructions.md).

- [ ] Create or update page component(s) in `frontend/src/pages/`
- [ ] Create or update reusable components in `frontend/src/components/`
- [ ] Add domain API calls to `frontend/src/api/<domain>.js`
- [ ] Add or update custom hooks in `frontend/src/hooks/` if needed
- [ ] Register new routes in the React Router configuration
- [ ] Add nav links to the appropriate layout component
- [ ] Wrap admin/role-restricted pages in `<RequireRole>`
- [ ] Add pricing calculation helpers to `frontend/src/utils/pricing.js` if needed (mirror of backend)
- [ ] **For any create / read / update UI:** use `<OffcanvasDrawer>` from `src/components/OffcanvasDrawer.jsx`
  - View drawer: record name is a `btn-link` that opens the drawer; admin actions (Edit/Delete) are at the top of the body above the detail `<dl>`
  - Add / Edit drawer: form lives inside the drawer with Cancel + Submit buttons at the bottom right
  - Delete confirmation uses a centered Bootstrap `modal`, not the offcanvas
  - Follow the exact state and helper function naming from [frontend.instructions.md](../instructions/frontend.instructions.md)

---

## Step 5 — Backend Tests

Follow [testing-backend.instructions.md](../instructions/testing-backend.instructions.md).

- [ ] Create test file(s) in `backend/src/routes/__tests__/`
- [ ] Cover every route: happy path, `401`, `403`, `422`, `404`
- [ ] Cover utility functions in `backend/src/utils/__tests__/`
- [ ] Use `mongodb-memory-server` — never the real `MONGO_URI`

---

## Step 6 — Frontend Tests

Follow [testing-frontend.instructions.md](../instructions/testing-frontend.instructions.md).

- [ ] Create test file(s) in `frontend/src/[pages|components|hooks]/__tests__/`
- [ ] Cover: renders correctly, role-based UI, loading state, error state, form validation, form submit
- [ ] Cover pricing utilities: all pricing models, strategies, edge cases from the PRD
- [ ] Mock Axios via `vi.mock('../api/axios')`; mock `useAuth` to inject roles

---

## Step 7 — Seed Data

- [ ] Check `backend/seeds/` for existing seed files for the models touched in this feature
- [ ] Create or update seed data for any new collections
- [ ] Seed data must be generic — no real company names, logos, or pricing
- [ ] Confirm `make seed` would produce a usable starting state for this feature

---

## Step 8 — Accessibility Audit

Follow [accessibility.instructions.md](../instructions/accessibility.instructions.md).

- [ ] Review every new React component against the full WCAG 2.1 AA checklist
- [ ] Fix all violations found before proceeding to Step 9
- [ ] Verify: labels, ARIA, focus management, color contrast, keyboard nav, semantic HTML

**Do not proceed to Step 9 with unresolved accessibility violations.**

---

## Step 9 — Run Tests

```bash
cd backend && npm test
cd frontend && npm test
```

- [ ] Report the number of tests passed and failed
- [ ] Fix any failing tests before finishing
- [ ] If a test reveals a bug in the implementation, fix the implementation — do not weaken the test

---

## Step 10 — Definition of Done

Before marking this feature complete, confirm all of the following:

- [ ] All FR-\* items from the PRD section are implemented or explicitly deferred (with reason noted)
- [ ] All new API endpoints follow the standard response shape and middleware chain
- [ ] All new UI follows Bootstrap CSS custom properties — no hardcoded colors
- [ ] All backend tests pass (`npm test` in `backend/`)
- [ ] All frontend tests pass (`npm test` in `frontend/`)
- [ ] All new React components pass the WCAG 2.1 AA checklist
- [ ] `.env.example` updated with any new environment variables
- [ ] Seed data in `backend/seeds/` covers the new models
- [ ] Any explicitly deferred scope items are listed below

**Deferred items (if any):**

<!-- List here — do not silently skip requirements -->
