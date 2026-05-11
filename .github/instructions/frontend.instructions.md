---
applyTo: "frontend/**"
description: "Use when creating or editing React components, pages, hooks, or API modules. Covers project structure, Bootstrap 5 conventions, React Router v6, Axios setup, and role-based rendering."
---

# Frontend Conventions

## Project Structure

```
frontend/src/
├── api/
│   ├── axios.js          # Configured Axios instance with JWT refresh interceptor
│   ├── auth.js           # login, logout, register, refreshToken calls
│   ├── products.js       # getProducts, createProduct, updateProduct, deleteProduct
│   ├── quotes.js         # getQuotes, getQuote, createQuote, updateQuote, deleteQuote
│   ├── users.js          # getUsers, updateUser
│   └── settings.js       # getSettings, updateSettings
├── components/           # Reusable, stateless UI components
├── hooks/
│   ├── useAuth.js        # Returns { user, role, isAuthenticated, login, logout }
│   └── useQuote.js       # Quote builder state and calculation logic
├── pages/                # One file per route — imports components and calls API
└── utils/
    └── pricing.js        # Pure pricing calculation functions (mirror of backend/src/utils/pricing.js)
```

---

## Bootstrap 5 — Brand Color Rules

**Never hardcode hex color values.** Always use Bootstrap CSS custom properties:

```css
/* Correct */
color: var(--bs-primary);
background-color: var(--bs-secondary);

/* Wrong */
color: #007bff;
background-color: #6c757d;
```

Brand colors are injected at runtime from the Settings API and applied to `:root` via `document.documentElement.style.setProperty('--bs-primary', settings.primaryColor)`.

Use Bootstrap utility classes wherever possible (`btn-primary`, `text-secondary`, `bg-light`) before reaching for custom CSS.

---

## React Router v6

### Route Registration

Define all routes in `src/main.jsx` or a dedicated `src/routes.jsx` using `createBrowserRouter`:

```jsx
import { createBrowserRouter, RouterProvider } from "react-router-dom";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: "quotes", element: <QuoteHistory /> },
      { path: "quotes/:id", element: <QuoteBuilder /> },
      {
        path: "admin/products",
        element: (
          <RequireRole roles={["admin", "super_admin"]}>
            <ProductCatalog />
          </RequireRole>
        ),
      },
    ],
  },
  { path: "/login", element: <Login /> },
]);
```

### Protected Route Component

```jsx
// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
```

### Role Guard Component

```jsx
// src/components/RequireRole.jsx
import { useAuth } from "../hooks/useAuth";

export function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <p>Access denied.</p>;
  return children;
}
```

---

## Axios Instance

Configure once at `src/api/axios.js`:

```js
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true, // send httpOnly cookies on every request
});

// Response interceptor: on 401, attempt silent token refresh then retry
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      await api.post("/auth/refresh");
      return api(err.config);
    }
    return Promise.reject(err);
  },
);

export default api;
```

All domain API modules import from this instance — never create a second `axios.create()`.

---

## useAuth Hook

```js
// src/hooks/useAuth.js
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export function useAuth() {
  return useContext(AuthContext); // { user, isAuthenticated, login, logout }
}
```

`AuthContext` is provided at the app root. On mount, attempt a silent `/api/auth/me` call to restore session state.

---

## Data Fetching Pattern

Use `useEffect` + local state for simple pages. For complex shared state (quote builder), use a custom hook.

```jsx
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  api
    .get("/products")
    .then((res) => setData(res.data.data))
    .catch((err) => setError(err.response?.data?.error ?? "Failed to load"))
    .finally(() => setLoading(false));
}, []);
```

Always render loading and error states — never leave the UI blank while fetching.

---

## Role-Based UI Rendering

Use `useAuth()` and `RequireRole` — never read roles from `localStorage` or URL params:

```jsx
const { user } = useAuth();

// Show admin-only controls inline
{
  ["admin", "super_admin"].includes(user?.role) && (
    <button onClick={handleDelete}>Delete</button>
  );
}
```

---

## Form Validation Pattern

Validate on submit before calling the API. Keep the `validate` function and any regex constants at **module scope** (outside the component) so the build tool does not misparse them inside JSX.

```jsx
const NAME_RE = /^.+$/; // replace with appropriate rule
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function validate(values) {
  const errors = {};
  if (!values.name.trim()) errors.name = "Name is required.";
  if (values.color && !HEX_RE.test(values.color))
    errors.color = "Must be a valid 6-digit hex color (e.g. #0d6efd).";
  return errors;
}

function MyForm() {
  const [form, setForm] = useState({ name: "", color: "" });
  const [formErrors, setFormErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear the error for the field as soon as the user starts correcting it
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors); // show inline errors, do NOT call the API
      return;
    }
    setFormErrors({});
    // ... API call
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mb-3">
        <label htmlFor="name" className="form-label">
          Name <span className="text-muted fw-normal small">(required)</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className={`form-control${formErrors.name ? " is-invalid" : ""}`}
          value={form.name}
          onChange={handleChange}
          required
          aria-required="true"
          aria-describedby={formErrors.name ? "name-error" : undefined}
          aria-invalid={formErrors.name ? true : undefined}
        />
        {formErrors.name && (
          <div id="name-error" className="invalid-feedback">
            {formErrors.name}
          </div>
        )}
      </div>
    </form>
  );
}
```

**Rules:**

- Always use `noValidate` on `<form>` — suppress browser native validation bubbles in favour of the inline pattern above
  - Mark required fields with `aria-required="true"` and `<span className="text-muted fw-normal small">(required)</span>` in the label
