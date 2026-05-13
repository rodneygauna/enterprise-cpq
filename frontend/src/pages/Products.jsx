import { useState, useEffect, useRef, useCallback } from "react";
import OffcanvasDrawer from "../components/OffcanvasDrawer";
import ProductForm from "../components/ProductForm";
import ProductDetail from "../components/ProductDetail";
import ProductLineBadge from "../components/ProductLineBadge";
import { toast } from "react-toastify";
import { useAuth } from "../hooks/useAuth";
import RequireRole from "../components/RequireRole";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  exportCatalog,
  importCatalog,
  resetCatalog,
} from "../api/products";
import { getProductLines } from "../api/productLines";

// ─── Constants (module scope — required for esbuild) ─────────────────────────
const ADMIN_ROLES = ["admin", "super_admin"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  name: "",
  sku: "",
  productLineId: "",
  type: "Core",
  pricingModel: "PMPM",
  pricingStrategy: "Standard",
  billingType: "Recurring (Monthly)",
  scopeBasedPricing: "None",
  basePrice: "",
  unitCost: "",
  implementationFee: "",
  overagePrice: "",
  isBaselineProduct: false,
  isQuantityBased: false,
  inheritTierVolumesFromCore: false,
  tiers: [],
  volumeBands: [],
  compatibleCoreIds: [],
  recommendedProductIds: [],
  description: "",
};

