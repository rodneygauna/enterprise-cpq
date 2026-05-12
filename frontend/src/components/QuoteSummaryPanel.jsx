/**
 * QuoteSummaryPanel — sticky financial summary sidebar for the Quote Builder.
 *
 * Pure presentational component — receives computed totals as props.
 * Covers FR-QUOTE-12 real-time financial summary display.
 */
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function Row({ label, value, bold, large }) {
  return (
    <div
      className={`d-flex justify-content-between align-items-baseline${bold ? " fw-semibold" : ""}${large ? " fs-5" : ""}`}
    >
      <span className="text-muted small">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default function QuoteSummaryPanel({
  summary,
  globalAdjType,
  globalAdjDiscountType,
  globalAdjValue,
  onGlobalAdjTypeChange,
  onGlobalAdjDiscountTypeChange,
  onGlobalAdjValueChange,
  scopeReviewCount,
  saving,
  onSave,
  marginPercent,
  marginStatus,
}) {
  const {
    totalPMPM = 0,
    totalMonthlyFees = 0,
    monthlyTotal = 0,
    arr = 0,
    implementationTotal = 0,
    grossTCV = 0,
    globalAdjustmentAmount = 0,
    netTCV = 0,
  } = summary;

  return (
    <div
      className="card border-0 shadow-sm"
      style={{ position: "sticky", top: "1rem" }}
      aria-label="Financial summary"
    >
      <div className="card-header bg-primary text-white fw-semibold">
        Financial Summary
      </div>
      <div className="card-body">
        <div className="d-flex flex-column gap-1 mb-3">
          <Row label="PMPM" value={USD.format(totalPMPM)} />
          <Row label="Monthly Fees" value={USD.format(totalMonthlyFees)} />
          <Row label="Monthly Total" value={USD.format(monthlyTotal)} bold />
          <Row label="ARR" value={USD.format(arr)} />
          <hr className="my-2" />
          <Row label="Implementation" value={USD.format(implementationTotal)} />
          <Row label="Gross TCV" value={USD.format(grossTCV)} bold />
          {globalAdjustmentAmount !== 0 && (
            <Row
              label={
                globalAdjType === "surcharge" ? "Surcharge" : "Global Discount"
              }
              value={`${globalAdjType === "surcharge" ? "+" : "-"}${USD.format(Math.abs(globalAdjustmentAmount))}`}
            />
          )}
          <hr className="my-2" />
          <Row label="Net TCV" value={USD.format(netTCV)} bold large />
        </div>

        {/* Margin Scorecard badge (FR-MARGIN-3) */}
        {marginStatus && (
          <div className="mb-3">
            <div className="d-flex align-items-center gap-2">
              <span
                className={`badge rounded-pill ${
                  marginStatus === "green"
                    ? "bg-success"
                    : marginStatus === "yellow"
                      ? "bg-warning text-dark"
                      : "bg-danger"
                }`}
                aria-label={`Margin score: ${marginStatus}`}
              >
                {marginStatus === "green"
                  ? "● Healthy Margin"
                  : marginStatus === "yellow"
                    ? "● Manager Review"
                    : "● Executive Review"}
              </span>
              {marginPercent !== null && marginPercent !== undefined && (
                <span className="text-muted small">
                  {marginPercent.toFixed(1)}%
                </span>
              )}
            </div>
            {marginStatus !== "green" && (
              <p className="text-muted small mb-0 mt-1">
                {marginStatus === "yellow"
                  ? "Margin below green threshold — will route to Manager Review."
                  : "Margin below yellow threshold — will route to Executive Review."}
              </p>
            )}
          </div>
        )}

        {scopeReviewCount > 0 && (
          <div
            className="alert alert-warning py-2 small mb-3"
            role="status"
            aria-live="polite"
          >
            {scopeReviewCount} item{scopeReviewCount !== 1 ? "s" : ""} require
            pricing review (excluded from TCV)
          </div>
        )}

        {/* Global Adjustment (FR-QUOTE-11) */}
        <fieldset className="mb-3">
          <legend className="small fw-semibold mb-2">Global Adjustment</legend>
          <div className="d-flex gap-1 mb-2">
            <select
              className="form-select form-select-sm"
              value={globalAdjType}
              onChange={(e) => onGlobalAdjTypeChange(e.target.value)}
              aria-label="Global adjustment type"
            >
              <option value="">None</option>
              <option value="discount">Discount</option>
              <option value="surcharge">Surcharge</option>
            </select>
          </div>
          {globalAdjType && (
            <div className="d-flex gap-1">
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: 110 }}
                value={globalAdjDiscountType}
                onChange={(e) => onGlobalAdjDiscountTypeChange(e.target.value)}
                aria-label="Global adjustment unit"
              >
                <option value="percentage">%</option>
                <option value="flat">$ Flat</option>
              </select>
              <input
                type="number"
                className="form-control form-control-sm"
                min="0"
                step="0.01"
                value={globalAdjValue}
                onChange={(e) => onGlobalAdjValueChange(e.target.value)}
                aria-label="Global adjustment value"
                placeholder="0"
              />
            </div>
          )}
        </fieldset>

        <button
          type="button"
          className="btn btn-primary w-100"
          onClick={onSave}
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
            "Save Quote"
          )}
        </button>
      </div>
    </div>
  );
}
