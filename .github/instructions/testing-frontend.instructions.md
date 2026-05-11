---
applyTo:
  [
    "frontend/src/**/*.test.js",
    "frontend/src/**/*.test.jsx",
    "frontend/src/**/__tests__/**",
  ]
description: "Use when writing frontend tests. Covers Vitest + React Testing Library setup, mocking Axios and useAuth, naming conventions, and what to test for components and hooks."
---

# Frontend Testing Conventions

## Tools

| Tool                          | Purpose                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| `vitest`                      | Test runner (Vite-native, Jest-compatible API)               |
| `@testing-library/react`      | Component rendering and querying                             |
| `@testing-library/user-event` | Realistic user interaction simulation                        |
| `@testing-library/jest-dom`   | Extended matchers (`toBeInTheDocument`, `toHaveValue`, etc.) |
| `jsdom`                       | Browser environment emulation                                |

Install: `npm install --save-dev vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom`

---

## Vitest Configuration (`frontend/vite.config.js`)

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/tests/setup.js",
  },
});
```

`src/tests/setup.js`:

```js
import "@testing-library/jest-dom";
```

---

## Test File Location

Co-locate tests with the source they test:

```
frontend/src/
├── components/
│   └── __tests__/
│       └── ProductForm.test.jsx
├── pages/
│   └── __tests__/
│       └── QuoteBuilder.test.jsx
├── hooks/
│   └── __tests__/
│       └── useQuote.test.js
└── utils/
    └── __tests__/
        └── pricing.test.js
```

---

## Mocking Axios

```js
import { vi } from "vitest";
import api from "../api/axios";

vi.mock("../api/axios");

beforeEach(() => {
  vi.resetAllMocks();
});

it("renders product list from API", async () => {
  api.get.mockResolvedValueOnce({
    data: { data: [{ _id: "1", name: "Product A" }], error: null },
  });

  render(<ProductList />);

  expect(await screen.findByText("Product A")).toBeInTheDocument();
});
```

---

## Mocking `react-toastify`

When a component uses `toast.success()` or `toast.error()`, mock the module and assert on the call:

```js
vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
import { toast } from "react-toastify";

it("shows a success toast after save", async () => {
  updateResource.mockResolvedValue({ name: "Updated" });
  render(<MyPage />);

  await userEvent.click(screen.getByRole("button", { name: /save/i }));

  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith("Saved successfully."),
  );
});

it("shows an error toast when save fails", async () => {
  updateResource.mockRejectedValue({
    response: { data: { error: "Forbidden" } },
  });
  render(<MyPage />);

  await userEvent.click(screen.getByRole("button", { name: /save/i }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Forbidden"));
});
```

Do **not** query for the toast DOM element — `ToastContainer` is not rendered in the test environment.

---

## Mocking `useAuth`

```js
vi.mock("../hooks/useAuth");
import { useAuth } from "../hooks/useAuth";

// Inject an admin user
useAuth.mockReturnValue({
  user: { _id: "1", firstName: "Admin", role: "admin" },
  isAuthenticated: true,
  login: vi.fn(),
  logout: vi.fn(),
});
```

Always mock `useAuth` in component tests to avoid depending on a real auth context.

---

## Component Test Pattern

```jsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ProductForm } from "../ProductForm";

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("ProductForm", () => {
  it("shows validation error when name is empty on submit", async () => {
    const user = userEvent.setup();
    renderWithRouter(<ProductForm onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });

  it("calls onSubmit with form data when valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithRouter(<ProductForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/product name/i), "New Product");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Product" }),
    );
  });

  it("hides delete button for sales_rep role", () => {
    useAuth.mockReturnValue({
      user: { role: "sales_rep" },
      isAuthenticated: true,
    });
    renderWithRouter(<ProductForm onSubmit={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
  });
});
```

---

## What to Test

### Components & Pages

- Renders correctly with expected content visible
- Role-based UI: admin-only controls hidden for `sales_rep`
- Form validation: required field errors shown on submit; `aria-invalid` set on the invalid input
- **API not called when client-side validation fails** — assert `expect(apiMock).not.toHaveBeenCalled()`
- Error cleared when user corrects the field (type into field → error disappears)
- **API not called when client-side validation fails** — assert `expect(apiMock).not.toHaveBeenCalled()`
- Error cleared when user corrects the field (type into field → error disappears)
- Form submit: calls API with correct data
- Loading state: spinner or skeleton visible while fetching
- Initial load error: inline `alert-danger` visible on data fetch failure
- Mutation success: `toast.success` called with the correct message
- Mutation error: `toast.error` called with the correct message (including the fallback)

### Hooks (`useQuote`, `useAuth`)

- State updates correctly in response to actions
- Pricing recalculations return correct values for each pricing model

### Utilities (`src/utils/pricing.js`)

- Each pricing model formula: `PMPM`, `Flat Fee`, `Monthly Fee`, `Per Unit`, `Per User`, `Hourly`
- Tiered pricing: correct tier selected at boundaries
- Volume Bands: correct band selected for given membership count
- Annual uplift: multi-year revenue compounded correctly

---

## Naming Convention

Mirrors the backend style:

```
describe('<ComponentName>')
  it('<expected behavior when condition>')
```

Examples:

- `it('renders product name in the table row')`
- `it('hides admin actions when user role is sales_rep')`
- `it('calculates PMPM correctly for tiered pricing at tier boundary')`

---

## Critical Rules

- **No snapshot tests** — assert on visible text, roles, and labels; not on rendered HTML structure
- Use `getByRole`, `getByLabelText`, `getByText` — not `getByTestId` unless absolutely necessary
- Queries by role (`getByRole('button', { name: /save/i })`) double as accessibility checks
- Use `findBy*` (async) for elements that appear after a data fetch or user interaction
- **Never** import from `axios` directly in tests — always mock `src/api/axios.js`
- All tests must run with `npm test` from the `frontend/` directory with no browser required
