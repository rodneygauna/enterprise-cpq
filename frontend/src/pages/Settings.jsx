import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { getSettings, updateSettings } from "../api/settings";
import { useBranding } from "../context/BrandingContext";
import RequireRole from "../components/RequireRole";

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

function applyBsColor(token, hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  document.documentElement.style.setProperty(`--bs-${token}`, hex);
  document.documentElement.style.setProperty(`--bs-${token}-rgb`, rgb);
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function validate(values) {
  const errors = {};
  if (!values.companyName.trim()) {
    errors.companyName = "Company name is required.";
  }
  if (values.primaryColor && !HEX_RE.test(values.primaryColor)) {
    errors.primaryColor = "Must be a valid 6-digit hex color (e.g. #0d6efd).";
  }
  if (values.accentColor && !HEX_RE.test(values.accentColor)) {
    errors.accentColor = "Must be a valid 6-digit hex color (e.g. #6c757d).";
  }
  return errors;
}

/**
 * Company branding settings page — super_admin only.
 *
 * Allows editing:
 *   - Company name
 *   - Company logo (uploaded as Base64, stored in MongoDB)
 *   - Primary brand color (Bootstrap --bs-primary)
 *   - Accent brand color (Bootstrap --bs-secondary)
 */
export default function Settings() {
  return (
    <RequireRole roles={["super_admin"]}>
      <SettingsForm />
    </RequireRole>
  );
}

function SettingsForm() {
  const { setBranding } = useBranding();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    companyName: "",
    primaryColor: "#0d6efd",
    accentColor: "#6c757d",
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
          primaryColor: data.primaryColor ?? "#0d6efd",
          accentColor: data.accentColor ?? "#6c757d",
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

      // Update BrandingContext and CSS custom properties immediately so the
      // navbar and any Bootstrap utility classes reflect the new colors.
      setBranding({
        companyName: saved.companyName,
        primaryColor: saved.primaryColor,
        accentColor: saved.accentColor,
        logoUrl: saved.logoUrl,
      });
      applyBsColor("primary", saved.primaryColor);
      applyBsColor("secondary", saved.accentColor);

      toast.success("Settings saved successfully.");
    } catch (err) {
      toast.error(err.response?.data?.error ?? "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container-fluid py-4" aria-live="polite" aria-busy="true">
        <p>Loading settings…</p>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <h1 className="h3 mb-4">Company Settings</h1>

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

          {/* Primary color */}
          <div className="mb-3">
            <label htmlFor="primaryColor" className="form-label">
              Primary Color
            </label>
            <div className="d-flex align-items-center gap-2">
              <input
                id="primaryColor"
                name="primaryColor"
                type="color"
                className="form-control form-control-color"
                value={form.primaryColor}
                onChange={handleChange}
                title="Choose primary brand color"
              />
              <input
                aria-label="Primary color hex value"
                name="primaryColor"
                type="text"
                className={`form-control${formErrors.primaryColor ? " is-invalid" : ""}`}
                style={{ maxWidth: "120px" }}
                value={form.primaryColor}
                onChange={handleChange}
                pattern="^#[0-9a-fA-F]{6}$"
                placeholder="#0d6efd"
                aria-describedby={
                  formErrors.primaryColor ? "primaryColor-error" : undefined
                }
                aria-invalid={formErrors.primaryColor ? true : undefined}
              />
            </div>
            {formErrors.primaryColor && (
              <div id="primaryColor-error" className="invalid-feedback d-block">
                {formErrors.primaryColor}
              </div>
            )}
          </div>

          {/* Accent color */}
          <div className="mb-3">
            <label htmlFor="accentColor" className="form-label">
              Accent Color
            </label>
            <div className="d-flex align-items-center gap-2">
              <input
                id="accentColor"
                name="accentColor"
                type="color"
                className="form-control form-control-color"
                value={form.accentColor}
                onChange={handleChange}
                title="Choose accent brand color"
              />
              <input
                aria-label="Accent color hex value"
                name="accentColor"
                type="text"
                className={`form-control${formErrors.accentColor ? " is-invalid" : ""}`}
                style={{ maxWidth: "120px" }}
                value={form.accentColor}
                onChange={handleChange}
                pattern="^#[0-9a-fA-F]{6}$"
                placeholder="#6c757d"
                aria-describedby={
                  formErrors.accentColor ? "accentColor-error" : undefined
                }
                aria-invalid={formErrors.accentColor ? true : undefined}
              />
            </div>
            {formErrors.accentColor && (
              <div id="accentColor-error" className="invalid-feedback d-block">
                {formErrors.accentColor}
              </div>
            )}
          </div>
        </section>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
