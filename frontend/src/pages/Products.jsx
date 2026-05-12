import { useState, useEffect, useRef, useCallback } from "react";
import OffcanvasDrawer from "../components/OffcanvasDrawer";
import FieldHelp from "../components/FieldHelp";
import { TOOLTIPS } from "../utils/tooltips";
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

const PRODUCT_TYPES = ["Core", "Child", "Add-on"];
const PRICING_MODELS = [
  "PMPM",
  "Flat Fee",
  "Monthly Fee",
  "Per Unit / Transaction",
  "Per User / License",
  "Hourly Rate",
];
const PRICING_STRATEGIES = ["Standard", "Tiered", "Volume Bands"];
const BILLING_TYPES = [
  "One-Time",
  "Recurring (Monthly)",
  "Usage / Transactional",
  "Time & Materials",
];
const SCOPE_BASED_PRICING = ["None", "All", "Implementation Only"];

// ─── Validation (module scope) ────────────────────────────────────────────────
function validateProduct(values) {
  const errors = {};
  if (!values.name || !values.name.trim()) errors.name = "Name is required.";
  if (values.sku && values.sku.trim().length > 100)
    errors.sku = "SKU must be 100 characters or fewer.";
  if (values.basePrice !== "" && isNaN(Number(values.basePrice)))
    errors.basePrice = "Base price must be a number.";
  if (values.unitCost !== "" && isNaN(Number(values.unitCost)))
    errors.unitCost = "Unit cost must be a number.";
  if (
    values.implementationFee !== "" &&
    isNaN(Number(values.implementationFee))
  )
    errors.implementationFee = "Implementation fee must be a number.";
  if (values.overagePrice !== "" && isNaN(Number(values.overagePrice)))
    errors.overagePrice = "Overage price must be a number.";
  return errors;
}

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

function formToPayload(form) {
  const payload = {
    ...form,
    sku: form.sku.trim() || null,
    productLineId: form.productLineId || null,
    basePrice: form.basePrice !== "" ? Number(form.basePrice) : undefined,
    unitCost: form.unitCost !== "" ? Number(form.unitCost) : undefined,
    implementationFee:
      form.implementationFee !== ""
        ? Number(form.implementationFee)
        : undefined,
    overagePrice:
      form.overagePrice !== "" ? Number(form.overagePrice) : undefined,
  };
  return payload;
}

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

function ProductLineBadge({ line }) {
  if (!line) return <span className="text-muted">—</span>;
  const name = line.name ?? line;
  const color = line.displayColor ?? "#6c757d";
  return (
    <span
      className="badge"
      style={{ backgroundColor: color, color: "#fff" }}
      aria-label={`Product Line: ${name}`}
    >
      {name}
    </span>
  );
}

