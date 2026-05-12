import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import {
  getSettings,
  updateSettings,
  updateDiscountSettings,
  updateMarginSettings,
} from "../api/settings";
import { getProductLines } from "../api/productLines";
import { useBranding } from "../context/BrandingContext";
import { useAuth } from "../hooks/useAuth";
import RequireRole from "../components/RequireRole";
import FieldHelp from "../components/FieldHelp";
import { TOOLTIPS } from "../utils/tooltips";

function validate(values) {
  const errors = {};
  if (!values.companyName.trim()) {
    errors.companyName = "Company name is required.";
  }
  return errors;
}

/**
 * Company branding settings page — super_admin only.
 *
 * Allows editing:
 *   - Company name
 *   - Company logo (uploaded as Base64, stored in MongoDB)
 */
export default function Settings() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin" || isSuperAdmin;

  if (!isAdmin) {
    return (
      <div className="container-fluid py-4">
        <p className="text-muted">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <h1 className="h3 mb-4">Settings</h1>
      {isSuperAdmin && <SettingsForm />}
      <DiscountSettingsForm />
      <MarginSettingsForm />
    </div>
  );
}

function SettingsForm() {
  const { setBranding } = useBranding();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    companyName: "",
    logoUrl: "",
  });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    getSettings()
      .then((data) => {
        setForm({
          companyName: data.companyName ?? "",
          logoUrl: data.logoUrl ?? "",
        });
        if (data.logoUrl) setPreview(data.logoUrl);
      })
      .catch(() => toast.error("Failed to load settings."))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setPreview(dataUrl);
      setForm((prev) => ({ ...prev, logoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setSaving(true);

    try {
      const saved = await updateSettings(form);

      // Update BrandingContext immediately so the navbar reflects the new company name.
      setBranding({
        companyName: saved.companyName,
        logoUrl: saved.logoUrl,
      });

      toast.success("Settings saved successfully.");
    } catch (err) {
      toast.error(err.response?.data?.error ?? "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div aria-live="polite" aria-busy="true">
        <p>Loading settings…</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Company branding settings"
    >
      <section aria-labelledby="branding-heading" className="mb-4">
        <h2 id="branding-heading" className="h5 mb-3">
          Branding
        </h2>

        {/* Company Name */}
        <div className="mb-3">
          <label htmlFor="companyName" className="form-label">
            Company Name{" "}
            <span className="text-muted fw-normal small">(required)</span>
          </label>
          <FieldHelp text={TOOLTIPS.settings.companyName} />
          <input
            id="companyName"
            name="companyName"
            type="text"
            className={`form-control${formErrors.companyName ? " is-invalid" : ""}`}
            value={form.companyName}
            onChange={handleChange}
            required
            aria-required="true"
            aria-describedby={
              formErrors.companyName ? "companyName-error" : undefined
            }
            aria-invalid={formErrors.companyName ? true : undefined}
          />
          {formErrors.companyName && (
            <div id="companyName-error" className="invalid-feedback">
              {formErrors.companyName}
            </div>
          )}
        </div>

        {/* Logo upload */}
        <div className="mb-3">
          <label htmlFor="logoUpload" className="form-label">
            Company Logo
          </label>
          <FieldHelp text={TOOLTIPS.settings.logoUrl} />
          <input
            id="logoUpload"
            name="logoUpload"
            type="file"
            className="form-control"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleLogoChange}
            aria-describedby="logo-hint"
          />
          <div id="logo-hint" className="form-text">
            Accepted formats: PNG, JPG, SVG. Stored as Base64 in the database.
          </div>
          {preview && (
            <div className="mt-2">
              <img
                src={preview}
                alt="Company logo preview"
                className="img-thumbnail"
                style={{ maxHeight: "80px" }}
              />
            </div>
          )}
        </div>
      </section>

      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? (
          "Saving…"
        ) : (
          <>
            <i className="bi bi-check-lg me-2" aria-hidden="true" />
            Save Settings
          </>
        )}
      </button>
    </form>
  );
}

// ── Discount Threshold Settings (admin + super_admin) ────────────────────────
function DiscountSettingsForm() {
  const [thresholds, setThresholds] = useState({
    managerReviewPercent: 10,
    executiveReviewPercent: 25,
  });
  const [volumeRules, setVolumeRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings()
      .then((data) => {
        if (data.discountThresholds) {
          setThresholds({
            managerReviewPercent:
              data.discountThresholds.managerReviewPercent ?? 10,
            executiveReviewPercent:
              data.discountThresholds.executiveReviewPercent ?? 25,
          });
        }
        if (Array.isArray(data.volumeDiscountRules)) {
          setVolumeRules(data.volumeDiscountRules);
        }
      })
      .catch(() => toast.error("Failed to load discount settings."))
      .finally(() => setLoading(false));
  }, []);

  const handleThresholdChange = (e) => {
    const { name, value } = e.target;
    setThresholds((prev) => ({
      ...prev,
      [name]: value === "" ? "" : Number(value),
    }));
  };

  const handleRuleChange = (idx, field, value) => {
    setVolumeRules((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, [field]: value === "" ? "" : Number(value) } : r,
      ),
    );
  };

  const addRule = () => {
    setVolumeRules((prev) => [
      ...prev,
      { membersThreshold: 0, discountPercent: 0 },
    ]);
  };

  const removeRule = (idx) => {
    setVolumeRules((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDiscountSettings({
        discountThresholds: thresholds,
        volumeDiscountRules: volumeRules,
      });
      toast.success("Discount settings saved.");
    } catch (err) {
      toast.error(
        err.response?.data?.error ?? "Failed to save discount settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div aria-live="polite" aria-busy="true">
        <p>Loading discount settings…</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Discount governance settings"
      className="mt-4"
    >
      <section aria-labelledby="discount-heading" className="mb-4">
        <h2 id="discount-heading" className="h5 mb-3">
          Discount Governance
        </h2>
        <p className="text-muted small mb-3">
          Line-item discounts above these thresholds will route the quote to the
          appropriate approver tier before it can be approved.
        </p>

        <div className="row g-3 mb-3">
          <div className="col-sm-4">
            <label htmlFor="managerReviewPercent" className="form-label">
              Manager Review threshold (%)
            </label>
            <FieldHelp text={TOOLTIPS.settings.managerReviewPercent} />
            <input
              id="managerReviewPercent"
              name="managerReviewPercent"
              type="number"
              className="form-control"
              min={0}
              max={100}
              step={0.1}
              value={thresholds.managerReviewPercent}
              onChange={handleThresholdChange}
              aria-describedby="mgr-hint"
            />
            <div id="mgr-hint" className="form-text">
              Discount &gt; this % → Manager Review
            </div>
          </div>

          <div className="col-sm-4">
            <label htmlFor="executiveReviewPercent" className="form-label">
              Executive Review threshold (%)
            </label>
            <FieldHelp text={TOOLTIPS.settings.executiveReviewPercent} />
            <input
              id="executiveReviewPercent"
              name="executiveReviewPercent"
              type="number"
              className="form-control"
              min={0}
              max={100}
              step={0.1}
              value={thresholds.executiveReviewPercent}
              onChange={handleThresholdChange}
              aria-describedby="exec-hint"
            />
            <div id="exec-hint" className="form-text">
              Discount &gt; this % → Executive Review
            </div>
          </div>
        </div>

        <h3 className="h6 mb-2">Volume Discount Rules</h3>
        <p className="text-muted small mb-2">
          Automatically applied when total membership reaches a threshold.
        </p>

        {volumeRules.length === 0 && (
          <p className="text-muted small fst-italic">
            No volume discount rules configured.
          </p>
        )}

        {volumeRules.map((rule, idx) => (
          <div key={idx} className="row g-2 mb-2 align-items-end">
            <div className="col-sm-4">
              <label htmlFor={`membersThreshold-${idx}`} className="form-label">
                Members threshold
              </label>
              <input
                id={`membersThreshold-${idx}`}
                type="number"
                className="form-control"
                min={0}
                value={rule.membersThreshold}
                onChange={(e) =>
                  handleRuleChange(idx, "membersThreshold", e.target.value)
                }
              />
            </div>
            <div className="col-sm-4">
              <label htmlFor={`discountPercent-${idx}`} className="form-label">
                Discount (%)
              </label>
              <input
                id={`discountPercent-${idx}`}
                type="number"
                className="form-control"
                min={0}
                max={100}
                step={0.1}
                value={rule.discountPercent}
                onChange={(e) =>
                  handleRuleChange(idx, "discountPercent", e.target.value)
                }
              />
            </div>
            <div className="col-sm-2">
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => removeRule(idx)}
                aria-label={`Remove volume rule ${idx + 1}`}
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="btn btn-outline-secondary btn-sm mt-1"
          onClick={addRule}
        >
          + Add Rule
        </button>
      </section>

      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? (
          "Saving…"
        ) : (
          <>
            <i className="bi bi-check-lg me-2" aria-hidden="true" />
            Save Discount Settings
          </>
        )}
      </button>
    </form>
  );
}

// ── §7.9 Margin Scorecard Settings ────────────────────────────────────────────
function MarginSettingsForm() {
  const [globalGreen, setGlobalGreen] = useState(50);
  const [globalYellow, setGlobalYellow] = useState(30);
  // Per-line overrides: [{ name: string, green: number, yellow: number }]
  const [lineOverrides, setLineOverrides] = useState([]);
  const [availableLines, setAvailableLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getSettings(), getProductLines()])
      .then(([data, lines]) => {
        const g = data.marginTargets?.global ?? {};
        setGlobalGreen(g.green ?? 50);
        setGlobalYellow(g.yellow ?? 30);

        const overrides = [];
        const lineMap = data.marginTargets?.productLines ?? {};
        for (const [name, thresholds] of Object.entries(lineMap)) {
          overrides.push({
            name,
            green: thresholds.green ?? 50,
            yellow: thresholds.yellow ?? 30,
          });
        }
        setLineOverrides(overrides);
        setAvailableLines(lines || []);
      })
      .catch(() => toast.error("Failed to load margin settings."))
      .finally(() => setLoading(false));
  }, []);

  const addOverride = () => {
    // Pick first available line not already in overrides
    const usedNames = new Set(lineOverrides.map((o) => o.name));
    const first = availableLines.find((l) => !usedNames.has(l.name));
    setLineOverrides((prev) => [
      ...prev,
      { name: first?.name ?? "", green: 50, yellow: 30 },
    ]);
  };

  const removeOverride = (idx) => {
    setLineOverrides((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateOverride = (idx, field, value) => {
    setLineOverrides((prev) =>
      prev.map((o, i) =>
        i === idx
          ? {
              ...o,
              [field]:
                field === "name" ? value : value === "" ? "" : Number(value),
            }
          : o,
      ),
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const productLines = {};
      for (const ov of lineOverrides) {
        if (ov.name) {
          productLines[ov.name] = {
            green: Number(ov.green) || 0,
            yellow: Number(ov.yellow) || 0,
          };
        }
      }
      await updateMarginSettings({
        marginTargets: {
          global: {
            green: Number(globalGreen) || 0,
            yellow: Number(globalYellow) || 0,
          },
          productLines,
        },
      });
      toast.success("Margin settings saved.");
    } catch (err) {
      toast.error(
        err.response?.data?.error ?? "Failed to save margin settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div aria-live="polite" aria-busy="true">
        <p>Loading margin settings…</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Margin scorecard settings"
      className="mt-4"
    >
      <section aria-labelledby="margin-heading" className="mb-4">
        <h2 id="margin-heading" className="h5 mb-3">
          Margin Scorecard
        </h2>
        <p className="text-muted small mb-3">
          Quotes below the yellow threshold route to Manager Review; below the
          red threshold route to Executive Review.
        </p>

        <div className="row g-3 mb-4">
          <div className="col-sm-4">
            <label htmlFor="globalGreen" className="form-label">
              Global green threshold (%)
            </label>
            <FieldHelp text={TOOLTIPS.settings.marginGreen} />
            <input
              id="globalGreen"
              type="number"
              className="form-control"
              min={0}
              max={100}
              step={0.1}
              value={globalGreen}
              onChange={(e) => setGlobalGreen(e.target.value)}
              aria-describedby="green-hint"
            />
            <div id="green-hint" className="form-text">
              Margin ≥ this % → green (healthy)
            </div>
          </div>

          <div className="col-sm-4">
            <label htmlFor="globalYellow" className="form-label">
              Global yellow threshold (%)
            </label>
            <FieldHelp text={TOOLTIPS.settings.marginYellow} />
            <input
              id="globalYellow"
              type="number"
              className="form-control"
              min={0}
              max={100}
              step={0.1}
              value={globalYellow}
              onChange={(e) => setGlobalYellow(e.target.value)}
              aria-describedby="yellow-hint"
            />
            <div id="yellow-hint" className="form-text">
              Margin ≥ this % → yellow (Manager Review)
            </div>
          </div>
        </div>

        <h3 className="h6 mb-2">Per–Product Line Overrides</h3>
        <p className="text-muted small mb-2">
          Override global thresholds for specific product lines. The most
          restrictive (highest green threshold) override applies.
        </p>

        {lineOverrides.length === 0 && (
          <p className="text-muted small fst-italic">
            No per-line overrides configured.
          </p>
        )}

        {lineOverrides.map((ov, idx) => (
          <div key={idx} className="row g-2 mb-2 align-items-end">
            <div className="col-sm-4">
              <label htmlFor={`line-name-${idx}`} className="form-label">
                Product line
              </label>
              <select
                id={`line-name-${idx}`}
                className="form-select"
                value={ov.name}
                onChange={(e) => updateOverride(idx, "name", e.target.value)}
                aria-label={`Product line for override ${idx + 1}`}
              >
                {availableLines.map((l) => (
                  <option key={l._id} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-sm-2">
              <label htmlFor={`line-green-${idx}`} className="form-label">
                Green (%)
              </label>
              <input
                id={`line-green-${idx}`}
                type="number"
                className="form-control"
                min={0}
                max={100}
                step={0.1}
                value={ov.green}
                onChange={(e) => updateOverride(idx, "green", e.target.value)}
              />
            </div>
            <div className="col-sm-2">
              <label htmlFor={`line-yellow-${idx}`} className="form-label">
                Yellow (%)
              </label>
              <input
                id={`line-yellow-${idx}`}
                type="number"
                className="form-control"
                min={0}
                max={100}
                step={0.1}
                value={ov.yellow}
                onChange={(e) => updateOverride(idx, "yellow", e.target.value)}
              />
            </div>
            <div className="col-sm-2">
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => removeOverride(idx)}
                aria-label={`Remove override for ${ov.name || "row " + (idx + 1)}`}
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="btn btn-outline-secondary btn-sm mt-1"
          onClick={addOverride}
        >
          + Add Override
        </button>
      </section>

      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? (
          "Saving…"
        ) : (
          <>
            <i className="bi bi-check-lg me-2" aria-hidden="true" />
            Save Margin Settings
          </>
        )}
      </button>
    </form>
  );
}
