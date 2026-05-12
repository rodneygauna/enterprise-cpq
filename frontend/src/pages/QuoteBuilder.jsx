/**
 * QuoteBuilder — §7.5 Quote Builder page.
 *
 * Routes: /quotes/new  (create new quote)
 *         /quotes/:id  (load and edit existing quote)
 *
 * Covers FR-QUOTE-1 through FR-QUOTE-16.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";

import {
  calculateLineItem,
  applyLineItemAdjustment,
  calculateQuoteSummary,
  computeYearlySummary,
  resolveVolumeBand,
  computeMargin,
  resolveMarginStatus,
} from "../utils/pricing";
import { getProducts } from "../api/products";
import { getProductLines } from "../api/productLines";
import {
  getQuote,
  createQuote,
  updateQuote,
  duplicateQuote,
} from "../api/quotes";
import { getSettings } from "../api/settings";
import QuoteSummaryPanel from "../components/QuoteSummaryPanel";
import MultiYearForecast from "../components/MultiYearForecast";
import OffcanvasDrawer from "../components/OffcanvasDrawer";
import FieldHelp from "../components/FieldHelp";
import { useAuth } from "../hooks/useAuth";
import { TOOLTIPS } from "../utils/tooltips";

// ── Formatters ────────────────────────────────────────────────────────────────
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

// ── Default selection state for a newly selected product ─────────────────────
const DEFAULT_SELECTION = {
  quantity: 1,
  annualUnits: 0,
  estimatedHours: 0,
  adjustmentDirection: null,
  adjustmentType: "percentage",
  adjustmentValue: "",
};

// ── Determine which numeric input a product needs (FR-QUOTE-6) ───────────────
function getInputConfig(product) {
  if (!product) return null;
  switch (product.pricingModel) {
    case "Flat Fee":
      return { label: "Qty", field: "quantity", min: 0, step: 1 };
    case "Per Unit / Transaction":
      return { label: "Annual Units", field: "annualUnits", min: 0, step: 1 };
    case "Per User / License":
      return { label: "Seats", field: "quantity", min: 0, step: 1 };
    case "Hourly Rate":
      return { label: "Hours", field: "estimatedHours", min: 0, step: 0.5 };
    default:
      if (product.isQuantityBased) {
        return { label: "Qty", field: "quantity", min: 0, step: 1 };
      }
      return null; // PMPM/Monthly: driven by membershipCount from header
  }
}

// ── CSV export helper (FR-QUOTE-14) ──────────────────────────────────────────
function exportCSV(
  clientName,
  selectedItems,
  summary,
  termLength,
  membershipCount,
) {
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const rows = [
    ["Client Name", clientName],
    ["Membership Count", membershipCount],
    ["Term (months)", termLength],
    [],
    [
      "Product",
      "SKU",
      "Pricing Model",
      "Extended Price",
      "Impl. Fee",
      "Adjusted Price",
    ],
    ...selectedItems.map((item) => {
      const snap = item.productSnapshot || item.product || {};
      return [
        snap.name ?? "",
        snap.sku ?? "",
        snap.pricingModel ?? "",
        item.extendedPrice ?? "",
        item.implementationFee ?? "",
        item.adjustedPrice ?? "",
      ];
    }),
    [],
    ["PMPM", summary.totalPMPM],
    ["Monthly Total", summary.monthlyTotal],
    ["ARR", summary.arr],
    ["Implementation Total", summary.implementationTotal],
    ["Gross TCV", summary.grossTCV],
    ["Net TCV", summary.netTCV],
  ];

  const csv = rows.map((row) => row.map(escape).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quote-${clientName.replace(/\s+/g, "-") || "draft"}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function QuoteBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = !id || id === "new";

  // ── Catalog data ────────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [productLines, setProductLines] = useState([]);
  const [marginTargets, setMarginTargets] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);

  // ── Quote header (FR-QUOTE-1) ────────────────────────────────────────────────
  const [clientName, setClientName] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [membershipCount, setMembershipCount] = useState("");
  const [termLength, setTermLength] = useState(12);
  const [annualUplift, setAnnualUplift] = useState(0);
  const [headerErrors, setHeaderErrors] = useState({});

  // ── Product line toggles (FR-QUOTE-2) ───────────────────────────────────────
  const [activeLineIds, setActiveLineIds] = useState(new Set());

  // ── Product selections (FR-QUOTE-3/4/5) ─────────────────────────────────────
  // Map: productId (string) → { quantity, annualUnits, estimatedHours,
  //                             adjustmentDirection, adjustmentType, adjustmentValue }
  const [selections, setSelections] = useState({});

  // ── Global adjustment (FR-QUOTE-11) ─────────────────────────────────────────
  const [globalAdjType, setGlobalAdjType] = useState("");
  const [globalAdjDiscountType, setGlobalAdjDiscountType] =
    useState("percentage");
  const [globalAdjValue, setGlobalAdjValue] = useState("");

  // ── Save state ───────────────────────────────────────────────────────────────
  const [quoteId, setQuoteId] = useState(null);
  const [saving, setSaving] = useState(false);

  // ── Product view slideout ────────────────────────────────────────────────────
  const [viewProduct, setViewProduct] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);

  // ── Load catalog on mount ────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([getProducts(), getProductLines(), getSettings()])
      .then(([prods, lines, settings]) => {
        setProducts(prods || []);
        setProductLines(lines || []);
        setMarginTargets(settings?.marginTargets ?? null);
      })
      .catch(() => setDataError("Failed to load product catalog."))
      .finally(() => setDataLoading(false));
  }, []);

  // ── Load existing quote ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isNew) return;
    setDataLoading(true);
    getQuote(id)
      .then((quote) => {
        setClientName(quote.clientName ?? "");
        setEffectiveDate(
          quote.effectiveDate ? quote.effectiveDate.substring(0, 10) : "",
        );
        setMembershipCount(quote.membershipCount ?? "");
        setTermLength(quote.termLength ?? 12);
        setAnnualUplift(quote.annualUplift ?? 0);
        setQuoteId(quote._id);
        setActiveLineIds(
          new Set(
            (quote.activeProductLineIds ?? []).map((l) =>
              (l._id ?? l).toString(),
            ),
          ),
        );
        const restored = {};
        for (const item of quote.selectedItems ?? []) {
          const pid = (item.productId?._id ?? item.productId).toString();
          restored[pid] = {
            quantity: item.quantity ?? 1,
            annualUnits: item.annualUnits ?? 0,
            estimatedHours: item.estimatedHours ?? 0,
            adjustmentDirection: item.adjustmentDirection ?? null,
            adjustmentType: item.adjustmentType ?? "percentage",
            adjustmentValue: item.adjustmentValue ?? "",
          };
        }
        setSelections(restored);
        setGlobalAdjType(quote.globalAdjustmentType ?? "");
        setGlobalAdjDiscountType(quote.globalDiscountType ?? "percentage");
        setGlobalAdjValue(quote.globalDiscountValue ?? "");
      })
      .catch(() => toast.error("Failed to load quote."))
      .finally(() => setDataLoading(false));
  }, [id, isNew]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const productsById = useMemo(
    () => Object.fromEntries(products.map((p) => [p._id.toString(), p])),
    [products],
  );

  // Baseline product per product line
  const baselineByLine = useMemo(() => {
    const map = {};
    for (const p of products) {
      if (!p.isBaselineProduct || !p.productLineId) continue;
      const lineId = (p.productLineId?._id ?? p.productLineId).toString();
      if (!map[lineId]) map[lineId] = p;
    }
    return map;
  }, [products]);

  const selectedIds = useMemo(
    () => new Set(Object.keys(selections)),
    [selections],
  );

  // Baselines that should be auto-applied (any non-baseline product from that line is selected)
  const activeBaselines = useMemo(() => {
    const result = [];
    for (const lineId of activeLineIds) {
      const baseline = baselineByLine[lineId];
      if (!baseline) continue;
      const hasActive = products
        .filter(
          (p) =>
            (p.productLineId?._id ?? p.productLineId)?.toString() === lineId &&
            !p.isBaselineProduct,
        )
        .some((p) => selectedIds.has(p._id.toString()));
      if (hasActive) result.push(baseline);
    }
    return result;
  }, [activeLineIds, baselineByLine, products, selectedIds]);

  // Build line items array for pricing calculations
  const lineItemsForCalc = useMemo(() => {
    const members = Number(membershipCount) || 0;
    const term = Number(termLength) || 12;
    const items = [];

    for (const [productId, sel] of Object.entries(selections)) {
      const product = productsById[productId];
      if (!product) continue;

      // Volume inheritance: find parent Core's band index (FR-QUOTE-4/7)
      let parentBandIndex = -1;
      if (
        product.inheritTierVolumesFromCore &&
        product.compatibleCoreIds?.length > 0
      ) {
        for (const coreId of product.compatibleCoreIds) {
          const coreIdStr = coreId.toString();
          if (selectedIds.has(coreIdStr)) {
            const coreProduct = productsById[coreIdStr];
            if (coreProduct?.pricingStrategy === "Volume Bands") {
              parentBandIndex = resolveVolumeBand(
                coreProduct.volumeBands,
                members,
              ).bandIndex;
            }
            break;
          }
        }
      }

      const adjustment =
        sel.adjustmentValue && sel.adjustmentDirection && sel.adjustmentType
          ? {
              direction: sel.adjustmentDirection,
              type: sel.adjustmentType,
              value: Number(sel.adjustmentValue),
            }
          : null;

      items.push({
        product,
        params: {
          membershipCount: members,
          termMonths: term,
          quantity: Number(sel.quantity) || 1,
          annualUnits: Number(sel.annualUnits) || 0,
          estimatedHours: Number(sel.estimatedHours) || 0,
          parentBandIndex,
        },
        adjustment,
      });
    }

    // Auto-include active baseline products (FR-QUOTE-8)
    // Guard: skip if baseline was already restored into selections from a saved quote
    // (avoids double-counting on quote reload)
    for (const baseline of activeBaselines) {
      if (selections[baseline._id.toString()]) continue;
      items.push({
        product: baseline,
        params: {
          membershipCount: Number(membershipCount) || 0,
          termMonths: Number(termLength) || 12,
          quantity: 1,
          annualUnits: 0,
          estimatedHours: 0,
          parentBandIndex: -1,
        },
        adjustment: null,
      });
    }

    return items;
  }, [
    selections,
    productsById,
    membershipCount,
    termLength,
    activeBaselines,
    selectedIds,
  ]);

  const globalAdjObj = useMemo(
    () =>
      globalAdjType && globalAdjValue
        ? {
            type: globalAdjType,
            discountType: globalAdjDiscountType,
            value: Number(globalAdjValue) || 0,
          }
        : null,
    [globalAdjType, globalAdjDiscountType, globalAdjValue],
  );

  const summary = useMemo(
    () =>
      calculateQuoteSummary(
        lineItemsForCalc,
        Number(membershipCount) || 0,
        Number(termLength) || 12,
        globalAdjObj,
      ),
    [lineItemsForCalc, membershipCount, termLength, globalAdjObj],
  );

  const yearlySummary = useMemo(
    () =>
      computeYearlySummary(
        lineItemsForCalc,
        Number(membershipCount) || 0,
        Number(termLength) || 12,
        Number(annualUplift) || 0,
      ),
    [lineItemsForCalc, membershipCount, termLength, annualUplift],
  );

  const scopeReviewCount = useMemo(
    () =>
      lineItemsForCalc.filter(
        (item) => item.product.scopeBasedPricing === "All",
      ).length,
    [lineItemsForCalc],
  );

  // ── Margin scoring memos (FR-MARGIN-1/3) ────────────────────────────────────
  const activeLineNames = useMemo(
    () =>
      [...activeLineIds]
        .map((id) => productLines.find((l) => l._id?.toString() === id)?.name)
        .filter(Boolean),
    [activeLineIds, productLines],
  );

  const margin = useMemo(() => {
    // Build items in the stored format that computeMargin expects
    const items = lineItemsForCalc.map((item) => {
      const calc = calculateLineItem(item.product, item.params);
      const adjustedPrice = item.adjustment
        ? applyLineItemAdjustment(calc.extendedPrice, item.adjustment)
        : calc.extendedPrice;
      return {
        adjustedPrice,
        quantity: item.params.quantity ?? 1,
        productSnapshot: item.product,
      };
    });
    return computeMargin(items);
  }, [lineItemsForCalc]);

  const marginStatus = useMemo(
    () =>
      resolveMarginStatus(margin.marginPercent, marginTargets, activeLineNames),
    [margin.marginPercent, marginTargets, activeLineNames],
  );

  // ── Selection management ─────────────────────────────────────────────────────

  const selectProduct = useCallback(
    (productId) => {
      setSelections((prev) => {
        const next = { ...prev };
        if (!next[productId]) next[productId] = { ...DEFAULT_SELECTION };

        // Recommendation engine — recursive auto-select (FR-QUOTE-5)
        const queue = [
          ...(productsById[productId]?.recommendedProductIds ?? []).map((r) =>
            r.toString(),
          ),
        ];
        const visited = new Set([productId]);
        while (queue.length > 0) {
          const recId = queue.shift();
          if (visited.has(recId)) continue;
          visited.add(recId);
          if (!next[recId]) next[recId] = { ...DEFAULT_SELECTION };
          const recProd = productsById[recId];
          if (recProd?.recommendedProductIds) {
            for (const nId of recProd.recommendedProductIds) {
              queue.push(nId.toString());
            }
          }
        }

        return next;
      });
    },
    [productsById],
  );

  const deselectProduct = useCallback(
    (productId) => {
      setSelections((prev) => {
        const next = { ...prev };
        delete next[productId];

        // Cascade deselect recommendations unless protected (FR-QUOTE-5)
        const toCheck = new Set(
          (productsById[productId]?.recommendedProductIds ?? []).map((r) =>
            r.toString(),
          ),
        );
        for (const recId of toCheck) {
          const isProtected = Object.keys(next).some((selId) =>
            productsById[selId]?.recommendedProductIds?.some(
              (r) => r.toString() === recId,
            ),
          );
          if (!isProtected) {
            delete next[recId];
            const recProd = productsById[recId];
            for (const nId of recProd?.recommendedProductIds ?? []) {
              toCheck.add(nId.toString());
            }
          }
        }

        return next;
      });
    },
    [productsById],
  );

  function toggleProduct(product) {
    const id = product._id.toString();
    if (selections[id]) deselectProduct(id);
    else selectProduct(id);
  }

  function updateSelection(productId, field, value) {
    setSelections((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value },
    }));
  }

  function toggleProductLine(lineId) {
    setActiveLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
        // Deselect all products from this line
        const lineProductIds = products
          .filter(
            (p) =>
              (p.productLineId?._id ?? p.productLineId)?.toString() === lineId,
          )
          .map((p) => p._id.toString());
        setSelections((s) => {
          const ns = { ...s };
          for (const pid of lineProductIds) delete ns[pid];
          return ns;
        });
      } else {
        next.add(lineId);
      }
      return next;
    });
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!clientName.trim()) {
      setHeaderErrors({ clientName: "Client name is required" });
      return;
    }
    setHeaderErrors({});
    setSaving(true);

    try {
      const members = Number(membershipCount) || 0;
      const term = Number(termLength) || 12;

      // Build selectedItems with computed prices for persistence
      const selectedItems = lineItemsForCalc.map((item) => {
        const calc = calculateLineItem(item.product, item.params);
        const adjustedPrice = item.adjustment
          ? applyLineItemAdjustment(calc.extendedPrice, item.adjustment)
          : calc.extendedPrice;
        const sel = selections[item.product._id.toString()] ?? {};
        return {
          productId: item.product._id,
          productSnapshot: item.product,
          quantity: item.params.quantity,
          annualUnits: item.params.annualUnits,
          estimatedHours: item.params.estimatedHours,
          adjustmentDirection: item.adjustment?.direction ?? null,
          adjustmentType: item.adjustment?.type ?? null,
          adjustmentValue: item.adjustment?.value ?? 0,
          extendedPrice: calc.extendedPrice,
          implementationFee: calc.implementationFee,
          adjustedPrice,
        };
      });

      const hasScopeBasedItems = lineItemsForCalc.some(
        (i) => i.product.scopeBasedPricing !== "None",
      );

      const payload = {
        clientName: clientName.trim(),
        effectiveDate: effectiveDate || null,
        membershipCount: members,
        termLength: term,
        annualUplift: Number(annualUplift) || 0,
        selectedItems,
        activeProductLineIds: [...activeLineIds],
        globalAdjustmentType: globalAdjType || null,
        globalDiscountType: globalAdjDiscountType,
        globalDiscountValue: Number(globalAdjValue) || 0,
        ...summary,
        implementationTotal: summary.implementationTotal,
        yearlySummary,
        productLineIds: [...activeLineIds],
        hasScopeBasedItems,
        status: "Draft",
      };

      let saved;
      if (quoteId) {
        saved = await updateQuote(quoteId, payload);
      } else {
        saved = await createQuote(payload);
        setQuoteId(saved._id);
        navigate(`/quotes/${saved._id}`, { replace: true });
      }

      toast.success("Quote saved successfully.");
    } catch (err) {
      toast.error(err.response?.data?.error ?? "Failed to save quote.");
    } finally {
      setSaving(false);
    }
  }

  // ── CSV export ────────────────────────────────────────────────────────────────
  function handleExportCSV() {
    const members = Number(membershipCount) || 0;
    const term = Number(termLength) || 12;

    const exportItems = lineItemsForCalc.map((item) => {
      const calc = calculateLineItem(item.product, item.params);
      const adjustedPrice = item.adjustment
        ? applyLineItemAdjustment(calc.extendedPrice, item.adjustment)
        : calc.extendedPrice;
      return {
        productSnapshot: item.product,
        extendedPrice: calc.extendedPrice,
        implementationFee: calc.implementationFee,
        adjustedPrice,
      };
    });

    exportCSV(clientName, exportItems, summary, term, members);
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  function renderLineItem(product, isChild = false) {
    const productId = product._id.toString();
    const isSelected = !!selections[productId];
    const isBaseline = product.isBaselineProduct;
    const sel = selections[productId] ?? DEFAULT_SELECTION;
    const inputConfig = getInputConfig(product);
    const isScopeAll = product.scopeBasedPricing === "All";
    const isScopeImplOnly = product.scopeBasedPricing === "Implementation Only";

    let extendedPrice = 0;
    let adjustedPrice = 0;
    if (isSelected) {
      const calc = calculateLineItem(product, {
        membershipCount: Number(membershipCount) || 0,
        termMonths: Number(termLength) || 12,
        quantity: Number(sel.quantity) || 1,
        annualUnits: Number(sel.annualUnits) || 0,
        estimatedHours: Number(sel.estimatedHours) || 0,
      });
      extendedPrice = calc.extendedPrice;
      adjustedPrice =
        sel.adjustmentValue && sel.adjustmentDirection && sel.adjustmentType
          ? applyLineItemAdjustment(extendedPrice, {
              direction: sel.adjustmentDirection,
              type: sel.adjustmentType,
              value: Number(sel.adjustmentValue),
            })
          : extendedPrice;
    }

    if (isBaseline) {
      // Baselines are auto-applied — no checkbox
      const baselineActive = activeBaselines.some(
        (b) => b._id.toString() === productId,
      );
      const calc = baselineActive
        ? calculateLineItem(product, {
            membershipCount: Number(membershipCount) || 0,
            termMonths: Number(termLength) || 12,
            quantity: 1,
            annualUnits: 0,
            estimatedHours: 0,
          })
        : null;
      return (
        <div
          key={productId}
          className={`d-flex align-items-start gap-3 py-2 border-bottom bg-body-tertiary px-2 rounded-1${isChild ? " ms-4" : ""}`}
          role="listitem"
        >
          <span
            className="badge bg-secondary mt-1"
            aria-label="Auto-applied baseline product"
          >
            Baseline
          </span>
          <div className="flex-grow-1">
            <div className="fw-semibold small">
              {product.name}
              {product.sku && (
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 fw-normal font-monospace ms-2"
                  style={{ fontSize: "0.78rem" }}
                  aria-label={`View details for ${product.name}`}
                  onClick={() => {
                    setViewProduct(product);
                    setViewOpen(true);
                  }}
                >
                  {product.sku}
                </button>
              )}
            </div>
            <div className="text-muted" style={{ fontSize: "0.78rem" }}>
              {product.pricingModel} · auto-applied once per line
            </div>
          </div>
          <div className="text-end text-muted small" style={{ minWidth: 90 }}>
            {baselineActive && calc ? USD.format(calc.extendedPrice) : "—"}
          </div>
        </div>
      );
    }

    return (
      <div
        key={productId}
        className={`py-2 border-bottom${isChild ? " ms-4 ps-2 border-start border-2" : ""}`}
        role="listitem"
      >
        <div className="d-flex align-items-start gap-3">
          <div className="form-check mt-1 mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              id={`product-${productId}`}
              checked={isSelected}
              onChange={() => toggleProduct(product)}
              aria-label={`Select ${product.name}`}
            />
          </div>
          <div className="flex-grow-1">
            <label
              htmlFor={`product-${productId}`}
              className="fw-semibold mb-0"
              style={{ cursor: "pointer" }}
            >
              {product.name}
            </label>
            {product.sku && (
              <button
                type="button"
                className="btn btn-link btn-sm p-0 fw-normal font-monospace ms-2"
                style={{ fontSize: "0.78rem" }}
                aria-label={`View details for ${product.name}`}
                onClick={() => {
                  setViewProduct(product);
                  setViewOpen(true);
                }}
              >
                {product.sku}
              </button>
            )}
            <div className="text-muted" style={{ fontSize: "0.78rem" }}>
              {product.pricingModel} · {product.pricingStrategy} ·{" "}
              {product.billingType}
            </div>

            {isScopeAll && (
              <span
                className="badge bg-warning text-dark mt-1"
                aria-label="Requires pricing scope review"
              >
                Requires Scope Review
              </span>
            )}
            {isScopeImplOnly && (
              <span className="badge bg-info text-dark mt-1">Impl. TBD</span>
            )}

            {isSelected && !isScopeAll && (
              <div className="row g-2 mt-1 align-items-center">
                {inputConfig && (
                  <div className="col-auto">
                    <label
                      className="form-label small mb-0"
                      htmlFor={`sel-${productId}-${inputConfig.field}`}
                    >
                      {inputConfig.label}
                    </label>
                    <input
                      id={`sel-${productId}-${inputConfig.field}`}
                      type="number"
                      className="form-control form-control-sm"
                      style={{ width: 110 }}
                      min={inputConfig.min}
                      step={inputConfig.step}
                      value={sel[inputConfig.field] ?? ""}
                      onChange={(e) =>
                        updateSelection(
                          productId,
                          inputConfig.field,
                          e.target.value,
                        )
                      }
                      aria-label={`${inputConfig.label} for ${product.name}`}
                    />
                  </div>
                )}

                {/* Line-item adjustment (FR-QUOTE-10) */}
                <div className="col-auto">
                  <label
                    className="form-label small mb-0"
                    htmlFor={`adj-dir-${productId}`}
                  >
                    Adjustment
                  </label>
                  <select
                    id={`adj-dir-${productId}`}
                    className="form-select form-select-sm"
                    style={{ width: 110 }}
                    value={sel.adjustmentDirection ?? ""}
                    onChange={(e) =>
                      updateSelection(
                        productId,
                        "adjustmentDirection",
                        e.target.value || null,
                      )
                    }
                    aria-label={`Adjustment type for ${product.name}`}
                  >
                    <option value="">None</option>
                    <option value="discount">Discount</option>
                    <option value="uplift">Uplift</option>
                  </select>
                </div>

                {sel.adjustmentDirection && (
                  <>
                    <div className="col-auto">
                      <label className="form-label small mb-0 visually-hidden">
                        Unit
                      </label>
                      <select
                        className="form-select form-select-sm"
                        style={{ width: 80 }}
                        value={sel.adjustmentType ?? "percentage"}
                        onChange={(e) =>
                          updateSelection(
                            productId,
                            "adjustmentType",
                            e.target.value,
                          )
                        }
                        aria-label={`Adjustment unit for ${product.name}`}
                      >
                        <option value="percentage">%</option>
                        <option value="flat">$</option>
                      </select>
                    </div>
                    <div className="col-auto">
                      <label
                        className="form-label small mb-0 visually-hidden"
                        htmlFor={`adj-val-${productId}`}
                      >
                        Value
                      </label>
                      <input
                        id={`adj-val-${productId}`}
                        type="number"
                        className="form-control form-control-sm"
                        style={{ width: 90 }}
                        min="0"
                        step="0.01"
                        value={sel.adjustmentValue ?? ""}
                        onChange={(e) =>
                          updateSelection(
                            productId,
                            "adjustmentValue",
                            e.target.value,
                          )
                        }
                        aria-label={`Adjustment value for ${product.name}`}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Extended / adjusted price column */}
          <div
            className="text-end fw-semibold"
            style={{ minWidth: 110 }}
            aria-live="polite"
            aria-label={`Price for ${product.name}`}
          >
            {isSelected && !isScopeAll ? (
              <>
                {sel.adjustmentDirection && adjustedPrice !== extendedPrice ? (
                  <>
                    <span
                      className="text-muted text-decoration-line-through d-block"
                      style={{ fontSize: "0.8rem" }}
                    >
                      {USD.format(extendedPrice)}
                    </span>
                    <span>{USD.format(adjustedPrice)}</span>
                  </>
                ) : (
                  USD.format(extendedPrice)
                )}
              </>
            ) : isSelected && isScopeAll ? (
              <span className="text-warning small">TBD</span>
            ) : (
              <span className="text-muted small">—</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderProductLineSection(line) {
    const lineId = (line._id ?? line).toString();
    if (!activeLineIds.has(lineId)) return null;

    const lineProducts = products.filter(
      (p) => (p.productLineId?._id ?? p.productLineId)?.toString() === lineId,
    );
    const cores = lineProducts.filter(
      (p) => p.type === "Core" && !p.isBaselineProduct,
    );
    const addOns = lineProducts.filter(
      (p) => p.type === "Add-on" && !p.isBaselineProduct,
    );
    const baseline = baselineByLine[lineId];

    // Children are grouped under their parent Core
    const getChildren = (coreId) =>
      lineProducts.filter(
        (p) =>
          p.type === "Child" &&
          !p.isBaselineProduct &&
          p.compatibleCoreIds?.some((id) => id.toString() === coreId),
      );

    if (lineProducts.length === 0) {
      return (
        <section key={lineId} aria-labelledby={`line-heading-${lineId}`}>
          <h3 className="h6 fw-semibold mb-2" id={`line-heading-${lineId}`}>
            {line.name}
          </h3>
          <p className="text-muted small">No products in this line.</p>
        </section>
      );
    }

    return (
      <section
        key={lineId}
        className="mb-4 border rounded p-3"
        aria-labelledby={`line-heading-${lineId}`}
      >
        <h3
          className="h6 fw-semibold mb-3 d-flex align-items-center gap-2"
          id={`line-heading-${lineId}`}
        >
          {line.displayColor && (
            <span
              className="rounded-circle d-inline-block"
              style={{
                width: 12,
                height: 12,
                backgroundColor: line.displayColor,
              }}
              aria-hidden="true"
            />
          )}
          {line.name}
        </h3>

        <div role="list" aria-label={`Products in ${line.name}`}>
          {baseline && renderLineItem(baseline)}

          {cores.map((core) => {
            const coreId = core._id.toString();
            const children = getChildren(coreId);
            return (
              <div key={coreId}>
                {renderLineItem(core)}
                {/* Show children only when core is selected (FR-QUOTE-3) */}
                {selections[coreId] &&
                  children.map((child) => renderLineItem(child, true))}
              </div>
            );
          })}

          {addOns.length > 0 && (
            <>
              <div className="small text-muted mt-2 mb-1 fw-semibold">
                Add-ons
              </div>
              {addOns.map((p) => renderLineItem(p))}
            </>
          )}

          {/* Children without a compatible Core in this line (standalone children) */}
          {lineProducts
            .filter(
              (p) =>
                p.type === "Child" &&
                !p.isBaselineProduct &&
                (!p.compatibleCoreIds || p.compatibleCoreIds.length === 0),
            )
            .map((p) => renderLineItem(p))}
        </div>
      </section>
    );
  }

  // ── Loading / error states ────────────────────────────────────────────────────
  if (dataLoading) {
    return (
      <div
        className="d-flex justify-content-center py-5"
        role="status"
        aria-label="Loading"
      >
        <div className="spinner-border" aria-hidden="true" />
        <span className="visually-hidden">Loading…</span>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="alert alert-danger m-4" role="alert">
        {dataError}
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <div className="container-fluid py-4">
      {/* Page header */}
      <div className="d-flex align-items-center gap-3 mb-4">
        <Link
          to="/quotes"
          className="btn btn-outline-secondary btn-sm"
          aria-label="Back to quotes"
        >
          <i className="bi bi-arrow-left me-1" aria-hidden="true" />
          Back
        </Link>
        <h1 className="h4 mb-0">
          {isNew
            ? "New Quote"
            : `Edit Quote${clientName ? ` — ${clientName}` : ""}`}
        </h1>
        <div className="ms-auto d-flex gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={handleExportCSV}
            disabled={lineItemsForCalc.length === 0}
          >
            <i className="bi bi-download me-1" aria-hidden="true" />
            Export CSV
          </button>
          {quoteId && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={async () => {
                try {
                  const copy = await duplicateQuote(quoteId);
                  navigate(`/quotes/${copy._id}`);
                  toast.success("Quote duplicated.");
                } catch {
                  toast.error("Failed to duplicate quote.");
                }
              }}
            >
              <i className="bi bi-copy me-1" aria-hidden="true" />
              Duplicate
            </button>
          )}
        </div>
      </div>

      <div className="row g-4">
        {/* ── Left column: inputs + product sections ── */}
        <div className="col-lg-8">
          {/* Quote header (FR-QUOTE-1) */}
          <section
            className="card border-0 shadow-sm mb-4"
            aria-labelledby="quote-header-heading"
          >
            <div className="card-body">
              <h2 className="h6 fw-semibold mb-3" id="quote-header-heading">
                Quote Details
              </h2>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="clientName">
                    Client Name{" "}
                    <span className="text-muted fw-normal small">
                      (required)
                    </span>
                  </label>
                  <FieldHelp text={TOOLTIPS.quoteBuilder.clientName} />
                  <input
                    id="clientName"
                    type="text"
                    className={`form-control${headerErrors.clientName ? " is-invalid" : ""}`}
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      if (e.target.value.trim())
                        setHeaderErrors((p) => ({ ...p, clientName: null }));
                    }}
                    aria-required="true"
                    aria-invalid={!!headerErrors.clientName}
                    aria-describedby={
                      headerErrors.clientName ? "clientName-error" : undefined
                    }
                  />
                  {headerErrors.clientName && (
                    <div id="clientName-error" className="invalid-feedback">
                      {headerErrors.clientName}
                    </div>
                  )}
                </div>

                <div className="col-md-6">
                  <label className="form-label" htmlFor="effectiveDate">
                    Effective Date
                  </label>
                  <FieldHelp text={TOOLTIPS.quoteBuilder.effectiveDate} />
                  <input
                    id="effectiveDate"
                    type="date"
                    className="form-control"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label" htmlFor="membershipCount">
                    Membership Count
                  </label>
                  <FieldHelp text={TOOLTIPS.quoteBuilder.membershipCount} />
                  <input
                    id="membershipCount"
                    type="number"
                    className="form-control"
                    min="0"
                    step="1"
                    value={membershipCount}
                    onChange={(e) => setMembershipCount(e.target.value)}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label" htmlFor="termLength">
                    Term (months)
                  </label>
                  <FieldHelp text={TOOLTIPS.quoteBuilder.termLength} />
                  <input
                    id="termLength"
                    type="number"
                    className="form-control"
                    min="1"
                    step="1"
                    value={termLength}
                    onChange={(e) =>
                      setTermLength(Math.max(1, Number(e.target.value)))
                    }
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label" htmlFor="annualUplift">
                    Annual Uplift %
                  </label>
                  <FieldHelp text={TOOLTIPS.quoteBuilder.annualUplift} />
                  <input
                    id="annualUplift"
                    type="number"
                    className="form-control"
                    min="0"
                    step="0.1"
                    value={annualUplift}
                    onChange={(e) =>
                      setAnnualUplift(Math.max(0, Number(e.target.value)))
                    }
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Product Line selector pills (FR-QUOTE-2) */}
          {productLines.length > 0 && (
            <section className="mb-4" aria-labelledby="line-pills-heading">
              <h2 className="h6 fw-semibold mb-2" id="line-pills-heading">
                Product Lines
              </h2>
              <div
                className="d-flex flex-wrap gap-2"
                role="group"
                aria-label="Toggle product lines"
              >
                {productLines.map((line) => {
                  const lineId = line._id.toString();
                  const isActive = activeLineIds.has(lineId);
                  return (
                    <button
                      key={lineId}
                      type="button"
                      className={`btn btn-sm${isActive ? " btn-primary" : " btn-outline-secondary"}`}
                      onClick={() => toggleProductLine(lineId)}
                      aria-pressed={isActive}
                      aria-label={`${isActive ? "Remove" : "Add"} ${line.name} product line`}
                    >
                      {line.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Product sections */}
          {activeLineIds.size > 0 ? (
            <div>
              {productLines.map((line) => renderProductLineSection(line))}
            </div>
          ) : (
            <p className="text-muted">
              Select one or more product lines above to begin adding products.
            </p>
          )}

          {/* Multi-year forecast (FR-QUOTE-13) */}
          {yearlySummary.length > 0 && (
            <MultiYearForecast yearlySummary={yearlySummary} />
          )}
        </div>

        {/* ── Right column: sticky financial summary ── */}
        <div className="col-lg-4">
          <QuoteSummaryPanel
            summary={summary}
            globalAdjType={globalAdjType}
            globalAdjDiscountType={globalAdjDiscountType}
            globalAdjValue={globalAdjValue}
            onGlobalAdjTypeChange={setGlobalAdjType}
            onGlobalAdjDiscountTypeChange={setGlobalAdjDiscountType}
            onGlobalAdjValueChange={setGlobalAdjValue}
            scopeReviewCount={scopeReviewCount}
            saving={saving}
            onSave={handleSave}
            marginPercent={margin.marginPercent}
            marginStatus={marginStatus}
          />
        </div>
      </div>

      {/* ── Product view slideout ── */}
      <OffcanvasDrawer
        open={viewOpen}
        title={viewProduct?.name ?? ""}
        onClose={() => setViewOpen(false)}
      >
        {viewProduct && (
          <dl className="row mb-0 small">
            <dt className="col-5">SKU</dt>
            <dd className="col-7 font-monospace">{viewProduct.sku || "—"}</dd>

            <dt className="col-5">Product Line</dt>
            <dd className="col-7">
              {typeof viewProduct.productLineId === "object" &&
              viewProduct.productLineId !== null
                ? (viewProduct.productLineId.name ?? "—")
                : (productLines.find(
                    (l) =>
                      l._id?.toString() ===
                      viewProduct.productLineId?.toString(),
                  )?.name ?? "—")}
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

            <dt className="col-5">Impl. Fee</dt>
            <dd className="col-7">
              {viewProduct.implementationFee != null
                ? `$${Number(viewProduct.implementationFee).toFixed(2)}`
                : "—"}
            </dd>

            {viewProduct.tiers && viewProduct.tiers.length > 0 && (
              <>
                <dt className="col-5">Tiers</dt>
                <dd className="col-7">
                  <ul className="list-unstyled mb-0">
                    {viewProduct.tiers.map((t, i) => (
                      <li key={i}>
                        &ge;&nbsp;{t.min}&nbsp;&rarr;&nbsp;$
                        {Number(t.price).toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </dd>
              </>
            )}

            {viewProduct.volumeBands && viewProduct.volumeBands.length > 0 && (
              <>
                <dt className="col-5">Volume Bands</dt>
                <dd className="col-7">
                  <ul className="list-unstyled mb-0">
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
        )}
      </OffcanvasDrawer>
    </div>
  );
}
