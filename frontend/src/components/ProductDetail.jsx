import FieldHelp from "./FieldHelp";
import ProductLineBadge from "./ProductLineBadge";
import { TOOLTIPS } from "../utils/tooltips";

const T = TOOLTIPS.products;

/**
 * ProductDetail — contextual read-only view of a product (FR-PROD-10).
 *
 * Renders only the fields that are relevant to the product's type/strategy/model.
 * Empty or zero-value fields are omitted rather than shown as "—" or "$0.00".
 *
 * Props:
 *   product     {object} - the product document from the API
 *   allProducts {Array}  - all products; used to resolve relationship IDs to names
 */
export default function ProductDetail({ product, allProducts }) {
  const resolveName = (id) => {
    const resolved = allProducts.find((p) => p._id === (id?._id ?? id));
    return resolved?.name ?? String(id);
  };

  // Convenience booleans
  const hasAnyFlag =
    product.isQuantityBased ||
    (product.type === "Core" && product.isBaselineProduct) ||
    (product.type === "Child" && product.inheritTierVolumesFromCore);

  const hasCompatible =
    product.type === "Child" &&
    Array.isArray(product.compatibleCoreIds) &&
    product.compatibleCoreIds.length > 0;

  const hasRecommended =
    Array.isArray(product.recommendedProductIds) &&
    product.recommendedProductIds.length > 0;

  return (
    <div>
      {/* ── Section 1: Identity ── */}
      <h6 className="fw-semibold text-muted text-uppercase mb-2 border-bottom pb-1">
        Identity
      </h6>
      <dl className="row mb-4">
        {product.sku && (
          <>
            <dt className="col-5">
              SKU <FieldHelp text={T.sku} />
            </dt>
            <dd className="col-7 font-monospace">{product.sku}</dd>
          </>
        )}
        <dt className="col-5">
          Product Line <FieldHelp text={T.productLineId} />
        </dt>
        <dd className="col-7">
          <ProductLineBadge line={product.productLineId} />
        </dd>
        <dt className="col-5">
          Type <FieldHelp text={T.type} />
        </dt>
        <dd className="col-7">{product.type}</dd>
        {product.description && (
          <>
            <dt className="col-5">Description</dt>
            <dd className="col-7">{product.description}</dd>
          </>
        )}
      </dl>

      {/* ── Section 2: Pricing Configuration ── */}
      <h6 className="fw-semibold text-muted text-uppercase mb-2 border-bottom pb-1">
        Pricing Configuration
      </h6>
      <dl className="row mb-4">
        <dt className="col-5">
          Pricing Model <FieldHelp text={T.pricingModel} />
        </dt>
        <dd className="col-7">{product.pricingModel}</dd>
        <dt className="col-5">
          Pricing Strategy <FieldHelp text={T.pricingStrategy} />
        </dt>
        <dd className="col-7">{product.pricingStrategy}</dd>
        <dt className="col-5">
          Billing Type <FieldHelp text={T.billingType} />
        </dt>
        <dd className="col-7">{product.billingType}</dd>
        {product.scopeBasedPricing && product.scopeBasedPricing !== "None" && (
          <>
            <dt className="col-5">
              Scope-Based Pricing <FieldHelp text={T.scopeBasedPricing} />
            </dt>
            <dd className="col-7">{product.scopeBasedPricing}</dd>
          </>
        )}
      </dl>

      {/* ── Section 3: Pricing Details ── */}
      <h6 className="fw-semibold text-muted text-uppercase mb-2 border-bottom pb-1">
        Pricing Details
      </h6>
      <dl className="row mb-3">
        {/* Base Price — Standard strategy only */}
        {product.pricingStrategy === "Standard" &&
          product.basePrice != null && (
            <>
              <dt className="col-5">
                Base Price <FieldHelp text={T.basePrice} />
              </dt>
              <dd className="col-7">${Number(product.basePrice).toFixed(2)}</dd>
            </>
          )}
        {/* Unit Cost */}
        {product.unitCost != null && product.unitCost > 0 && (
          <>
            <dt className="col-5">
              Unit Cost <FieldHelp text={T.unitCost} />
            </dt>
            <dd className="col-7">${Number(product.unitCost).toFixed(2)}</dd>
          </>
        )}
        {/* Implementation Fee */}
        {product.implementationFee != null && product.implementationFee > 0 && (
          <>
            <dt className="col-5">
              Impl. Fee <FieldHelp text={T.implementationFee} />
            </dt>
            <dd className="col-7">
              ${Number(product.implementationFee).toFixed(2)}
            </dd>
          </>
        )}
        {/* Overage Price — Per Unit / Transaction only */}
        {product.pricingModel === "Per Unit / Transaction" &&
          product.overagePrice != null &&
          product.overagePrice > 0 && (
            <>
              <dt className="col-5">
                Overage Price <FieldHelp text={T.overagePrice} />
              </dt>
              <dd className="col-7">
                ${Number(product.overagePrice).toFixed(2)}
              </dd>
            </>
          )}
      </dl>

      {/* Tiers table — Tiered strategy only */}
      {product.pricingStrategy === "Tiered" &&
        Array.isArray(product.tiers) &&
        product.tiers.length > 0 && (
          <div className="mb-4">
            <table
              className="table table-sm table-bordered mb-0"
              aria-label="Pricing tiers"
            >
              <caption className="visually-hidden">
                Pricing tiers for {product.name}
              </caption>
              <thead className="table-light">
                <tr>
                  <th scope="col">Min Volume</th>
                  <th scope="col">
                    Price <FieldHelp text={T.tiers} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {product.tiers.map((t, i) => (
                  <tr key={i}>
                    <td>≥ {Number(t.min).toLocaleString()}</td>
                    <td>${Number(t.price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {/* Volume Bands table — Volume Bands strategy only */}
      {product.pricingStrategy === "Volume Bands" &&
        Array.isArray(product.volumeBands) &&
        product.volumeBands.length > 0 && (
          <div className="mb-4">
            <table
              className="table table-sm table-bordered mb-0"
              aria-label="Volume bands"
            >
              <caption className="visually-hidden">
                Volume bands pricing for {product.name}
              </caption>
              <thead className="table-light">
                <tr>
                  <th scope="col">Band</th>
                  <th scope="col">Max Members</th>
                  <th scope="col">
                    Price <FieldHelp text={T.volumeBands} />
                  </th>
                  <th scope="col">Impl. Fee</th>
                </tr>
              </thead>
              <tbody>
                {product.volumeBands.map((b, i) => (
                  <tr key={i}>
                    <td>{b.label}</td>
                    <td>
                      {b.maxMembers != null
                        ? Number(b.maxMembers).toLocaleString()
                        : "Unlimited"}
                    </td>
                    <td>${Number(b.price).toFixed(2)}</td>
                    <td>${Number(b.implPrice || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {/* ── Section 4: Behavior Flags ── */}
      {hasAnyFlag && (
        <>
          <h6 className="fw-semibold text-muted text-uppercase mb-2 border-bottom pb-1">
            Behavior Flags
          </h6>
          <ul className="list-unstyled mb-4 small">
            {product.isQuantityBased && (
              <li>
                <i
                  className="bi bi-check-circle-fill text-success me-2"
                  aria-hidden="true"
                />
                Quantity Based <FieldHelp text={T.isQuantityBased} />
              </li>
            )}
            {product.type === "Core" && product.isBaselineProduct && (
              <li>
                <i
                  className="bi bi-check-circle-fill text-success me-2"
                  aria-hidden="true"
                />
                Baseline Product <FieldHelp text={T.isBaselineProduct} />
              </li>
            )}
            {product.type === "Child" && product.inheritTierVolumesFromCore && (
              <li>
                <i
                  className="bi bi-check-circle-fill text-success me-2"
                  aria-hidden="true"
                />
                Inherits Tier Volumes From Core{" "}
                <FieldHelp text={T.inheritTierVolumesFromCore} />
              </li>
            )}
          </ul>
        </>
      )}

      {/* ── Section 5: Relationships ── */}
      {(hasCompatible || hasRecommended) && (
        <>
          <h6 className="fw-semibold text-muted text-uppercase mb-2 border-bottom pb-1">
            Relationships
          </h6>

          {hasCompatible && (
            <div className="mb-3">
              <p className="small fw-semibold mb-1">
                Compatible Core Products{" "}
                <FieldHelp text={T.compatibleCoreIds} />
              </p>
              <ul className="list-unstyled mb-0 small">
                {product.compatibleCoreIds.map((id, i) => (
                  <li key={i}>
                    <i
                      className="bi bi-link-45deg me-1 text-muted"
                      aria-hidden="true"
                    />
                    {resolveName(id)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasRecommended && (
            <div className="mb-3">
              <p className="small fw-semibold mb-1">
                Recommended Products{" "}
                <FieldHelp text={T.recommendedProductIds} />
              </p>
              <ul className="list-unstyled mb-0 small">
                {product.recommendedProductIds.map((id, i) => (
                  <li key={i}>
                    <i
                      className="bi bi-star me-1 text-muted"
                      aria-hidden="true"
                    />
                    {resolveName(id)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
