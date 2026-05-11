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

## Key Conventions

- Page components live in `src/pages/` and are responsible for data fetching and layout
- Reusable presentational components live in `src/components/` and receive data as props
- Pricing calculations are pure functions in `src/utils/pricing.js` — identical logic to the backend equivalent
- Never import directly from `axios`; always import from `src/api/axios.js`
- No hardcoded API base URLs — Vite proxies `/api` to the Express server in dev; Caddy handles it in prod
