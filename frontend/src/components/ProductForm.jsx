import { useState } from "react";
import FieldHelp from "./FieldHelp";
import TiersEditor from "./TiersEditor";
import VolumeBandsEditor from "./VolumeBandsEditor";
import { TOOLTIPS } from "../utils/tooltips";
import { previewPrice } from "../utils/pricing";

// ─── Enums ────────────────────────────────────────────────────────────────────
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

// ─── Step metadata ────────────────────────────────────────────────────────────
const STEP_LABELS = [
  "Identity",
  "Pricing Configuration",
  "Pricing Details",
  "Behavior Flags",
  "Relationships",
];

// ─── Validation ───────────────────────────────────────────────────────────────
function validateStep1(form) {
  const errors = {};
  if (!form.name || !form.name.trim()) {
    errors.name = "Product name is required.";
  }
  if (form.sku && form.sku.trim().length > 100) {
    errors.sku = "SKU must be 100 characters or fewer.";
  }
  return errors;
}

function validateStep3(form) {
  const errors = {};
  const priceFields = [
    "basePrice",
    "unitCost",
    "implementationFee",
    "overagePrice",
  ];
  priceFields.forEach((field) => {
    if (form[field] !== "" && form[field] != null && Number(form[field]) < 0) {
      errors[field] = "Price must be 0 or greater.";
    }
  });
  if (form.pricingStrategy === "Tiered" && form.tiers.length === 0) {
    errors.tiers =
      "At least one tier is required when Pricing Strategy is Tiered.";
  }
  if (
    form.pricingStrategy === "Volume Bands" &&
    form.volumeBands.length === 0
  ) {
    errors.volumeBands =
      "At least one volume band is required when Pricing Strategy is Volume Bands.";
  }
  form.volumeBands.forEach((band, i) => {
    if (band.maxMembers !== "" && band.maxMembers != null) {
      const val = Number(band.maxMembers);
      if (!Number.isInteger(val) || val <= 0) {
        errors[`volumeBands_maxMembers_${i}`] =
          "Maximum members must be a positive whole number, or leave blank for unlimited.";
      }
    }
  });
  return errors;
}

// Per-step validator map (index = step number; index 0 unused)
const VALIDATORS = [
  null,
  validateStep1,
  () => ({}),
  validateStep3,
  () => ({}),
  () => ({}),
];

function getFirstErrorStep(errors) {
  const step1Keys = new Set(["name", "sku"]);
  const step3Prefixes = [
    "basePrice",
    "unitCost",
    "implementationFee",
    "overagePrice",
    "tiers",
    "volumeBands",
  ];
  for (const k of Object.keys(errors)) {
    if (step1Keys.has(k)) return 1;
  }
  for (const k of Object.keys(errors)) {
    if (step3Prefixes.some((prefix) => k.startsWith(prefix))) return 3;
  }
  return 1;
}

// ─── Payload transform ────────────────────────────────────────────────────────
function formToPayload(form) {
  return {
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
    tiers: form.tiers.map((t) => ({
      min: Number(t.min),
      price: Number(t.price),
    })),
    volumeBands: form.volumeBands.map((b) => ({
      label: b.label,
      maxMembers:
        b.maxMembers !== "" && b.maxMembers != null
          ? Number(b.maxMembers)
          : null,
      price: Number(b.price),
      implPrice: Number(b.implPrice) || 0,
    })),
  };
}

