import { useAuth } from "../hooks/useAuth";

/**
 * Conditionally renders children only when the current user holds one of
 * the specified roles. Renders an accessible "Access denied" notice otherwise.
 *
 * Usage:
 *   <RequireRole roles={['admin', 'super_admin']}>
 *     <AdminPanel />
 *   </RequireRole>
 *
 * Role hierarchy: super_admin > admin > executive > sales_manager > sales_rep
 */
export default function RequireRole({ roles, children }) {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return (
      <div className="alert alert-warning" role="alert">
        <strong>Access denied.</strong> You do not have permission to view this
        content.
      </div>
    );
  }

  return children;
}
