/**
 * QuoteDashboard — §7.6 Quote History Dashboard.
 *
 * FR-DASH-1: Table scoped by role (sales_rep → own; all others → all)
 * FR-DASH-2: Columns: Client Name, Created, Product Lines, Members, Net TCV,
 *            Status, Actions (Open, Copy, Delete)
 * FR-DASH-3: Summary stats cards + two Recharts bar charts
 *            (Count by Product Line, Net TCV by Product Line)
 * FR-DASH-4: Filter bar: client name, date range, status, product line
 */
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { useAuth } from "../hooks/useAuth";
import {
  getQuotes,
  getQuoteStats,
  deleteQuote,
  duplicateQuote,
  submitQuote,
} from "../api/quotes";
import { getProductLines } from "../api/productLines";

// ── Formatters ────────────────────────────────────────────────────────────────
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return DATE_FMT.format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── Status badge helper ───────────────────────────────────────────────────────
const STATUS_CLASSES = {
  Draft: "secondary",
  "Manager Review": "warning text-dark",
  "Executive Review": "info text-dark",
  Approved: "success",
  Rejected: "danger",
};

function StatusBadge({ status }) {
  const cls = STATUS_CLASSES[status] ?? "secondary";
  return <span className={`badge bg-${cls}`}>{status}</span>;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function QuoteDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [quotes, setQuotes] = useState([]);
  const [stats, setStats] = useState(null);
  const [productLines, setProductLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Pagination ────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  // ── Filters (FR-DASH-4) ───────────────────────────────────────────────────
  const [filterClientName, setFilterClientName] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProductLine, setFilterProductLine] = useState("");

  // Applied filters (submitted via the Filter button)
  const [appliedFilters, setAppliedFilters] = useState({});

  // ── Delete modal (FR-DASH-2) ──────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null); // quote object
  const [deleting, setDeleting] = useState(false);

  // ── Submitting state ──────────────────────────────────────────────────────
  const [submittingId, setSubmittingId] = useState(null);

  // ── Load product lines once for filter dropdown ───────────────────────────
  useEffect(() => {
    getProductLines()
      .then(setProductLines)
      .catch(() => {});
  }, []);

  // ── Load stats (FR-DASH-3) ────────────────────────────────────────────────
  const loadStats = useCallback(() => {
    setStatsLoading(true);
    getQuoteStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // ── Load quotes (FR-DASH-1 / FR-DASH-4) ──────────────────────────────────
  const loadQuotes = useCallback((filters = {}, pg = 1) => {
    setLoading(true);
    setError(null);
    const params = { page: pg, limit: LIMIT, ...filters };
    getQuotes(params)
      .then((res) => {
        setQuotes(res.data ?? []);
        setTotal(res.meta?.total ?? 0);
        setPage(res.meta?.page ?? 1);
      })
      .catch((err) => {
        setError(
          err?.response?.data?.error ??
            "Failed to load quotes. Please try again.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadQuotes(appliedFilters, 1);
  }, [appliedFilters, loadQuotes]);

  // ── Filter handlers ───────────────────────────────────────────────────────
  function handleApplyFilters(e) {
    e.preventDefault();
    const filters = {};
    if (filterClientName.trim()) filters.clientName = filterClientName.trim();
    if (filterDateFrom) filters.dateFrom = filterDateFrom;
    if (filterDateTo) filters.dateTo = filterDateTo;
    if (filterStatus) filters.status = filterStatus;
    if (filterProductLine) filters.productLineId = filterProductLine;
    setAppliedFilters(filters);
  }

  function handleClearFilters() {
    setFilterClientName("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterStatus("");
    setFilterProductLine("");
    setAppliedFilters({});
  }

  // ── Pagination handler ────────────────────────────────────────────────────
  function handlePageChange(newPage) {
    loadQuotes(appliedFilters, newPage);
  }

  // ── Copy (duplicate) action ───────────────────────────────────────────────
  async function handleCopy(quoteId) {
    try {
      const copy = await duplicateQuote(quoteId);
      toast.success("Quote duplicated.");
      navigate(`/quotes/${copy._id}`);
    } catch {
      toast.error("Failed to duplicate quote.");
    }
  }

  // ── Delete flow ───────────────────────────────────────────────────────────
  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteQuote(deleteTarget._id);
      toast.success("Quote deleted.");
      setDeleteTarget(null);
      loadQuotes(appliedFilters, page);
      loadStats();
    } catch {
      toast.error("Failed to delete quote.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Submit for approval flow ──────────────────────────────────────────────
  async function handleSubmit(quote) {
    setSubmittingId(quote._id);
    try {
      const updated = await submitQuote(quote._id);
      const newStatus = updated.status;
      if (newStatus === "Approved") {
        toast.success(`"${quote.clientName}" was auto-approved.`);
      } else {
        toast.success(`"${quote.clientName}" submitted for ${newStatus}.`);
      }
      loadQuotes(appliedFilters, page);
      loadStats();
    } catch (err) {
      toast.error(err?.response?.data?.error ?? "Failed to submit quote.");
    } finally {
      setSubmittingId(null);
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="container-fluid py-4">
      {/* Page header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h1 className="h3 mb-0">Quote Dashboard</h1>
        <Link to="/quotes/new" className="btn btn-primary btn-sm">
          <i className="bi bi-plus-lg me-2" aria-hidden="true" />
          New Quote
        </Link>
      </div>

      {/* ── Stats cards (FR-DASH-3) ── */}
      <section aria-labelledby="stats-heading" className="mb-4">
        <h2 className="visually-hidden" id="stats-heading">
          Summary Statistics
        </h2>
        <div className="row g-3 mb-4">
          <div className="col-sm-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <p className="text-muted small mb-1">Total Quotes</p>
                {statsLoading ? (
                  <div
                    className="placeholder-glow"
                    aria-label="Loading total quotes"
                  >
                    <span className="placeholder col-6" />
                  </div>
                ) : (
                  <p className="h3 fw-bold mb-0">{stats?.totalQuotes ?? 0}</p>
                )}
              </div>
            </div>
          </div>
          <div className="col-sm-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <p className="text-muted small mb-1">Total Pipeline</p>
                {statsLoading ? (
                  <div
                    className="placeholder-glow"
                    aria-label="Loading total pipeline"
                  >
                    <span className="placeholder col-8" />
                  </div>
                ) : (
                  <p className="h3 fw-bold mb-0">
                    {USD.format(stats?.totalPipeline ?? 0)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bar charts */}
        {!statsLoading &&
          stats &&
          (stats.byLineCount.length > 0 || stats.byLineTCV.length > 0) && (
            <div className="row g-3">
              {stats.byLineCount.length > 0 && (
                <div className="col-lg-6">
                  <div className="card border-0 shadow-sm">
                    <div className="card-body">
                      <h3 className="h6 fw-semibold mb-3">
                        Quotes by Product Line
                      </h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={stats.byLineCount}
                          margin={{ top: 5, right: 10, left: 0, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12 }}
                            angle={-35}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip
                            formatter={(v) => [v, "Quotes"]}
                            labelFormatter={(l) => `Line: ${l}`}
                          />
                          <Bar dataKey="count" fill="var(--bs-primary)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
              {stats.byLineTCV.length > 0 && (
                <div className="col-lg-6">
                  <div className="card border-0 shadow-sm">
                    <div className="card-body">
                      <h3 className="h6 fw-semibold mb-3">
                        Net TCV by Product Line
                      </h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={stats.byLineTCV}
                          margin={{ top: 5, right: 10, left: 40, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12 }}
                            angle={-35}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis
                            tick={{ fontSize: 12 }}
                            tickFormatter={(v) =>
                              v >= 1_000_000
                                ? `$${(v / 1_000_000).toFixed(1)}M`
                                : v >= 1_000
                                  ? `$${(v / 1_000).toFixed(0)}K`
                                  : `$${v}`
                            }
                          />
                          <Tooltip
                            formatter={(v) => [USD.format(v), "Net TCV"]}
                            labelFormatter={(l) => `Line: ${l}`}
                          />
                          <Bar dataKey="totalTCV" fill="var(--bs-success)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
      </section>

      {/* ── Filters (FR-DASH-4) ── */}
      <section aria-labelledby="filters-heading" className="mb-3">
        <h2 className="visually-hidden" id="filters-heading">
          Quote Filters
        </h2>
        <form
          onSubmit={handleApplyFilters}
          className="card border-0 shadow-sm"
          aria-label="Filter quotes"
        >
          <div className="card-body">
            <div className="row g-2 align-items-end">
              <div className="col-md-3">
                <label
                  className="form-label small mb-1"
                  htmlFor="filterClientName"
                >
                  Client Name
                </label>
                <input
                  id="filterClientName"
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="Search client…"
                  value={filterClientName}
                  onChange={(e) => setFilterClientName(e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <label
                  className="form-label small mb-1"
                  htmlFor="filterDateFrom"
                >
                  From
                </label>
                <input
                  id="filterDateFrom"
                  type="date"
                  className="form-control form-control-sm"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1" htmlFor="filterDateTo">
                  To
                </label>
                <input
                  id="filterDateTo"
                  type="date"
                  className="form-control form-control-sm"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1" htmlFor="filterStatus">
                  Status
                </label>
                <select
                  id="filterStatus"
                  className="form-select form-select-sm"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Manager Review">Manager Review</option>
                  <option value="Executive Review">Executive Review</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div className="col-md-2">
                <label
                  className="form-label small mb-1"
                  htmlFor="filterProductLine"
                >
                  Product Line
                </label>
                <select
                  id="filterProductLine"
                  className="form-select form-select-sm"
                  value={filterProductLine}
                  onChange={(e) => setFilterProductLine(e.target.value)}
                >
                  <option value="">All Lines</option>
                  {productLines.map((line) => (
                    <option key={line._id} value={line._id}>
                      {line.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-1 d-flex gap-1">
                <button type="submit" className="btn btn-primary btn-sm w-100">
                  <i className="bi bi-funnel me-1" aria-hidden="true" />
                  Filter
                </button>
              </div>
            </div>
            {Object.keys(appliedFilters).length > 0 && (
              <div className="mt-2">
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-muted"
                  onClick={handleClearFilters}
                >
                  <i className="bi bi-x-circle me-1" aria-hidden="true" />
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </form>
      </section>

      {/* ── Quotes table (FR-DASH-1 / FR-DASH-2) ── */}
      <section aria-labelledby="quotes-table-heading">
        <h2 className="visually-hidden" id="quotes-table-heading">
          Quotes
        </h2>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div
            className="d-flex justify-content-center py-5"
            role="status"
            aria-label="Loading quotes"
          >
            <div className="spinner-border" aria-hidden="true" />
            <span className="visually-hidden">Loading…</span>
          </div>
        ) : quotes.length === 0 ? (
          <div className="text-muted text-center py-5">
            {Object.keys(appliedFilters).length > 0
              ? "No quotes match your filters."
              : "No quotes yet. Create your first quote to get started."}
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th scope="col">Client Name</th>
                    <th scope="col">Created</th>
                    <th scope="col">Product Lines</th>
                    <th scope="col" className="text-end">
                      Members
                    </th>
                    <th scope="col" className="text-end">
                      Net TCV
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((quote) => (
                    <tr key={quote._id}>
                      <td>
                        <Link
                          to={`/quotes/${quote._id}`}
                          className="fw-semibold text-decoration-none"
                        >
                          {quote.clientName}
                        </Link>
                      </td>
                      <td className="text-muted small">
                        {formatDate(quote.createdAt)}
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {(quote.activeProductLineIds ?? []).map((line) => (
                            <span
                              key={line._id ?? line}
                              className="badge"
                              style={{
                                backgroundColor:
                                  line.displayColor ?? "var(--bs-secondary)",
                                color: "#fff",
                                fontSize: "0.7rem",
                              }}
                            >
                              {line.name ?? line}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-end">
                        {quote.membershipCount
                          ? quote.membershipCount.toLocaleString()
                          : "—"}
                      </td>
                      <td className="text-end fw-semibold">
                        {USD.format(quote.netTCV ?? 0)}
                      </td>
                      <td>
                        <StatusBadge status={quote.status} />
                      </td>
                      <td>
                        <div className="d-flex gap-1 justify-content-end">
                          <Link
                            to={`/quotes/${quote._id}`}
                            className="btn btn-outline-primary btn-sm"
                            aria-label={`Open quote for ${quote.clientName}`}
                          >
                            <i
                              className="bi bi-folder2-open me-1"
                              aria-hidden="true"
                            />
                            Open
                          </Link>
                          {quote.status === "Draft" && (
                            <button
                              type="button"
                              className="btn btn-outline-success btn-sm"
                              onClick={() => handleSubmit(quote)}
                              disabled={submittingId === quote._id}
                              aria-label={`Submit quote for ${quote.clientName}`}
                            >
                              {submittingId === quote._id ? (
                                "Submitting…"
                              ) : (
                                <>
                                  <i
                                    className="bi bi-send me-1"
                                    aria-hidden="true"
                                  />
                                  Submit
                                </>
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => handleCopy(quote._id)}
                            aria-label={`Copy quote for ${quote.clientName}`}
                          >
                            <i className="bi bi-copy me-1" aria-hidden="true" />
                            Copy
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => setDeleteTarget(quote)}
                            aria-label={`Delete quote for ${quote.clientName}`}
                          >
                            <i
                              className="bi bi-trash3 me-1"
                              aria-hidden="true"
                            />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav
                aria-label="Quote list pagination"
                className="d-flex justify-content-between align-items-center mt-3"
              >
                <p className="text-muted small mb-0">
                  Showing {(page - 1) * LIMIT + 1}–
                  {Math.min(page * LIMIT, total)} of {total}
                </p>
                <ul className="pagination pagination-sm mb-0">
                  <li className={`page-item${page <= 1 ? " disabled" : ""}`}>
                    <button
                      className="page-link"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                      aria-label="Previous page"
                    >
                      ‹
                    </button>
                  </li>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const pg =
                      totalPages <= 7
                        ? i + 1
                        : page <= 4
                          ? i + 1
                          : page >= totalPages - 3
                            ? totalPages - 6 + i
                            : page - 3 + i;
                    return (
                      <li
                        key={pg}
                        className={`page-item${pg === page ? " active" : ""}`}
                      >
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(pg)}
                          aria-label={`Page ${pg}`}
                          aria-current={pg === page ? "page" : undefined}
                        >
                          {pg}
                        </button>
                      </li>
                    );
                  })}
                  <li
                    className={`page-item${page >= totalPages ? " disabled" : ""}`}
                  >
                    <button
                      className="page-link"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages}
                      aria-label="Next page"
                    >
                      ›
                    </button>
                  </li>
                </ul>
              </nav>
            )}
          </>
        )}
      </section>

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div
          className="modal d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title h5" id="delete-modal-title">
                  Delete Quote
                </h2>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close delete confirmation"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                />
              </div>
              <div className="modal-body">
                <p>
                  Delete the quote for{" "}
                  <strong>{deleteTarget.clientName}</strong>? This action cannot
                  be undone.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  <i className="bi bi-x-lg me-2" aria-hidden="true" />
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  aria-busy={deleting}
                >
                  {deleting ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        aria-hidden="true"
                      />
                      Deleting…
                    </>
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
    </div>
  );
}