// ─── Currency formatter ───────────────────────────────────────────────────────
const fmt = (n) =>
  `$${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * ProductForm — 5-step wizard for creating and editing products (FR-PROD-9 — FR-PROD-14).
 *
 * Props:
 *   initialValues {object}   - form state snapshot (string-typed values)
 *   productLines  {Array}    - available product lines for the select
 *   allProducts   {Array}    - all products (for relationship selects)
 *   editingId     {string|null} - _id of product being edited; null = add mode
 *   onSubmit      {function} - called with validated payload object
 *   onCancel      {function} - called when user clicks Cancel
 *   saving        {boolean}  - disables submit button while the parent is saving
 */
export default function ProductForm({
  initialValues,
  productLines,
  allProducts,
  editingId,
  onSubmit,
  onCancel,
  saving,
}) {
  // In edit mode all steps are immediately navigable; in add mode unlock progressively.
  const [step, setStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(editingId ? 5 : 1);
  const [form, setForm] = useState({ ...initialValues });
  const [formErrors, setFormErrors] = useState({});
  const [previewMembershipCount, setPreviewMembershipCount] = useState(1000);
  const [previewTermMonths, setPreviewTermMonths] = useState(12);

  // ── Field helpers ──────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    // Clear the specific field error on change
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleMultiSelect = (e, field) => {
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
    setForm((prev) => ({ ...prev, [field]: selected }));
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleNext = () => {
    const errors = VALIDATORS[step](form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    const next = step + 1;
    setStep(next);
    setMaxStepReached((prev) => Math.max(prev, next));
  };

  const handleBack = () => {
    setFormErrors({});
    setStep((prev) => prev - 1);
  };

  const handleStepNav = (targetStep) => {
    if (targetStep < step || targetStep <= maxStepReached) {
      setFormErrors({});
      setStep(targetStep);
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    // Validate all steps that have rules; merge errors
    const allErrors = { ...validateStep1(form), ...validateStep3(form) };
    if (Object.keys(allErrors).length > 0) {
      setFormErrors(allErrors);
      setStep(getFirstErrorStep(allErrors));
      return;
    }
    onSubmit(formToPayload(form));
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const preview = previewPrice(form, previewMembershipCount, previewTermMonths);
  const coreProducts = allProducts.filter(
    (p) => p.type === "Core" && p._id !== editingId,
  );
  const otherProducts = allProducts.filter((p) => p._id !== editingId);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Product form">
      {/* ── Step progress indicator ── */}
      <nav aria-label="Product form steps" className="mb-4">
        <div className="d-flex gap-1">
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1;
            const isCurrent = step === stepNum;
            const isCompleted = stepNum < step;
            const isNavigable = stepNum === step || stepNum <= maxStepReached;
            return (
              <button
                key={stepNum}
                type="button"
                className={`btn btn-sm flex-fill text-nowrap ${
                  isCurrent
                    ? "btn-primary"
                    : isCompleted
                      ? "btn-outline-success"
                      : "btn-outline-secondary"
                }`}
                onClick={() => handleStepNav(stepNum)}
                disabled={!isNavigable}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Step ${stepNum}: ${label}`}
                title={label}
              >
                {isCompleted ? (
                  <i className="bi bi-check-lg me-1" aria-hidden="true" />
                ) : (
                  `${stepNum}. `
                )}
                <span className="d-none d-md-inline">{label}</span>
                <span className="d-md-none">{stepNum}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ══════════════ STEP 1 — Identity ══════════════ */}
      {step === 1 && (
        <section aria-labelledby="pf-step1-heading">
          <h3
            id="pf-step1-heading"
            className="h6 fw-semibold text-muted text-uppercase mb-3"
          >
            Identity
          </h3>

          {/* Name */}
          <div className="mb-3">
            <label htmlFor="pf-name" className="form-label">
              Name{" "}
              <span className="text-muted fw-normal small" aria-hidden="true">
                (required)
              </span>
            </label>
            <input
              id="pf-name"
              name="name"
              type="text"
              className={`form-control${formErrors.name ? " is-invalid" : ""}`}
              value={form.name}
              onChange={handleChange}
              required
              aria-required="true"
              aria-describedby={formErrors.name ? "pf-name-error" : undefined}
            />
            {formErrors.name && (
              <div id="pf-name-error" className="invalid-feedback" role="alert">
                {formErrors.name}
              </div>
            )}
          </div>

          {/* SKU */}
          <div className="mb-3">
            <label htmlFor="pf-sku" className="form-label">
              SKU <FieldHelp text={TOOLTIPS.products.sku} />
            </label>
            <input
              id="pf-sku"
              name="sku"
              type="text"
              className={`form-control${formErrors.sku ? " is-invalid" : ""}`}
              value={form.sku}
              onChange={handleChange}
              aria-describedby={formErrors.sku ? "pf-sku-error" : undefined}
            />
            {formErrors.sku && (
              <div id="pf-sku-error" className="invalid-feedback" role="alert">
                {formErrors.sku}
              </div>
            )}
          </div>

          {/* Product Line */}
          <div className="mb-3">
            <label htmlFor="pf-product-line" className="form-label">
              Product Line <FieldHelp text={TOOLTIPS.products.productLineId} />
            </label>
            <select
              id="pf-product-line"
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
            <label htmlFor="pf-type" className="form-label">
              Type <FieldHelp text={TOOLTIPS.products.type} />
            </label>
            <select
              id="pf-type"
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

          {/* Description */}
          <div className="mb-3">
            <label htmlFor="pf-description" className="form-label">
              Description
            </label>
            <textarea
              id="pf-description"
              name="description"
              className="form-control"
              rows={3}
              value={form.description}
              onChange={handleChange}
            />
          </div>
        </section>
      )}

      {/* ══════════════ STEP 2 — Pricing Configuration ══════════════ */}
      {step === 2 && (
        <section aria-labelledby="pf-step2-heading">
          <h3
            id="pf-step2-heading"
            className="h6 fw-semibold text-muted text-uppercase mb-3"
          >
            Pricing Configuration
          </h3>

          <div className="mb-3">
            <label htmlFor="pf-pricing-model" className="form-label">
              Pricing Model <FieldHelp text={TOOLTIPS.products.pricingModel} />
            </label>
            <select
              id="pf-pricing-model"
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

          <div className="mb-3">
            <label htmlFor="pf-pricing-strategy" className="form-label">
              Pricing Strategy{" "}
              <FieldHelp text={TOOLTIPS.products.pricingStrategy} />
            </label>
            <select
              id="pf-pricing-strategy"
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

          <div className="mb-3">
            <label htmlFor="pf-billing-type" className="form-label">
              Billing Type <FieldHelp text={TOOLTIPS.products.billingType} />
            </label>
            <select
              id="pf-billing-type"
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

          <div className="mb-3">
            <label htmlFor="pf-scope" className="form-label">
              Scope-Based Pricing{" "}
              <FieldHelp text={TOOLTIPS.products.scopeBasedPricing} />
            </label>
            <select
              id="pf-scope"
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
        </section>
      )}

      {/* ══════════════ STEP 3 — Pricing Details ══════════════ */}
      {step === 3 && (
        <section aria-labelledby="pf-step3-heading">
          <h3
            id="pf-step3-heading"
            className="h6 fw-semibold text-muted text-uppercase mb-3"
          >
            Pricing Details
          </h3>

          {/* Base Price — Standard strategy only */}
          {form.pricingStrategy === "Standard" && (
            <div className="mb-3">
              <label htmlFor="pf-base-price" className="form-label">
                Base Price <FieldHelp text={TOOLTIPS.products.basePrice} />
              </label>
              <div className="input-group">
                <span className="input-group-text" aria-hidden="true">
                  $
                </span>
                <input
                  id="pf-base-price"
                  name="basePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`form-control${formErrors.basePrice ? " is-invalid" : ""}`}
                  value={form.basePrice}
                  onChange={handleChange}
                  aria-describedby={
                    formErrors.basePrice ? "pf-base-price-error" : undefined
                  }
                />
                {formErrors.basePrice && (
                  <div
                    id="pf-base-price-error"
                    className="invalid-feedback"
                    role="alert"
                  >
                    {formErrors.basePrice}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tiers editor — Tiered strategy only */}
          {form.pricingStrategy === "Tiered" && (
            <div className="mb-3">
              <TiersEditor
                tiers={form.tiers}
                onChange={(tiers) => setForm((prev) => ({ ...prev, tiers }))}
                error={formErrors.tiers}
              />
            </div>
          )}

          {/* Volume Bands editor — Volume Bands strategy only */}
          {form.pricingStrategy === "Volume Bands" && (
            <div className="mb-3">
              <VolumeBandsEditor
                bands={form.volumeBands}
                onChange={(volumeBands) =>
                  setForm((prev) => ({ ...prev, volumeBands }))
                }
                error={formErrors.volumeBands}
                bandErrors={formErrors}
              />
            </div>
          )}

          {/* Unit Cost — always */}
          <div className="mb-3">
            <label htmlFor="pf-unit-cost" className="form-label">
              Unit Cost <FieldHelp text={TOOLTIPS.products.unitCost} />
            </label>
            <div className="input-group">
              <span className="input-group-text" aria-hidden="true">
                $
              </span>
              <input
                id="pf-unit-cost"
                name="unitCost"
                type="number"
                min="0"
                step="0.01"
                className={`form-control${formErrors.unitCost ? " is-invalid" : ""}`}
                value={form.unitCost}
                onChange={handleChange}
                aria-describedby={
                  formErrors.unitCost ? "pf-unit-cost-error" : undefined
                }
              />
              {formErrors.unitCost && (
                <div
                  id="pf-unit-cost-error"
                  className="invalid-feedback"
                  role="alert"
                >
                  {formErrors.unitCost}
                </div>
              )}
            </div>
          </div>

          {/* Implementation Fee — always */}
          <div className="mb-3">
            <label htmlFor="pf-impl-fee" className="form-label">
              Implementation Fee{" "}
              <FieldHelp text={TOOLTIPS.products.implementationFee} />
            </label>
            <div className="input-group">
              <span className="input-group-text" aria-hidden="true">
                $
              </span>
              <input
                id="pf-impl-fee"
                name="implementationFee"
                type="number"
                min="0"
                step="0.01"
                className={`form-control${formErrors.implementationFee ? " is-invalid" : ""}`}
                value={form.implementationFee}
                onChange={handleChange}
                aria-describedby={
                  formErrors.implementationFee ? "pf-impl-fee-error" : undefined
                }
              />
              {formErrors.implementationFee && (
                <div
                  id="pf-impl-fee-error"
                  className="invalid-feedback"
                  role="alert"
                >
                  {formErrors.implementationFee}
                </div>
              )}
            </div>
          </div>

          {/* Overage Price — Per Unit / Transaction model only */}
          {form.pricingModel === "Per Unit / Transaction" && (
            <div className="mb-3">
              <label htmlFor="pf-overage" className="form-label">
                Overage Price{" "}
                <FieldHelp text={TOOLTIPS.products.overagePrice} />
              </label>
              <div className="input-group">
                <span className="input-group-text" aria-hidden="true">
                  $
                </span>
                <input
                  id="pf-overage"
                  name="overagePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`form-control${formErrors.overagePrice ? " is-invalid" : ""}`}
                  value={form.overagePrice}
                  onChange={handleChange}
                  aria-describedby={
                    formErrors.overagePrice ? "pf-overage-error" : undefined
                  }
                />
                {formErrors.overagePrice && (
                  <div
                    id="pf-overage-error"
                    className="invalid-feedback"
                    role="alert"
                  >
                    {formErrors.overagePrice}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Live price preview ── */}
          <section
            className="border rounded p-3 bg-body-tertiary mt-4"
            aria-live="polite"
            aria-label="Live price preview"
            aria-atomic="true"
          >
            <h4 className="h6 fw-semibold mb-3">
              <i className="bi bi-calculator me-2" aria-hidden="true" />
              Price Preview
            </h4>

            {/* Preview inputs */}
            <div className="row g-2 mb-3">
              <div className="col-6">
                <label
                  htmlFor="pf-preview-members"
                  className="form-label small mb-1"
                >
                  Membership Count
                </label>
                <input
                  id="pf-preview-members"
                  type="number"
                  min="0"
                  className="form-control form-control-sm"
                  value={previewMembershipCount}
                  onChange={(e) =>
                    setPreviewMembershipCount(
                      Math.max(0, Number(e.target.value) || 0),
                    )
                  }
                />
              </div>
              <div className="col-6">
                <label
                  htmlFor="pf-preview-term"
                  className="form-label small mb-1"
                >
                  Term (months)
                </label>
                <input
                  id="pf-preview-term"
                  type="number"
                  min="1"
                  className="form-control form-control-sm"
                  value={previewTermMonths}
                  onChange={(e) =>
                    setPreviewTermMonths(
                      Math.max(1, Number(e.target.value) || 1),
                    )
                  }
                />
              </div>
            </div>

            {/* Preview output */}
            <dl className="row mb-0 small">
              <dt className="col-7">Effective Monthly Price</dt>
              <dd className="col-5 text-end fw-semibold">
                {fmt(preview.monthlyPrice)}
              </dd>
              <dt className="col-7">Annual Total</dt>
              <dd className="col-5 text-end fw-semibold">
                {fmt(preview.annualTotal)}
              </dd>
              {preview.implementationFee > 0 && (
                <>
                  <dt className="col-7">Implementation Fee</dt>
                  <dd className="col-5 text-end fw-semibold">
                    {fmt(preview.implementationFee)}
                  </dd>
                </>
              )}
            </dl>

            {(form.pricingModel === "Per Unit / Transaction" ||
              form.pricingModel === "Hourly Rate") && (
              <p className="text-muted small mt-2 mb-0">
                <i className="bi bi-info-circle me-1" aria-hidden="true" />
                Preview shows $0.00 for this pricing model — final price depends
                on quantity or hours entered at quote time.
              </p>
            )}
          </section>
        </section>
      )}

      {/* ══════════════ STEP 4 — Behavior Flags ══════════════ */}
      {step === 4 && (
        <section aria-labelledby="pf-step4-heading">
          <h3
            id="pf-step4-heading"
            className="h6 fw-semibold text-muted text-uppercase mb-3"
          >
            Behavior Flags
          </h3>

          {/* Quantity Based — always */}
          <div className="form-check mb-3">
            <input
              id="pf-qty-based"
              name="isQuantityBased"
              type="checkbox"
              className="form-check-input"
              checked={form.isQuantityBased}
              onChange={handleChange}
            />
            <label htmlFor="pf-qty-based" className="form-check-label">
              Quantity Based{" "}
              <FieldHelp text={TOOLTIPS.products.isQuantityBased} />
            </label>
          </div>

          {/* Baseline Product — Core type only */}
          {form.type === "Core" && (
            <div className="form-check mb-3">
              <input
                id="pf-baseline"
                name="isBaselineProduct"
                type="checkbox"
                className="form-check-input"
                checked={form.isBaselineProduct}
                onChange={handleChange}
              />
              <label htmlFor="pf-baseline" className="form-check-label">
                Baseline Product{" "}
                <FieldHelp text={TOOLTIPS.products.isBaselineProduct} />
              </label>
            </div>
          )}

          {/* Inherit Tier Volumes From Core — Child type only */}
          {form.type === "Child" && (
            <div className="form-check mb-3">
              <input
                id="pf-inherit-tiers"
                name="inheritTierVolumesFromCore"
                type="checkbox"
                className="form-check-input"
                checked={form.inheritTierVolumesFromCore}
                onChange={handleChange}
              />
              <label htmlFor="pf-inherit-tiers" className="form-check-label">
                Inherit Tier Volumes From Core{" "}
                <FieldHelp
                  text={TOOLTIPS.products.inheritTierVolumesFromCore}
                />
              </label>
            </div>
          )}

          {form.type === "Add-on" && (
            <p className="text-muted small">
              No behavior flags apply to Add-on products.
            </p>
          )}
        </section>
      )}

      {/* ══════════════ STEP 5 — Relationships ══════════════ */}
      {step === 5 && (
        <section aria-labelledby="pf-step5-heading">
          <h3
            id="pf-step5-heading"
            className="h6 fw-semibold text-muted text-uppercase mb-3"
          >
            Relationships
          </h3>

          {/* Compatible Core Products — Child type only */}
          {form.type === "Child" && (
            <div className="mb-4">
              <label htmlFor="pf-compatible-core" className="form-label">
                Compatible Core Products{" "}
                <FieldHelp text={TOOLTIPS.products.compatibleCoreIds} />
              </label>
              <select
                id="pf-compatible-core"
                multiple
                className="form-select"
                style={{ minHeight: "100px" }}
                value={form.compatibleCoreIds}
                onChange={(e) => handleMultiSelect(e, "compatibleCoreIds")}
                aria-label="Select compatible core products — hold Ctrl or Cmd to select multiple"
              >
                {coreProducts.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="form-text">
                Hold Ctrl / Cmd to select multiple.
              </div>
            </div>
          )}

          {/* Recommended Products — always */}
          <div className="mb-3">
            <label htmlFor="pf-recommended" className="form-label">
              Recommended Products{" "}
              <FieldHelp text={TOOLTIPS.products.recommendedProductIds} />
            </label>
            <select
              id="pf-recommended"
              multiple
              className="form-select"
              style={{ minHeight: "100px" }}
              value={form.recommendedProductIds}
              onChange={(e) => handleMultiSelect(e, "recommendedProductIds")}
              aria-label="Select recommended products — hold Ctrl or Cmd to select multiple"
            >
              {otherProducts.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="form-text">Hold Ctrl / Cmd to select multiple.</div>
          </div>
        </section>
      )}

      {/* ── Navigation buttons ── */}
      <div className="d-flex gap-2 justify-content-end mt-4 pt-3 border-top">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          <i className="bi bi-x-lg me-2" aria-hidden="true" />
          Cancel
        </button>

        {step > 1 && (
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={handleBack}
          >
            <i className="bi bi-arrow-left me-2" aria-hidden="true" />
            Back
          </button>
        )}

        {step < 5 ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleNext}
          >
            Next
            <i className="bi bi-arrow-right ms-2" aria-hidden="true" />
          </button>
        ) : (
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
                  role="status"
                  aria-hidden="true"
                />
                Saving…
              </>
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
        )}
      </div>
    </form>
  );
}