function productToForm(p) {
  return {
    name: p.name ?? "",
    sku: p.sku ?? "",
    productLineId: p.productLineId?._id ?? p.productLineId ?? "",
    type: p.type ?? "Core",
    pricingModel: p.pricingModel ?? "PMPM",
    pricingStrategy: p.pricingStrategy ?? "Standard",
    billingType: p.billingType ?? "Recurring (Monthly)",
    scopeBasedPricing: p.scopeBasedPricing ?? "None",
    basePrice: p.basePrice != null ? String(p.basePrice) : "",
    unitCost: p.unitCost != null ? String(p.unitCost) : "",
    implementationFee:
      p.implementationFee != null ? String(p.implementationFee) : "",
    overagePrice: p.overagePrice != null ? String(p.overagePrice) : "",
    isBaselineProduct: p.isBaselineProduct ?? false,
    isQuantityBased: p.isQuantityBased ?? false,
    inheritTierVolumesFromCore: p.inheritTierVolumesFromCore ?? false,
    tiers: p.tiers
      ? p.tiers.map((t) => ({ min: String(t.min), price: String(t.price) }))
      : [],
    volumeBands: p.volumeBands
      ? p.volumeBands.map((b) => ({
          label: b.label ?? "",
          maxMembers: b.maxMembers != null ? String(b.maxMembers) : "",
          price: String(b.price),
          implPrice: String(b.implPrice ?? 0),
        }))
      : [],
    compatibleCoreIds: p.compatibleCoreIds
      ? p.compatibleCoreIds.map((x) => x._id ?? x)
      : [],
    recommendedProductIds: p.recommendedProductIds
      ? p.recommendedProductIds.map((x) => x._id ?? x)
      : [],
    description: p.description ?? "",
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function Products() {
  return (
    <RequireRole roles={ADMIN_ROLES}>
      <ProductsPanel />
    </RequireRole>
  );
}

// ─── Inner panel (always admin/super_admin) ───────────────────────────────────
function ProductsPanel() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = ADMIN_ROLES.includes(user?.role);

  // ── Data state ───────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [productLines, setProductLines] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Filter state ─────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterLineId, setFilterLineId] = useState("");

  // ── Drawer state ─────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);

  // ── View drawer state ────────────────────────────────────────────────────
  const [viewProduct, setViewProduct] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);

  // ── Delete modal state ───────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ── Reset modal state ────────────────────────────────────────────────────
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  // ── Import state ─────────────────────────────────────────────────────────
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef(null);

  // ── Load data ────────────────────────────────────────────────────────────
  const loadProducts = useCallback(() => {
    const params = {};
    if (filterLineId) params.productLineId = filterLineId;
    if (search.trim()) params.search = search.trim();
    return getProducts(params)
      .then(setProducts)
      .catch(() => toast.error("Failed to load products."));
  }, [filterLineId, search]);

  useEffect(() => {
    Promise.all([getProductLines(), loadProducts()])
      .then(([lines]) => setProductLines(lines))
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload products when filter/search changes (after initial load)
  useEffect(() => {
    if (!loading) {
      loadProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLineId, search]);

  // ── Drawer helpers ───────────────────────────────────────────────────────
  function openAddDrawer() {
    setEditingProduct(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(product) {
    setEditingProduct(product);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  function openViewDrawer(product) {
    setViewProduct(product);
    setViewOpen(true);
  }

  function closeViewDrawer() {
    setViewOpen(false);
  }

  // ── Form submit (receives validated payload from ProductForm) ────────────
  async function handleFormSubmit(payload) {
    setSaving(true);
    try {
      if (editingProduct) {
        const updated = await updateProduct(editingProduct._id, payload);
        setProducts((prev) =>
          prev.map((p) => (p._id === editingProduct._id ? updated : p)),
        );
        toast.success("Product updated.");
      } else {
        const created = await createProduct(payload);
        setProducts((prev) => [...prev, created]);
        toast.success("Product created.");
      }
      closeDrawer();
    } catch (err) {
      const msg = err.response?.data?.error ?? "Failed to save product.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  // ── Duplicate ────────────────────────────────────────────────────────────
  async function handleDuplicate(product) {
    try {
      const copy = await duplicateProduct(product._id);
      setProducts((prev) => [...prev, copy]);
      toast.success(`Duplicated as "${copy.name}".`);
    } catch {
      toast.error("Failed to duplicate product.");
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProduct(deleteTarget._id);
      setProducts((prev) => prev.filter((p) => p._id !== deleteTarget._id));
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete product.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Export ───────────────────────────────────────────────────────────────
  async function handleExport() {
    try {
      const res = await exportCatalog();
      downloadBlob(res.data, `product-catalog-${Date.now()}.xlsx`);
      toast.success("Catalog exported.");
    } catch {
      toast.error("Export failed.");
    }
  }

  // ── Import ───────────────────────────────────────────────────────────────
  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const res = await importCatalog(file);
      const { inserted, updated, errors } = res.data.data;
      toast.success(
        `Import complete: ${inserted} inserted, ${updated} updated, ${errors.length} errors.`,
      );
      if (errors.length > 0) {
        errors.forEach((err) => toast.warn(err));
      }
      await loadProducts();
    } catch {
      toast.error("Import failed.");
    } finally {
      setImporting(false);
      // Reset file input so same file can be re-imported
      if (importFileRef.current) importFileRef.current.value = "";
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────────
  async function handleConfirmReset() {
    setResetting(true);
    try {
      await resetCatalog();
      toast.success("Product catalog reset to seed data.");
      setShowResetModal(false);
      await loadProducts();
    } catch {
      toast.error("Reset failed.");
    } finally {
      setResetting(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h1 className="h3 mb-0">Product Catalog</h1>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={openAddDrawer}>
            <i className="bi bi-plus-lg me-2" aria-hidden="true" />
            Add Product
          </button>
        )}
      </div>

      {/* ── Toolbar ── */}
      <div className="row g-2 mb-3 align-items-end">
        <div className="col-12 col-md-4">
          <label
            htmlFor="products-search"
            className="form-label visually-hidden"
          >
            Search products
          </label>
          <input
            id="products-search"
            type="search"
            className="form-control form-control-sm"
            placeholder="Search by name or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search products by name or SKU"
          />
        </div>
        <div className="col-12 col-md-3">
          <label
            htmlFor="products-line-filter"
            className="form-label visually-hidden"
          >
            Filter by product line
          </label>
          <select
            id="products-line-filter"
            className="form-select form-select-sm"
            value={filterLineId}
            onChange={(e) => setFilterLineId(e.target.value)}
            aria-label="Filter by product line"
          >
            <option value="">All Product Lines</option>
            {productLines.map((line) => (
              <option key={line._id} value={line._id}>
                {line.name}
              </option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <div className="col-auto ms-auto d-flex gap-2 flex-wrap">
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={handleExport}
            >
              <i className="bi bi-download me-2" aria-hidden="true" />
              Export XLSX
            </button>
            <label
              className={`btn btn-outline-secondary btn-sm mb-0${importing ? " disabled" : ""}`}
              htmlFor="import-file-input"
              aria-label="Import products from Excel"
            >
              {importing ? (
                "Importing…"
              ) : (
                <>
                  <i className="bi bi-upload me-2" aria-hidden="true" />
                  Import XLSX
                </>
              )}
              <input
                id="import-file-input"
                type="file"
                accept=".xlsx"
                className="visually-hidden"
                ref={importFileRef}
                onChange={handleImport}
                disabled={importing}
              />
            </label>
            {isSuperAdmin && (
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={() => setShowResetModal(true)}
                aria-label="Reset catalog to seed data"
              >
                <i className="bi bi-arrow-clockwise me-2" aria-hidden="true" />
                Reset Catalog
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div>
        {loading ? (
          <div className="text-center py-5" aria-live="polite" aria-busy="true">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading products…</span>
            </div>
          </div>
        ) : products.length === 0 ? (
          <p className="text-muted">
            No products found.{" "}
            {isAdmin && (
              <button className="btn btn-link p-0" onClick={openAddDrawer}>
                Add the first product.
              </button>
            )}
          </p>
        ) : (
          <div className="table-responsive">
            <table
              className="table table-hover table-sm align-middle"
              aria-label="Product catalog"
            >
              <thead className="table-light">
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">SKU</th>
                  <th scope="col">Product Line</th>
                  <th scope="col">Type</th>
                  <th scope="col">Pricing Model</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product._id}>
                    <td>
                      <button
                        className="btn btn-link p-0 text-start fw-semibold"
                        onClick={() => openViewDrawer(product)}
                        aria-label={`View details for ${product.name}`}
                      >
                        {product.name}
                      </button>
                    </td>
                    <td className="text-muted font-monospace small">
                      {product.sku ?? "—"}
                    </td>
                    <td>
                      <ProductLineBadge line={product.productLineId} />
                    </td>
                    <td>{product.type}</td>
                    <td>{product.pricingModel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Drawer ── */}
      <OffcanvasDrawer
        open={drawerOpen}
        title={editingProduct ? "Edit Product" : "Add Product"}
        onClose={closeDrawer}
        width="min(700px, 95vw)"
      >
        <ProductForm
          initialValues={
            editingProduct ? productToForm(editingProduct) : EMPTY_FORM
          }
          productLines={productLines}
          allProducts={products}
          editingId={editingProduct?._id ?? null}
          onSubmit={handleFormSubmit}
          onCancel={closeDrawer}
          saving={saving}
        />
      </OffcanvasDrawer>

      {/* ── View Drawer ── */}
      <OffcanvasDrawer
        open={viewOpen}
        title={viewProduct?.name ?? ""}
        onClose={closeViewDrawer}
        width="min(700px, 95vw)"
      >
        {viewProduct && (
          <>
            {isAdmin && (
              <div className="d-flex gap-2 mb-4">
                <button
                  className="btn btn-primary btn-sm"
                  aria-label={`Edit ${viewProduct.name}`}
                  onClick={() => {
                    closeViewDrawer();
                    openEditDrawer(viewProduct);
                  }}
                >
                  <i className="bi bi-pencil me-2" aria-hidden="true" />
                  Edit
                </button>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  aria-label={`Duplicate ${viewProduct.name}`}
                  onClick={() => {
                    closeViewDrawer();
                    handleDuplicate(viewProduct);
                  }}
                >
                  <i className="bi bi-copy me-2" aria-hidden="true" />
                  Duplicate
                </button>
                <button
                  className="btn btn-outline-danger btn-sm"
                  aria-label={`Delete ${viewProduct.name}`}
                  onClick={() => {
                    closeViewDrawer();
                    setDeleteTarget(viewProduct);
                  }}
                >
                  <i className="bi bi-trash3 me-2" aria-hidden="true" />
                  Delete
                </button>
              </div>
            )}

            <ProductDetail product={viewProduct} allProducts={products} />
          </>
        )}
      </OffcanvasDrawer>

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div
          className="modal d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          style={{ backgroundColor: "rgba(0,0,0,.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title h5" id="delete-modal-title">
                  Confirm Delete
                </h2>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close confirm delete dialog"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                />
              </div>
              <div className="modal-body">
                <p>
                  Are you sure you want to delete{" "}
                  <strong>{deleteTarget.name}</strong>? This action cannot be
                  undone.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  <i className="bi bi-x-lg me-2" aria-hidden="true" />
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  aria-busy={deleting}
                >
                  {deleting ? (
                    "Deleting…"
                  ) : (
                    <>
                      <i className="bi bi-trash3 me-2" aria-hidden="true" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset confirmation modal ── */}
      {showResetModal && (
        <div
          className="modal d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          style={{ backgroundColor: "rgba(0,0,0,.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title h5" id="reset-modal-title">
                  Reset Product Catalog
                </h2>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close reset dialog"
                  onClick={() => setShowResetModal(false)}
                  disabled={resetting}
                />
              </div>
              <div className="modal-body">
                <p>
                  This will <strong>permanently delete</strong> all products and
                  restore the default seed catalog. This action cannot be
                  undone.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowResetModal(false)}
                  disabled={resetting}
                >
                  <i className="bi bi-x-lg me-2" aria-hidden="true" />
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmReset}
                  disabled={resetting}
                  aria-busy={resetting}
                >
                  {resetting ? (
                    "Resetting…"
                  ) : (
                    <>
                      <i
                        className="bi bi-arrow-clockwise me-2"
                        aria-hidden="true"
                      />
                      Reset Catalog
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
