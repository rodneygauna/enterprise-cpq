import FieldHelp from "./FieldHelp";
import { TOOLTIPS } from "../utils/tooltips";

/**
 * TiersEditor — inline editor for the `tiers` array on a Product (FR-PROD-13).
 *
 * Props:
 *   tiers    {Array<{min: string, price: string}>} - controlled array of tier objects
 *   onChange {function}  - called with updated array
 *   error    {string}    - optional error message for the entire tiers array
 */
export default function TiersEditor({ tiers, onChange, error }) {
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

      {error && (
        <div className="text-danger small mb-2" role="alert" id="tiers-error">
          {error}
        </div>
      )}

      {tiers.length === 0 && (
        <p className="text-muted small">No tiers defined. Add one below.</p>
      )}

      {tiers.map((tier, i) => (
        <div key={i} className="d-flex gap-2 mb-1 align-items-center">
          <label className="visually-hidden" htmlFor={`tier-min-${i}`}>
            Tier {i + 1} minimum volume
          </label>
          <input
            id={`tier-min-${i}`}
            type="number"
            min="0"
            className="form-control form-control-sm"
            placeholder="Min volume"
            value={tier.min}
            onChange={(e) => updateTier(i, "min", e.target.value)}
            aria-label={`Tier ${i + 1} minimum volume`}
          />
          <label className="visually-hidden" htmlFor={`tier-price-${i}`}>
            Tier {i + 1} price
          </label>
          <input
            id={`tier-price-${i}`}
            type="number"
            min="0"
            step="0.01"
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
        aria-label="Add tier"
      >
        <i className="bi bi-plus me-1" aria-hidden="true" />
        Add Tier
      </button>
    </fieldset>
  );
}
