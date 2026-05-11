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
2. Always render an error state if the API call fails
3. Use `<main id="main-content">` as the root element for the page content
4. Use `<h1>` for the page title — only one `<h1>` per page
5. Use Bootstrap layout classes (`container-fluid`, `row`, `col-*`) for layout — not custom CSS
6. Never hardcode colors — use Bootstrap utility classes and CSS custom properties
7. Wrap admin-only sections in `<RequireRole>` — never rely on the backend alone for hiding UI
8. Check [accessibility.instructions.md](../instructions/accessibility.instructions.md) before finalizing
