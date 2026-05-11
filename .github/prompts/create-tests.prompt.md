---
description: "Generate unit and integration tests for a backend route file or a frontend component/hook. Covers happy path, auth/role rejection, validation errors, and PRD business rule edge cases."
argument-hint: "File path to test (e.g. 'backend/src/routes/products.js' or 'frontend/src/components/QuoteBuilder.jsx')"
agent: "agent"
---

Generate comprehensive tests for the specified file.

First, read the target file fully to understand what it does. Then read the relevant PRD section in [docs/PRD.md](../../docs/PRD.md) to identify business rule edge cases to cover.

---

## For Backend Route Files

Follow [testing-backend.instructions.md](../instructions/testing-backend.instructions.md).

Generate a test file at `backend/src/routes/__tests__/<routeName>.test.js`.

For every route in the file, generate tests covering:

| Scenario                                  | Expected                                   |
| ----------------------------------------- | ------------------------------------------ |
| Happy path — authorized user, valid input | `200`/`201`/`204` + correct response shape |
| Unauthenticated request (no cookie)       | `401`                                      |
| Authenticated but wrong role              | `403`                                      |
| Missing required field                    | `422` with `errors` array                  |
| Invalid enum value                        | `422`                                      |
| Invalid MongoId in params                 | `422`                                      |
| Resource not found                        | `404`                                      |
| Duplicate unique field (e.g. SKU)         | `409` or `422`                             |

Additionally, for pricing utility functions (`backend/src/utils/pricing.js`), generate unit tests for:

- Each pricing model: `PMPM`, `Flat Fee`, `Monthly Fee`, `Per Unit / Transaction`, `Per User / License`, `Hourly Rate`
- Each pricing strategy: `Standard`, `Tiered` (at boundary, above, below), `Volume Bands` (each band)
- Multi-year forecast with and without annual uplift
- Baseline product fee applied once regardless of number of selected products in the line

---

## For Frontend Components and Hooks

Follow [testing-frontend.instructions.md](../instructions/testing-frontend.instructions.md).

Generate a test file at `frontend/src/[components|pages|hooks]/__tests__/<Name>.test.jsx`.

For components, generate tests covering:

- Renders correctly and displays expected content
- Role-based rendering: admin controls hidden for `sales_rep`
- Loading state shown while API call is in-flight
- Error state shown when API call fails
- Form: required field validation error on submit
- Form: calls API with correct data on valid submit
- Any PRD business rules visible in the UI (e.g. scope-based pricing badge, baseline product label)

For hooks, generate tests covering:

- Initial state is correct
- State updates correctly after each action
- Pricing calculations return correct values for all pricing models and strategies

---

## Required Test Structure

```js
// Backend
describe('<METHOD> /api/<resource>', () => {
  it('returns <expected> when <condition>', async () => { ... });
});

// Frontend
describe('<ComponentName>', () => {
  it('<expected behavior when condition>', () => { ... });
});
```

After generating tests, run them:

- Backend: `cd backend && npm test -- --testPathPattern=<filename>`
- Frontend: `cd frontend && npm test -- <filename>`

Report which tests pass, which fail, and fix any failures before finishing.