- Use Bootstrap `is-invalid` class + `<div class="invalid-feedback">` for field-level errors
- Color-picker text inputs that sit outside a normal `<div class="mb-3">` need `invalid-feedback d-block` to display outside the flex row
- Regex / pure helper constants belong at **module scope**, not inside the component or render function

---

## OffcanvasDrawer — View / Add / Edit Pattern

All view, add, and edit operations **must** use the shared `OffcanvasDrawer` component (`src/components/OffcanvasDrawer.jsx`) instead of inline forms, modals, or custom slide-out markup.

### Component API

```jsx
import OffcanvasDrawer from "../components/OffcanvasDrawer";

<OffcanvasDrawer
  open={boolean} // controls mount + CSS enter/exit animation
  title="Add Product Line" // used as dialog aria-label and heading text
  onClose={fn} // called by the close button and backdrop click
  width="min(520px, 95vw)" // optional — this is the default
>
  {/* drawer body content */}
</OffcanvasDrawer>;
```

The component manages its own `mounted`/`show` state so the caller never needs `setTimeout` or `requestAnimationFrame`.

### Required State Pattern

Every page that uses the drawer needs these pieces of state:

```jsx
// Edit / Add drawer
const [drawerOpen, setDrawerOpen] = useState(false);
const [editingId, setEditingId] = useState(null); // null = add mode

// View drawer
const [viewItem, setViewItem] = useState(null);
const [viewOpen, setViewOpen] = useState(false);
```

And these helpers:

```jsx
function openAddDrawer() {
  setEditingId(null);
  setForm({ ...EMPTY_FORM });
  setFormErrors({});
  setDrawerOpen(true);
}

function openEditDrawer(item) {
  setEditingId(item._id);
  setForm(itemToForm(item));
  setFormErrors({});
  setDrawerOpen(true);
}

function closeDrawer() {
  setDrawerOpen(false);
  setFormErrors({});
}

function openViewDrawer(item) {
  setViewItem(item);
  setViewOpen(true);
}

function closeViewDrawer() {
  setViewOpen(false);
}
```

### Table Row Pattern

The record **name** is always a `btn-link` that opens the view drawer. Edit / Delete action buttons remain as separate columns or inside the view drawer header area.

```jsx
<td>
  <button
    className="btn btn-link p-0 text-start fw-semibold"
    onClick={() => openViewDrawer(item)}
    aria-label={`View details for ${item.name}`}
  >
    {item.name}
  </button>
</td>
```

### View Drawer Content Pattern

Place admin action buttons (Edit / Delete) **above** the detail list, not below it:

```jsx
<OffcanvasDrawer
  open={viewOpen}
  title={viewItem?.name ?? ""}
  onClose={closeViewDrawer}
>
  {viewItem && (
    <>
      {isAdmin && (
        <div className="d-flex gap-2 mb-4">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              closeViewDrawer();
              openEditDrawer(viewItem);
            }}
          >
            Edit
          </button>
          <button
            className="btn btn-outline-danger btn-sm"
            onClick={() => {
              closeViewDrawer();
              setDeleteTarget(viewItem);
            }}
          >
            Delete
          </button>
        </div>
      )}
      <dl className="row mb-0">{/* detail rows */}</dl>
    </>
  )}
</OffcanvasDrawer>
```

### Add / Edit Drawer Content Pattern

```jsx
<OffcanvasDrawer
  open={drawerOpen}
  title={editingId ? "Edit Product Line" : "Add Product Line"}
  onClose={closeDrawer}
>
  <form
    onSubmit={handleSubmit}
    noValidate
    aria-label={editingId ? "Edit product line" : "Add product line"}
  >
    {/* fields */}
    <div className="d-flex gap-2 justify-content-end">
      <button type="button" className="btn btn-secondary" onClick={closeDrawer}>
        Cancel
      </button>
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving
          ? "Saving…"
          : editingId
            ? "Save Changes"
            : "Create Product Line"}
      </button>
    </div>
  </form>
</OffcanvasDrawer>
```

### Rules

- **Never** use an inline `<div class="col-*">` right-column form for add/edit — always use the drawer
- **Never** re-implement the backdrop, animation, or close button — these live in `OffcanvasDrawer`
- The `title` prop is required and must be a meaningful string (used as the accessible dialog label)
- Delete confirmation still uses a centered Bootstrap `modal` — the offcanvas is for create/read/update only

---

Use **react-toastify** for transient success/error feedback on mutations (save, create, update, delete):

```jsx
import { toast } from "react-toastify";

async function handleSubmit(e) {
  e.preventDefault();
  try {
    await updateSettings(formData);
    toast.success("Settings saved successfully.");
  } catch (err) {
    toast.error(err.response?.data?.error ?? "Failed to save settings.");
  }
}
```

Use an **inline alert** (Bootstrap `alert-danger` with `role="alert"`) only for errors that block the entire page from rendering (e.g. failed initial data load where there is nothing to show).

The `<ToastContainer>` is mounted once in `src/main.jsx` — never add it to individual pages.

---

## Key Conventions

- Page components live in `src/pages/` and are responsible for data fetching and layout
- Reusable presentational components live in `src/components/` and receive data as props
- Pricing calculations are pure functions in `src/utils/pricing.js` — identical logic to the backend equivalent
- Never import directly from `axios`; always import from `src/api/axios.js`
- No hardcoded API base URLs — Vite proxies `/api` to the Express server in dev; Caddy handles it in prod
