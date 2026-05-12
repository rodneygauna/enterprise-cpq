/**
 * Users — §7.7 User Management (Admin).
 *
 * FR-USER-1: Admin page listing all users (Name, Email, Role, Status, Last Login)
 * FR-USER-2: Admin can change a user's role and activate/deactivate accounts
 * FR-USER-3: Invite a new user by email (sends a registration link)
 */
import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";

import { useAuth } from "../hooks/useAuth";
import RequireRole from "../components/RequireRole";
import OffcanvasDrawer from "../components/OffcanvasDrawer";
import {
  getUsers,
  updateUserRole,
  updateUserStatus,
  inviteUser,
} from "../api/users";

const ADMIN_ROLES = ["admin", "super_admin"];

const ROLES = [
  "super_admin",
  "admin",
  "executive",
  "sales_manager",
  "sales_rep",
];

const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  executive: "Executive",
  sales_manager: "Sales Manager",
  sales_rep: "Sales Rep",
};

const ROLE_BADGE = {
  super_admin: "danger",
  admin: "primary",
  executive: "info text-dark",
  sales_manager: "warning text-dark",
  sales_rep: "secondary",
};

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return DATE_FMT.format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── Outer shell — role-guards the admin panel ─────────────────────────────────
export default function Users() {
  return (
    <RequireRole roles={ADMIN_ROLES}>
      <UsersPanel />
    </RequireRole>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
function UsersPanel() {
  const { user: currentUser } = useAuth();

  // ── List state ─────────────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  // ── Filters ────────────────────────────────────────────────────────────────
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({});

  // ── View drawer ────────────────────────────────────────────────────────────
  const [viewUser, setViewUser] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);

  // ── Edit drawer ────────────────────────────────────────────────────────────
  const [editUser, setEditUser] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editRole, setEditRole] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Invite drawer ──────────────────────────────────────────────────────────
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("sales_rep");
  const [inviteEmailError, setInviteEmailError] = useState("");
  const [inviting, setInviting] = useState(false);

  // ── Status toggle ──────────────────────────────────────────────────────────
  const [togglingId, setTogglingId] = useState(null);

  // ── Load users ─────────────────────────────────────────────────────────────
  const loadUsers = useCallback((filters = {}, pg = 1) => {
    setLoading(true);
    setError(null);
    const params = { page: pg, limit: LIMIT, ...filters };
    getUsers(params)
      .then((res) => {
        setUsers(res.data ?? []);
        setTotal(res.meta?.total ?? 0);
        setPage(res.meta?.page ?? 1);
      })
      .catch((err) => {
        setError(
          err?.response?.data?.error ??
            "Failed to load users. Please try again.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadUsers(appliedFilters, 1);
  }, [appliedFilters, loadUsers]);

  // ── Filter handlers ────────────────────────────────────────────────────────
  function handleApplyFilters(e) {
    e.preventDefault();
    const filters = {};
    if (filterRole) filters.role = filterRole;
    if (filterStatus) filters.status = filterStatus;
    setAppliedFilters(filters);
  }

  function handleClearFilters() {
    setFilterRole("");
    setFilterStatus("");
    setAppliedFilters({});
  }

  // ── View drawer ────────────────────────────────────────────────────────────
  function openView(u) {
    setViewUser(u);
    setViewOpen(true);
  }

  function closeView() {
    setViewOpen(false);
  }

  // ── Edit drawer ────────────────────────────────────────────────────────────
  function openEdit(u) {
    setEditUser(u);
    setEditRole(u.role);
    setEditOpen(true);
    setViewOpen(false);
  }

  function closeEdit() {
    setEditOpen(false);
  }

  async function handleSaveRole() {
    if (!editUser) return;
    setSaving(true);
    try {
      const updated = await updateUserRole(editUser._id, editRole);
      toast.success("Role updated.");
      setUsers((prev) =>
        prev.map((u) =>
          u._id === updated._id ? { ...u, role: updated.role } : u,
        ),
      );
      setEditOpen(false);
      // Keep view drawer in sync if the same user is open
      if (viewUser?._id === updated._id) {
        setViewUser((v) => ({ ...v, role: updated.role }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.error ?? "Failed to update role.");
    } finally {
      setSaving(false);
    }
  }

  // ── Activate / deactivate ──────────────────────────────────────────────────
  async function handleToggleStatus(u) {
    setTogglingId(u._id);
    try {
      const updated = await updateUserStatus(u._id, !u.isActive);
      toast.success(updated.isActive ? "User activated." : "User deactivated.");
      setUsers((prev) =>
        prev.map((x) =>
          x._id === updated._id ? { ...x, isActive: updated.isActive } : x,
        ),
      );
      // Keep view drawer in sync
      if (viewUser?._id === updated._id) {
        setViewUser((v) => ({ ...v, isActive: updated.isActive }));
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.error ?? "Failed to update user status.",
      );
    } finally {
      setTogglingId(null);
    }
  }

  // ── Invite ─────────────────────────────────────────────────────────────────
  function openInvite() {
    setInviteEmail("");
    setInviteRole("sales_rep");
    setInviteEmailError("");
    setInviteOpen(true);
  }

  function closeInvite() {
    setInviteOpen(false);
  }

  async function handleSendInvite(e) {
    e.preventDefault();
    setInviteEmailError("");

    const trimmed = inviteEmail.trim();
    if (!trimmed) {
      setInviteEmailError("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setInviteEmailError("Enter a valid email address.");
      return;
    }

    setInviting(true);
    try {
      await inviteUser(trimmed, inviteRole);
      toast.success(`Invitation sent to ${trimmed}.`);
      setInviteOpen(false);
      loadUsers(appliedFilters, 1);
    } catch (err) {
      const msg = err?.response?.data?.error ?? "Failed to send invitation.";
      if (err?.response?.status === 409) {
        setInviteEmailError(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setInviting(false);
    }
  }

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(total / LIMIT);

  function handlePageChange(pg) {
    loadUsers(appliedFilters, pg);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="container-fluid py-4">
      {/* Page header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h1 className="h3 mb-0">User Management</h1>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={openInvite}
        >
          + Invite User
        </button>
      </div>

      {/* ── Filters ── */}
      <section aria-labelledby="filters-heading" className="mb-3">
        <h2 className="visually-hidden" id="filters-heading">
          User Filters
        </h2>
        <form
          onSubmit={handleApplyFilters}
          className="card border-0 shadow-sm"
          aria-label="Filter users"
        >
          <div className="card-body">
            <div className="row g-2 align-items-end">
              <div className="col-md-3">
                <label className="form-label small mb-1" htmlFor="filterRole">
                  Role
                </label>
                <select
                  id="filterRole"
                  className="form-select form-select-sm"
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                >
                  <option value="">All Roles</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-1" htmlFor="filterStatus">
                  Status
                </label>
                <select
                  id="filterStatus"
                  className="form-select form-select-sm"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="col-md-2">
                <button type="submit" className="btn btn-primary btn-sm w-100">
                  Filter
                </button>
              </div>
            </div>
            {Object.keys(appliedFilters).length > 0 && (
              <div className="mt-2">
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-muted"
                  onClick={handleClearFilters}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </form>
      </section>

      {/* ── Users table ── */}
      <section aria-labelledby="users-table-heading">
        <h2 className="visually-hidden" id="users-table-heading">
          Users
        </h2>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div
            className="d-flex justify-content-center py-5"
            role="status"
            aria-label="Loading users"
          >
            <div className="spinner-border" aria-hidden="true" />
            <span className="visually-hidden">Loading…</span>
          </div>
        ) : users.length === 0 ? (
          <p className="text-muted text-center py-5">
            {Object.keys(appliedFilters).length > 0
              ? "No users match your filters."
              : "No users found."}
          </p>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Last Login</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td>
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none fw-semibold"
                          onClick={() => openView(u)}
                          aria-label={`View user ${u.firstName} ${u.lastName}`}
                        >
                          {u.firstName} {u.lastName}
                        </button>
                      </td>
                      <td className="text-muted small">{u.email}</td>
                      <td>
                        <span
                          className={`badge bg-${ROLE_BADGE[u.role] ?? "secondary"}`}
                        >
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>
                      <td>
                        {u.isActive ? (
                          <span className="badge bg-success">Active</span>
                        ) : (
                          <span className="badge bg-secondary">Inactive</span>
                        )}
                      </td>
                      <td className="text-muted small">
                        {formatDate(u.lastLogin)}
                      </td>
                      <td>
                        <div className="d-flex gap-1 justify-content-end">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => openEdit(u)}
                            aria-label={`Edit user ${u.firstName} ${u.lastName}`}
                          >
                            Edit
                          </button>
                          {u._id !== currentUser?._id && (
                            <button
                              type="button"
                              className={`btn btn-sm ${u.isActive ? "btn-outline-secondary" : "btn-outline-success"}`}
                              onClick={() => handleToggleStatus(u)}
                              disabled={togglingId === u._id}
                              aria-busy={togglingId === u._id}
                              aria-label={
                                u.isActive
                                  ? `Deactivate user ${u.firstName} ${u.lastName}`
                                  : `Activate user ${u.firstName} ${u.lastName}`
                              }
                            >
                              {togglingId === u._id ? (
                                <>
                                  <span
                                    className="spinner-border spinner-border-sm me-1"
                                    aria-hidden="true"
                                  />
                                  <span className="visually-hidden">
                                    Updating…
                                  </span>
                                </>
                              ) : u.isActive ? (
                                "Deactivate"
                              ) : (
                                "Activate"
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav
                aria-label="User list pagination"
                className="d-flex justify-content-between align-items-center mt-3"
              >
                <p className="text-muted small mb-0">
                  Showing {(page - 1) * LIMIT + 1}–
                  {Math.min(page * LIMIT, total)} of {total}
                </p>
                <ul className="pagination pagination-sm mb-0">
                  <li className={`page-item${page <= 1 ? " disabled" : ""}`}>
                    <button
                      className="page-link"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                      aria-label="Previous page"
                    >
                      ‹
                    </button>
                  </li>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const pg =
                      totalPages <= 7
                        ? i + 1
                        : page <= 4
                          ? i + 1
                          : page >= totalPages - 3
                            ? totalPages - 6 + i
                            : page - 3 + i;
                    return (
                      <li
                        key={pg}
                        className={`page-item${pg === page ? " active" : ""}`}
                      >
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(pg)}
                          aria-label={`Page ${pg}`}
                          aria-current={pg === page ? "page" : undefined}
                        >
                          {pg}
                        </button>
                      </li>
                    );
                  })}
                  <li
                    className={`page-item${page >= totalPages ? " disabled" : ""}`}
                  >
                    <button
                      className="page-link"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages}
                      aria-label="Next page"
                    >
                      ›
                    </button>
                  </li>
                </ul>
              </nav>
            )}
          </>
        )}
      </section>

      {/* ── View drawer ── */}
      <OffcanvasDrawer
        open={viewOpen}
        title={viewUser ? `${viewUser.firstName} ${viewUser.lastName}` : "User"}
        onClose={closeView}
      >
        {viewUser && (
          <>
            {/* Admin actions */}
            <div className="d-flex gap-2 mb-3">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => openEdit(viewUser)}
              >
                Edit Role
              </button>
              {viewUser._id !== currentUser?._id && (
                <button
                  type="button"
                  className={`btn btn-sm ${viewUser.isActive ? "btn-outline-secondary" : "btn-outline-success"}`}
                  onClick={() => {
                    handleToggleStatus(viewUser);
                    closeView();
                  }}
                  aria-label={
                    viewUser.isActive
                      ? `Deactivate ${viewUser.firstName}`
                      : `Activate ${viewUser.firstName}`
                  }
                >
                  {viewUser.isActive ? "Deactivate" : "Activate"}
                </button>
              )}
            </div>

            <dl className="row small">
              <dt className="col-sm-4">Name</dt>
              <dd className="col-sm-8">
                {viewUser.firstName} {viewUser.lastName}
              </dd>

              <dt className="col-sm-4">Email</dt>
              <dd className="col-sm-8 text-break">{viewUser.email}</dd>

              <dt className="col-sm-4">Role</dt>
              <dd className="col-sm-8">
                <span
                  className={`badge bg-${ROLE_BADGE[viewUser.role] ?? "secondary"}`}
                >
                  {ROLE_LABELS[viewUser.role] ?? viewUser.role}
                </span>
              </dd>

              <dt className="col-sm-4">Status</dt>
              <dd className="col-sm-8">
                {viewUser.isActive ? (
                  <span className="badge bg-success">Active</span>
                ) : (
                  <span className="badge bg-secondary">Inactive</span>
                )}
              </dd>

              <dt className="col-sm-4">Last Login</dt>
              <dd className="col-sm-8">{formatDate(viewUser.lastLogin)}</dd>

              <dt className="col-sm-4">Created</dt>
              <dd className="col-sm-8">{formatDate(viewUser.createdAt)}</dd>
            </dl>
          </>
        )}
      </OffcanvasDrawer>

      {/* ── Edit drawer ── */}
      <OffcanvasDrawer
        open={editOpen}
        title={
          editUser
            ? `Edit ${editUser.firstName} ${editUser.lastName}`
            : "Edit User"
        }
        onClose={closeEdit}
      >
        {editUser && (
          <form
            id="edit-user-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveRole();
            }}
          >
            <div className="mb-3">
              <label className="form-label" htmlFor="editUserRole">
                Role
              </label>
              <select
                id="editUserRole"
                className="form-select"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                required
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={closeEdit}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                aria-busy={saving}
              >
                {saving ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      aria-hidden="true"
                    />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </form>
        )}
      </OffcanvasDrawer>

      {/* ── Invite drawer ── */}
      <OffcanvasDrawer
        open={inviteOpen}
        title="Invite User"
        onClose={closeInvite}
      >
        <p className="text-muted small mb-3">
          Enter the email address of the person you want to invite. They will
          receive a registration link valid for 24 hours.
        </p>
        <form id="invite-user-form" onSubmit={handleSendInvite} noValidate>
          <div className="mb-3">
            <label className="form-label" htmlFor="inviteEmail">
              Email address
            </label>
            <input
              id="inviteEmail"
              type="email"
              className={`form-control${inviteEmailError ? " is-invalid" : ""}`}
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                if (inviteEmailError) setInviteEmailError("");
              }}
              autoComplete="email"
              required
              aria-describedby={
                inviteEmailError ? "inviteEmailError" : undefined
              }
            />
            {inviteEmailError && (
              <div
                id="inviteEmailError"
                className="invalid-feedback"
                role="alert"
              >
                {inviteEmailError}
              </div>
            )}
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="inviteRole">
              Role
            </label>
            <select
              id="inviteRole"
              className="form-select"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <option value="sales_rep">Sales Rep</option>
              <option value="sales_manager">Sales Manager</option>
              <option value="executive">Executive</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-4">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={closeInvite}
              disabled={inviting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={inviting}
              aria-busy={inviting}
            >
              {inviting ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                  />
                  Sending…
                </>
              ) : (
                "Send Invitation"
              )}
            </button>
          </div>
        </form>
      </OffcanvasDrawer>
    </div>
  );
}
