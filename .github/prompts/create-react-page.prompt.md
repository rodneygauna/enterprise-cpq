---
description: "Scaffold a new React page component with React Router v6 registration, Bootstrap layout, Axios data fetching with loading and error states, and a role guard."
argument-hint: "Page name, route path, and minimum role required (e.g. 'ProductCatalog at /admin/products, admin only')"
agent: "agent"
---

Scaffold a new React page for Enterprise CPQ.

Follow all conventions in [frontend.instructions.md](../instructions/frontend.instructions.md) and [accessibility.instructions.md](../instructions/accessibility.instructions.md).

## Step 1 — Page Component (`frontend/src/pages/<PageName>.jsx`)

```jsx
import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function <PageName>() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/<resource>')
      .then(res => setData(res.data.data))
      .catch(err => setError(err.response?.data?.error ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="d-flex justify-content-center py-5" role="status" aria-label="Loading">
      <div className="spinner-border" aria-hidden="true" />
      <span className="visually-hidden">Loading...</span>
    </div>
  );

  if (error) return (
    // Inline alert is appropriate here — the page cannot render without this data
    <div className="alert alert-danger" role="alert">{error}</div>
  );

  return (
    <main id="main-content">
      <div className="container-fluid py-4">
        <h1 className="h3 mb-4"><PageName></h1>
        {/* page content */}
      </div>
    </main>
  );
}
```

## Step 2 — Route Registration

Add the route to the router configuration in `frontend/src/main.jsx` (or `src/routes.jsx`):

```jsx
// Public route
{ path: '/<path>', element: <PageName /> }

// Protected route (any authenticated user)
{ path: '/<path>', element: <ProtectedRoute><PageName /></ProtectedRoute> }

// Role-restricted route
{ path: '/<path>', element: (
  <ProtectedRoute>
    <RequireRole roles={['admin', 'super_admin']}>
      <PageName />
    </RequireRole>
  </ProtectedRoute>
)}
```

## Step 3 — Navigation Link

Add a `<NavLink>` to the sidebar or navbar in the appropriate layout component:

```jsx
<NavLink to="/<path>" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
  <PageName>
</NavLink>
```

## Rules to Follow

1. Always render a loading state while fetching
2. Always render an inline `alert alert-danger` if the **initial page load** fails (nothing to show)
3. Use `toast.success()` / `toast.error()` from `react-toastify` for **mutation feedback** (save, create, update, delete) — never inline alerts for those
4. Use `<main id="main-content">` as the root element for the page content
5. Never add a `<ToastContainer>` to individual pages — it is mounted once in `src/main.jsx`
6. Use `<h1>` for the page title — only one `<h1>` per page
7. Use Bootstrap layout classes (`container-fluid`, `row`, `col-*`) for layout — not custom CSS
8. Never hardcode colors — use Bootstrap utility classes and CSS custom properties
9. Wrap admin-only sections in `<RequireRole>` — never rely on the backend alone for hiding UI
10. **If the page has any create / read / update operations (add, edit, view):**
    - Use `<OffcanvasDrawer>` from `src/components/OffcanvasDrawer.jsx` — **never** a right-column inline form or custom slide-out markup
    - Follow the state pattern (`drawerOpen`, `editingId`, `viewItem`, `viewOpen`) and helper functions (`openAddDrawer`, `openEditDrawer`, `closeDrawer`, `openViewDrawer`, `closeViewDrawer`) documented in [frontend.instructions.md](../instructions/frontend.instructions.md)
    - Record name cells in tables are always `btn-link` buttons that open the view drawer (`aria-label="View details for {name}"`)
    - Admin action buttons (Edit / Delete) in the view drawer go **above** the detail list, not below
    - Delete confirmation uses a centered Bootstrap `modal`, **not** the offcanvas
11. **If the page contains a form:**
    - Add `noValidate` to `<form>`
    - Validate all required/format-constrained fields on submit before calling the API — use the pattern in [frontend.instructions.md](../instructions/frontend.instructions.md)
    - Mark required fields with `aria-required="true"` and a `<span className="text-muted fw-normal small">(required)</span>` in the label
    - Use `is-invalid` + `<div class="invalid-feedback">` for field errors; clear each error when the user corrects the field
    - Put `validate()` and any regex constants at **module scope** (outside the component)
12. Check [accessibility.instructions.md](../instructions/accessibility.instructions.md) before finalizing

## Step 1 — Page Component (`frontend/src/pages/<PageName>.jsx`)

```jsx
import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function <PageName>() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/<resource>')
      .then(res => setData(res.data.data))
      .catch(err => setError(err.response?.data?.error ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="d-flex justify-content-center py-5" role="status" aria-label="Loading">
      <div className="spinner-border" aria-hidden="true" />
      <span className="visually-hidden">Loading...</span>
    </div>
  );

  if (error) return (
    // Inline alert is appropriate here — the page cannot render without this data
    <div className="alert alert-danger" role="alert">{error}</div>
  );

  return (
    <main id="main-content">
      <div className="container-fluid py-4">
        <h1 className="h3 mb-4"><PageName></h1>
        {/* page content */}
      </div>
    </main>
  );
}
```

## Step 2 — Route Registration

Add the route to the router configuration in `frontend/src/main.jsx` (or `src/routes.jsx`):

```jsx
// Public route
{ path: '/<path>', element: <PageName /> }

// Protected route (any authenticated user)
{ path: '/<path>', element: <ProtectedRoute><PageName /></ProtectedRoute> }

// Role-restricted route
{ path: '/<path>', element: (
  <ProtectedRoute>
    <RequireRole roles={['admin', 'super_admin']}>
      <PageName />
    </RequireRole>
  </ProtectedRoute>
)}
```

## Step 3 — Navigation Link

Add a `<NavLink>` to the sidebar or navbar in the appropriate layout component:

```jsx
<NavLink to="/<path>" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
  <PageName>
</NavLink>
```

## Rules to Follow

1. Always render a loading state while fetching
2. Always render an inline `alert alert-danger` if the **initial page load** fails (nothing to show)
3. Use `toast.success()` / `toast.error()` from `react-toastify` for **mutation feedback** (save, create, update, delete) — never inline alerts for those
4. Use `<main id="main-content">` as the root element for the page content
5. Never add a `<ToastContainer>` to individual pages — it is mounted once in `src/main.jsx`
6. Use `<h1>` for the page title — only one `<h1>` per page
7. Use Bootstrap layout classes (`container-fluid`, `row`, `col-*`) for layout — not custom CSS
8. Never hardcode colors — use Bootstrap utility classes and CSS custom properties
9. Wrap admin-only sections in `<RequireRole>` — never rely on the backend alone for hiding UI
10. **If the page contains a form:**
    - Add `noValidate` to `<form>`
    - Validate all required/format-constrained fields on submit before calling the API — use the pattern in [frontend.instructions.md](../instructions/frontend.instructions.md)
    - Mark required fields with `aria-required="true"` and a `<span className="text-muted fw-normal small">(required)</span>` in the label
    - Use `is-invalid` + `<div class="invalid-feedback">` for field errors; clear each error when the user corrects the field
    - Put `validate()` and any regex constants at **module scope** (outside the component)
11. Check [accessibility.instructions.md](../instructions/accessibility.instructions.md) before finalizing
