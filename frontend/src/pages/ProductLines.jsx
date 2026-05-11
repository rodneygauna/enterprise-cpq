import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import RequireRole from "../components/RequireRole";
import {
  getProductLines,
  createProductLine,
  updateProductLine,
  deleteProductLine,
  reorderProductLine,
} from "../api/productLines";

const ADMIN_ROLES = ["admin", "super_admin"];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function validateForm(values) {
  const errors = {};
  if (!values.name.trim()) errors.name = "Name is required.";
  if (values.displayColor && !HEX_RE.test(values.displayColor)) {
    errors.displayColor = "Must be a valid 6-digit hex color (e.g. #0d6efd).";
  }
  return errors;
}

export default function ProductLines() {
  return (
    <RequireRole roles={ADMIN_ROLES}>
      <ProductLinesPanel />
    </RequireRole>
  );
}

function ProductLinesPanel() {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state — shared between "add" and "edit" modes
  const [editingId, setEditingId] = useState(null); // null = add mode
  const [form, setForm] = useState({ name: "", displayColor: "" });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Confirm-delete state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getProductLines()
      .then(setLines)
      .catch(() => toast.error("Failed to load product lines."))
      .finally(() => setLoading(false));
  }, []);

  // ── Form helpers ────────────────────────────────────────────────────────────

  function resetForm() {
    setEditingId(null);
    setForm({ name: "", displayColor: "" });
    setFormErrors({});
  }

  function startEdit(line) {
    setEditingId(line._id);
    setForm({ name: line.name, displayColor: line.displayColor ?? "" });
    setFormErrors({});
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // ── Submit (add or edit) ────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      displayColor: form.displayColor.trim() || null,
    };

    try {
      if (editingId) {
        const updated = await updateProductLine(editingId, payload);
        setLines((prev) =>
          prev.map((l) => (l._id === editingId ? updated : l)),
        );
        toast.success("Product line updated.");
      } else {
        const created = await createProductLine(payload);
        setLines((prev) => [...prev, created]);
        toast.success("Product line created.");
      }
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.error ?? "Failed to save product line.");
    } finally {
      setSaving(false);
    }
  };

  // ── Reorder ────────────────────────────────────────────────────────────────

  const handleReorder = async (id, direction) => {
    try {
      await reorderProductLine(id, direction);
      // Re-fetch to get accurate sortOrder values
      const refreshed = await getProductLines();
      setLines(refreshed);
    } catch {
      toast.error("Failed to reorder product line.");
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProductLine(deleteTarget._id);
      setLines((prev) => prev.filter((l) => l._id !== deleteTarget._id));
      toast.success("Product line deleted.");
    } catch (err) {
      toast.error(
        err.response?.data?.error ?? "Failed to delete product line.",
      );
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="container py-4" aria-live="polite" aria-busy="true">
        <p>Loading product lines…</p>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <h1 className="h3 mb-1">Product Line Management</h1>
      <p className="text-muted mb-4">
        Create, rename, reorder, and delete product lines. Deletion is blocked
        if products are assigned to the line.
      </p>

      <div className="row g-4">
        {/* ── Left: current lines table ── */}
        <div className="col-lg-7">
          <section aria-labelledby="lines-heading">
            <h2 id="lines-heading" className="h5 mb-3">
              Current Product Lines
            </h2>

            {lines.length === 0 ? (
              <p className="text-muted fst-italic">
                No product lines yet. Add one using the form.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="table table-bordered align-middle">
                  <thead className="table-light">
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">Name</th>
                      <th scope="col">Color</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={line._id}>
                        <td className="text-center" style={{ width: "6rem" }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary me-1"
                            onClick={() => handleReorder(line._id, "up")}
                            disabled={idx === 0}
                            aria-label={`Move ${line.name} up`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handleReorder(line._id, "down")}
                            disabled={idx === lines.length - 1}
                            aria-label={`Move ${line.name} down`}
                          >
                            ↓
                          </button>
                        </td>
                        <td>{line.name}</td>
                        <td>
                          {line.displayColor ? (
                            <span className="d-flex align-items-center gap-2">
                              <span
                                style={{
                                  display: "inline-block",
                                  width: "1.25rem",
                                  height: "1.25rem",
                                  borderRadius: "50%",
                                  backgroundColor: line.displayColor,
                                  border: "1px solid rgba(0,0,0,.2)",
                                }}
                                aria-hidden="true"
                              />
                              <code>{line.displayColor}</code>
                            </span>
                          ) : (
                            <span className="text-muted fst-italic">None</span>
                          )}
                        </td>
                        <td
                          className="text-end"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary me-1"
                            onClick={() => startEdit(line)}
                            aria-label={`Edit ${line.name}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => setDeleteTarget(line)}
                            aria-label={`Delete ${line.name}`}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* ── Right: add / edit form ── */}
        <div className="col-lg-5">
          <section aria-labelledby="form-heading">
            <h2 id="form-heading" className="h5 mb-3">
              {editingId ? "Edit Product Line" : "Add Product Line"}
            </h2>

            <form
              onSubmit={handleSubmit}
              noValidate
              aria-label={editingId ? "Edit product line" : "Add product line"}
            >
              {/* Name */}
              <div className="mb-3">
                <label htmlFor="pl-name" className="form-label">
                  Name{" "}
                  <span className="text-muted fw-normal small">(required)</span>
                </label>
                <input
                  id="pl-name"
                  name="name"
                  type="text"
                  className={`form-control${formErrors.name ? " is-invalid" : ""}`}
                  value={form.name}
                  onChange={handleFormChange}
                  required
                  aria-required="true"
                  aria-describedby={
                    formErrors.name ? "pl-name-error" : undefined
                  }
                  aria-invalid={formErrors.name ? true : undefined}
                  placeholder="e.g. Care Management"
                />
                {formErrors.name && (
                  <div id="pl-name-error" className="invalid-feedback">
                    {formErrors.name}
                  </div>
                )}
              </div>

              {/* Display Color */}
              <div className="mb-3">
                <label htmlFor="pl-color" className="form-label">
                  Display Color{" "}
                  <span className="text-muted fw-normal small">(optional)</span>
                </label>
                <div className="d-flex align-items-center gap-2">
                  <input
                    id="pl-color"
                    name="displayColor"
                    type="color"
                    className="form-control form-control-color"
                    value={form.displayColor || "#0d6efd"}
                    onChange={handleFormChange}
                    title="Choose display color"
                  />
                  <input
                    aria-label="Display color hex value"
                    name="displayColor"
                    type="text"
                    className={`form-control${formErrors.displayColor ? " is-invalid" : ""}`}
                    style={{ maxWidth: "130px" }}
                    value={form.displayColor}
                    onChange={handleFormChange}
                    pattern="^#[0-9a-fA-F]{6}$"
                    placeholder="#0d6efd (optional)"
                    aria-describedby={
                      formErrors.displayColor
                        ? "pl-color-error"
                        : "pl-color-hint"
                    }
                    aria-invalid={formErrors.displayColor ? true : undefined}
                  />
                </div>
                {formErrors.displayColor ? (
                  <div id="pl-color-error" className="invalid-feedback d-block">
                    {formErrors.displayColor}
                  </div>
                ) : (
                  <div id="pl-color-hint" className="form-text">
                    Used for badges in the quote builder. Leave blank for no
                    color.
                  </div>
                )}
              </div>

              <div className="d-flex gap-2">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? editingId
                      ? "Saving…"
                      : "Adding…"
                    : editingId
                      ? "Save Changes"
                      : "Add Product Line"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={resetForm}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      </div>

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div
          className="modal d-block"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          style={{ backgroundColor: "rgba(0,0,0,.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title h5" id="delete-modal-title">
                  Delete Product Line
                </h3>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setDeleteTarget(null)}
                  aria-label="Close dialog"
                  disabled={deleting}
                />
              </div>
              <div className="modal-body">
                <p>
                  Are you sure you want to delete{" "}
                  <strong>{deleteTarget.name}</strong>? This action cannot be
                  undone.
                </p>
                <p className="text-muted small mb-0">
                  Deletion will fail if products are currently assigned to this
                  line.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={confirmDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
