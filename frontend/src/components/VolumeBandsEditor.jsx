import FieldHelp from "./FieldHelp";
import { TOOLTIPS } from "../utils/tooltips";

/**
 * VolumeBandsEditor — inline editor for the `volumeBands` array on a Product (FR-PROD-13).
 *
 * Props:
 *   bands      {Array<{label, maxMembers, price, implPrice}>} - controlled array
 *   onChange   {function} - called with updated array
 *   error      {string}   - optional error for the entire bands array
 *   bandErrors {object}   - formErrors object; keys like `volumeBands_maxMembers_${i}`
 */
export default function VolumeBandsEditor({
  bands,
  onChange,
  error,
  bandErrors = {},
}) {
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

      {error && (
        <div
          className="text-danger small mb-2"
          role="alert"
          id="volume-bands-error"
        >
          {error}
        </div>
      )}

      {bands.length === 0 && (
        <p className="text-muted small">No bands defined. Add one below.</p>
      )}

      {bands.map((band, i) => {
        const maxMembersError = bandErrors[`volumeBands_maxMembers_${i}`];
        return (
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
                  min="1"
                  className={`form-control form-control-sm${maxMembersError ? " is-invalid" : ""}`}
                  placeholder="Leave blank for unlimited"
                  value={band.maxMembers}
                  onChange={(e) => updateBand(i, "maxMembers", e.target.value)}
                  aria-describedby={
                    maxMembersError ? `band-max-error-${i}` : undefined
                  }
                />
                {maxMembersError && (
                  <div
                    id={`band-max-error-${i}`}
                    className="invalid-feedback"
                    role="alert"
                  >
                    {maxMembersError}
                  </div>
                )}
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
                  step="0.01"
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
                  step="0.01"
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
        );
      })}

      <button
        type="button"
        className="btn btn-outline-secondary btn-sm mt-1"
        onClick={addBand}
        aria-label="Add band"
      >
        <i className="bi bi-plus me-1" aria-hidden="true" />
        Add Band
      </button>
    </fieldset>
  );
}