// ─── Tiers Editor ─────────────────────────────────────────────────────────────
function TiersEditor({ tiers, onChange }) {
  const addTier = () => onChange([...tiers, { min: "", price: "" }]);

  const removeTier = (i) => {
    const next = [...tiers];
    next.splice(i, 1);
    onChange(next);
  };

  const updateTier = (i, field, val) => {
    const next = [...tiers];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <fieldset className="mb-2">
      <legend className="fs-6 fw-semibold mb-1">
        Tiers <FieldHelp text={TOOLTIPS.products.tiers} />
      </legend>
      {tiers.length === 0 && (
        <p className="text-muted small">No tiers defined. Add one below.</p>
      )}
      {tiers.map((tier, i) => (
        <div key={i} className="d-flex gap-2 mb-1 align-items-center">
          <label className="visually-hidden" htmlFor={`tier-min-${i}`}>
            Tier {i + 1} minimum
          </label>
          <input
            id={`tier-min-${i}`}
            type="number"
            min="0"
            className="form-control form-control-sm"
            placeholder="Min"
            value={tier.min}
            onChange={(e) => updateTier(i, "min", e.target.value)}
            aria-label={`Tier ${i + 1} minimum`}
          />
          <label className="visually-hidden" htmlFor={`tier-price-${i}`}>
            Tier {i + 1} price
          </label>
          <input
            id={`tier-price-${i}`}
            type="number"
            min="0"
            className="form-control form-control-sm"
            placeholder="Price"
            value={tier.price}
            onChange={(e) => updateTier(i, "price", e.target.value)}
            aria-label={`Tier ${i + 1} price`}
          />
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={() => removeTier(i)}
            aria-label={`Remove tier ${i + 1}`}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm mt-1"
        onClick={addTier}
      >
        <i className="bi bi-plus me-1" aria-hidden="true" />
        Add Tier
      </button>
    </fieldset>
  );
}

// ─── Volume Bands Editor ──────────────────────────────────────────────────────
function VolumeBandsEditor({ bands, onChange }) {
  const addBand = () =>
    onChange([
      ...bands,
      { label: "", maxMembers: "", price: "", implPrice: "" },
    ]);

  const removeBand = (i) => {
    const next = [...bands];
    next.splice(i, 1);
    onChange(next);
  };

  const updateBand = (i, field, val) => {
    const next = [...bands];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <fieldset className="mb-2">
      <legend className="fs-6 fw-semibold mb-1">
        Volume Bands <FieldHelp text={TOOLTIPS.products.volumeBands} />
      </legend>
      {bands.length === 0 && (
        <p className="text-muted small">No bands defined. Add one below.</p>
      )}
      {bands.map((band, i) => (
        <div key={i} className="border rounded p-2 mb-2">
          <div className="row g-1 mb-1">
            <div className="col-6">
              <label
                className="form-label small mb-0"
                htmlFor={`band-label-${i}`}
              >
                Label
              </label>
              <input
                id={`band-label-${i}`}
                type="text"
                className="form-control form-control-sm"
                placeholder="Label"
                value={band.label}
                onChange={(e) => updateBand(i, "label", e.target.value)}
              />
            </div>
            <div className="col-6">
              <label
                className="form-label small mb-0"
                htmlFor={`band-max-${i}`}
              >
                Max Members
              </label>
              <input
                id={`band-max-${i}`}
                type="number"
                min="0"
                className="form-control form-control-sm"
                placeholder="Leave blank for unlimited"
                value={band.maxMembers}
                onChange={(e) => updateBand(i, "maxMembers", e.target.value)}
              />
            </div>
          </div>
          <div className="row g-1 align-items-end">
            <div className="col-5">
              <label
                className="form-label small mb-0"
                htmlFor={`band-price-${i}`}
              >
                Price
              </label>
              <input
                id={`band-price-${i}`}
                type="number"
                min="0"
                className="form-control form-control-sm"
                placeholder="Price"
                value={band.price}
                onChange={(e) => updateBand(i, "price", e.target.value)}
              />
            </div>
            <div className="col-5">
              <label
                className="form-label small mb-0"
                htmlFor={`band-impl-${i}`}
              >
                Impl. Price
              </label>
              <input
                id={`band-impl-${i}`}
                type="number"
                min="0"
                className="form-control form-control-sm"
                placeholder="Impl. Price"
                value={band.implPrice}
                onChange={(e) => updateBand(i, "implPrice", e.target.value)}
              />
            </div>
            <div className="col-2 d-flex align-items-end">
              <button
                type="button"
                className="btn btn-outline-danger btn-sm w-100"
                onClick={() => removeBand(i)}
                aria-label={`Remove band ${i + 1}`}
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm mt-1"
        onClick={addBand}
      >
        <i className="bi bi-plus me-1" aria-hidden="true" />
        Add Band
      </button>
    </fieldset>
  );
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
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
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
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormErrors({});
    setDrawerOpen(true);
  }

  function openEditDrawer(product) {
    setEditingId(product._id);
    setForm(productToForm(product));
    setFormErrors({});
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setFormErrors({});
  }

  function openViewDrawer(product) {
    setViewProduct(product);
    setViewOpen(true);
  }

  function closeViewDrawer() {
    setViewOpen(false);
  }

  // ── Form change handler ──────────────────────────────────────────────────
  function handleChange(e) {
    const { name, value, type: inputType, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: inputType === "checkbox" ? checked : value,
    }));
    if (formErrors[name])
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  // ── Multi-select helpers ─────────────────────────────────────────────────
  function handleMultiSelect(e, field) {
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
    setForm((prev) => ({ ...prev, [field]: selected }));
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validateProduct(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setSaving(true);
    try {
      const payload = formToPayload(form);
      if (editingId) {
        const updated = await updateProduct(editingId, payload);
        setProducts((prev) =>
          prev.map((p) => (p._id === editingId ? updated : p)),
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

      {/* ── Offcanvas Drawer ── */}
      <OffcanvasDrawer
        open={drawerOpen}
        title={editingId ? "Edit Product" : "Add Product"}
        onClose={closeDrawer}
      >
        <form onSubmit={handleSubmit} noValidate aria-label="Product form">
          {/* Name */}
          <div className="mb-3">
            <label htmlFor="p-name" className="form-label">
              Name <span aria-hidden="true">(required)</span>
            </label>
            <input
              id="p-name"
              name="name"
              type="text"
              className={`form-control${formErrors.name ? " is-invalid" : ""}`}
              value={form.name}
              onChange={handleChange}
              required
              aria-required="true"
              aria-describedby={formErrors.name ? "p-name-error" : undefined}
            />
            {formErrors.name && (
              <div id="p-name-error" className="invalid-feedback">
                {formErrors.name}
              </div>
            )}
          </div>

          {/* SKU */}
          <div className="mb-3">
            <label htmlFor="p-sku" className="form-label">
              SKU
            </label>
            <FieldHelp text={TOOLTIPS.products.sku} />
            <input
              id="p-sku"
              name="sku"
              type="text"
              className={`form-control${formErrors.sku ? " is-invalid" : ""}`}
              value={form.sku}
              onChange={handleChange}
              aria-describedby={formErrors.sku ? "p-sku-error" : undefined}
            />
            {formErrors.sku && (
              <div id="p-sku-error" className="invalid-feedback">
                {formErrors.sku}
              </div>
            )}
          </div>

          {/* Product Line */}
          <div className="mb-3">
            <label htmlFor="p-product-line" className="form-label">
              Product Line
            </label>
            <FieldHelp text={TOOLTIPS.products.productLineId} />
            <select
              id="p-product-line"
              name="productLineId"
              className="form-select"
              value={form.productLineId}
              onChange={handleChange}
            >
              <option value="">— None —</option>
              {productLines.map((line) => (
                <option key={line._id} value={line._id}>
                  {line.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div className="mb-3">
            <label htmlFor="p-type" className="form-label">
              Type
            </label>
            <FieldHelp text={TOOLTIPS.products.type} />
            <select
              id="p-type"
              name="type"
              className="form-select"
              value={form.type}
              onChange={handleChange}
            >
              {PRODUCT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Pricing Model */}
          <div className="mb-3">
            <label htmlFor="p-pricing-model" className="form-label">
              Pricing Model
            </label>
            <FieldHelp text={TOOLTIPS.products.pricingModel} />
            <select
              id="p-pricing-model"
              name="pricingModel"
              className="form-select"
              value={form.pricingModel}
              onChange={handleChange}
            >
              {PRICING_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Pricing Strategy */}
          <div className="mb-3">
            <label htmlFor="p-pricing-strategy" className="form-label">
              Pricing Strategy
            </label>
            <FieldHelp text={TOOLTIPS.products.pricingStrategy} />
            <select
              id="p-pricing-strategy"
              name="pricingStrategy"
              className="form-select"
              value={form.pricingStrategy}
              onChange={handleChange}
            >
              {PRICING_STRATEGIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Billing Type */}
          <div className="mb-3">
            <label htmlFor="p-billing-type" className="form-label">
              Billing Type
            </label>
            <FieldHelp text={TOOLTIPS.products.billingType} />
            <select
              id="p-billing-type"
              name="billingType"
              className="form-select"
              value={form.billingType}
              onChange={handleChange}
            >
              {BILLING_TYPES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Scope-Based Pricing */}
          <div className="mb-3">
            <label htmlFor="p-scope" className="form-label">
              Scope-Based Pricing
            </label>
            <FieldHelp text={TOOLTIPS.products.scopeBasedPricing} />
            <select
              id="p-scope"
              name="scopeBasedPricing"
              className="form-select"
              value={form.scopeBasedPricing}
              onChange={handleChange}
            >
              {SCOPE_BASED_PRICING.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Base Price */}
          <div className="mb-3">
            <label htmlFor="p-base-price" className="form-label">
              Base Price
            </label>
            <FieldHelp text={TOOLTIPS.products.basePrice} />
            <input
              id="p-base-price"
              name="basePrice"
              type="number"
              min="0"
              step="0.01"
              className={`form-control${formErrors.basePrice ? " is-invalid" : ""}`}
              value={form.basePrice}
              onChange={handleChange}
              aria-describedby={
                formErrors.basePrice ? "p-base-price-error" : undefined
              }
            />
            {formErrors.basePrice && (
              <div id="p-base-price-error" className="invalid-feedback">
                {formErrors.basePrice}
              </div>
            )}
          </div>

          {/* Unit Cost */}
          <div className="mb-3">
            <label htmlFor="p-unit-cost" className="form-label">
              Unit Cost
            </label>
            <FieldHelp text={TOOLTIPS.products.unitCost} />
            <input
              id="p-unit-cost"
              name="unitCost"
              type="number"
              min="0"
              step="0.01"
              className={`form-control${formErrors.unitCost ? " is-invalid" : ""}`}
              value={form.unitCost}
              onChange={handleChange}
            />
            {formErrors.unitCost && (
              <div className="invalid-feedback">{formErrors.unitCost}</div>
            )}
          </div>

          {/* Implementation Fee */}
          <div className="mb-3">
            <label htmlFor="p-impl-fee" className="form-label">
              Implementation Fee
            </label>
            <FieldHelp text={TOOLTIPS.products.implementationFee} />
            <input
              id="p-impl-fee"
              name="implementationFee"
              type="number"
              min="0"
              step="0.01"
              className={`form-control${formErrors.implementationFee ? " is-invalid" : ""}`}
              value={form.implementationFee}
              onChange={handleChange}
            />
            {formErrors.implementationFee && (
              <div className="invalid-feedback">
                {formErrors.implementationFee}
              </div>
            )}
          </div>

          {/* Overage Price */}
          <div className="mb-3">
            <label htmlFor="p-overage" className="form-label">
              Overage Price
            </label>
            <FieldHelp text={TOOLTIPS.products.overagePrice} />
            <input
              id="p-overage"
              name="overagePrice"
              type="number"
              min="0"
              step="0.01"
              className={`form-control${formErrors.overagePrice ? " is-invalid" : ""}`}
              value={form.overagePrice}
              onChange={handleChange}
            />
            {formErrors.overagePrice && (
              <div className="invalid-feedback">{formErrors.overagePrice}</div>
            )}
          </div>

          {/* Boolean flags */}
          <div className="mb-2">
            <div className="form-check">
              <input
                id="p-baseline"
                name="isBaselineProduct"
                type="checkbox"
                className="form-check-input"
                checked={form.isBaselineProduct}
                onChange={handleChange}
              />
              <label htmlFor="p-baseline" className="form-check-label">
                Baseline Product
              </label>
              <FieldHelp text={TOOLTIPS.products.isBaselineProduct} />
            </div>
            <div className="form-check">
              <input
                id="p-qty-based"
                name="isQuantityBased"
                type="checkbox"
                className="form-check-input"
                checked={form.isQuantityBased}
                onChange={handleChange}
              />
              <label htmlFor="p-qty-based" className="form-check-label">
                Quantity Based
              </label>
              <FieldHelp text={TOOLTIPS.products.isQuantityBased} />
            </div>
            <div className="form-check">
              <input
                id="p-inherit-tiers"
                name="inheritTierVolumesFromCore"
                type="checkbox"
                className="form-check-input"
                checked={form.inheritTierVolumesFromCore}
                onChange={handleChange}
              />
              <label htmlFor="p-inherit-tiers" className="form-check-label">
                Inherit Tier/Volumes from Core
              </label>
              <FieldHelp text={TOOLTIPS.products.inheritTierVolumesFromCore} />
            </div>
          </div>

          {/* Tiered pricing editor */}
          {form.pricingStrategy === "Tiered" && (
            <TiersEditor
              tiers={form.tiers}
              onChange={(tiers) => setForm((prev) => ({ ...prev, tiers }))}
            />
          )}

          {/* Volume bands editor */}
          {form.pricingStrategy === "Volume Bands" && (
            <VolumeBandsEditor
              bands={form.volumeBands}
              onChange={(volumeBands) =>
                setForm((prev) => ({ ...prev, volumeBands }))
              }
            />
          )}

          {/* Compatible Core Products */}
          <div className="mb-3">
            <label htmlFor="p-compatible-core" className="form-label">
              Compatible Core Products
            </label>
            <FieldHelp text={TOOLTIPS.products.compatibleCoreIds} />
            <select
              id="p-compatible-core"
              multiple
              className="form-select"
              style={{ minHeight: "80px" }}
              value={form.compatibleCoreIds}
              onChange={(e) => handleMultiSelect(e, "compatibleCoreIds")}
              aria-label="Select compatible core products (hold Ctrl/Cmd to select multiple)"
            >
              {products
                .filter((p) => p.type === "Core" && p._id !== editingId)
                .map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <div className="form-text">Hold Ctrl/Cmd to select multiple.</div>
          </div>

          {/* Recommended Products */}
          <div className="mb-3">
            <label htmlFor="p-recommended" className="form-label">
              Recommended Products
            </label>
            <FieldHelp text={TOOLTIPS.products.recommendedProductIds} />
            <select
              id="p-recommended"
              multiple
              className="form-select"
              style={{ minHeight: "80px" }}
              value={form.recommendedProductIds}
              onChange={(e) => handleMultiSelect(e, "recommendedProductIds")}
              aria-label="Select recommended products (hold Ctrl/Cmd to select multiple)"
            >
              {products
                .filter((p) => p._id !== editingId)
                .map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <div className="form-text">Hold Ctrl/Cmd to select multiple.</div>
          </div>

          {/* Description */}
          <div className="mb-3">
            <label htmlFor="p-description" className="form-label">
              Description
            </label>
            <textarea
              id="p-description"
              name="description"
              className="form-control"
              rows={3}
              value={form.description}
              onChange={handleChange}
            />
          </div>

          <div className="d-flex gap-2 justify-content-end">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeDrawer}
            >
              <i className="bi bi-x-lg me-2" aria-hidden="true" />
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? (
                "Saving…"
              ) : editingId ? (
                <>
                  <i className="bi bi-check-lg me-2" aria-hidden="true" />
                  Save Changes
                </>
              ) : (
                <>
                  <i className="bi bi-check-lg me-2" aria-hidden="true" />
                  Create Product
                </>
              )}
            </button>
          </div>
        </form>
      </OffcanvasDrawer>

      {/* ── View Drawer ── */}
      <OffcanvasDrawer
        open={viewOpen}
        title={viewProduct?.name ?? ""}
        onClose={closeViewDrawer}
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

            <dl className="row mb-0">
              <dt className="col-5">SKU</dt>
              <dd className="col-7 font-monospace">{viewProduct.sku || "—"}</dd>

              <dt className="col-5">Product Line</dt>
              <dd className="col-7">
                <ProductLineBadge line={viewProduct.productLineId} />
              </dd>

              <dt className="col-5">Type</dt>
              <dd className="col-7">{viewProduct.type}</dd>

              <dt className="col-5">Pricing Model</dt>
              <dd className="col-7">{viewProduct.pricingModel}</dd>

              <dt className="col-5">Pricing Strategy</dt>
              <dd className="col-7">{viewProduct.pricingStrategy}</dd>

              <dt className="col-5">Billing Type</dt>
              <dd className="col-7">{viewProduct.billingType}</dd>

              <dt className="col-5">Scope Pricing</dt>
              <dd className="col-7">{viewProduct.scopeBasedPricing}</dd>

              <dt className="col-5">Base Price</dt>
              <dd className="col-7">
                {viewProduct.basePrice != null
                  ? `$${Number(viewProduct.basePrice).toFixed(2)}`
                  : "—"}
              </dd>

              <dt className="col-5">Unit Cost</dt>
              <dd className="col-7">
                {viewProduct.unitCost != null
                  ? `$${Number(viewProduct.unitCost).toFixed(2)}`
                  : "—"}
              </dd>

              <dt className="col-5">Impl. Fee</dt>
              <dd className="col-7">
                {viewProduct.implementationFee != null
                  ? `$${Number(viewProduct.implementationFee).toFixed(2)}`
                  : "—"}
              </dd>

              <dt className="col-5">Overage Price</dt>
              <dd className="col-7">
                {viewProduct.overagePrice != null
                  ? `$${Number(viewProduct.overagePrice).toFixed(2)}`
                  : "—"}
              </dd>

              <dt className="col-5">Baseline Product</dt>
              <dd className="col-7">
                {viewProduct.isBaselineProduct ? "Yes" : "No"}
              </dd>

              <dt className="col-5">Quantity Based</dt>
              <dd className="col-7">
                {viewProduct.isQuantityBased ? "Yes" : "No"}
              </dd>

              <dt className="col-5">Inherit Tier Volumes</dt>
              <dd className="col-7">
                {viewProduct.inheritTierVolumesFromCore ? "Yes" : "No"}
              </dd>

              {viewProduct.tiers && viewProduct.tiers.length > 0 && (
                <>
                  <dt className="col-5">Tiers</dt>
                  <dd className="col-7">
                    <ul className="list-unstyled mb-0 small">
                      {viewProduct.tiers.map((t, i) => (
                        <li key={i}>
                          ≥&nbsp;{t.min}&nbsp;→&nbsp;$
                          {Number(t.price).toFixed(2)}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </>
              )}

              {viewProduct.volumeBands &&
                viewProduct.volumeBands.length > 0 && (
                  <>
                    <dt className="col-5">Volume Bands</dt>
                    <dd className="col-7">
                      <ul className="list-unstyled mb-0 small">
                        {viewProduct.volumeBands.map((b, i) => (
                          <li key={i}>
                            {b.label}: ${Number(b.price).toFixed(2)}
                            {b.implPrice
                              ? ` (impl $${Number(b.implPrice).toFixed(2)})`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </>
                )}

              {viewProduct.description && (
                <>
                  <dt className="col-5">Description</dt>
                  <dd className="col-7">{viewProduct.description}</dd>
                </>
              )}
            </dl>
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
