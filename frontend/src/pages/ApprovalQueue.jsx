/**
 * ApprovalQueue — §7.8 FR-DISC-4.
 *
 * Shows all quotes in "Manager Review" or "Executive Review" to approvers.
 * Provides Approve / Reject actions with an optional comment.
 *
 * Accessible to: sales_manager, executive, admin, super_admin
 */
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { getApprovalQueue, approveQuote, rejectQuote } from "../api/quotes";
import RequireRole from "../components/RequireRole";

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

const STATUS_CLASSES = {
  "Manager Review": "warning text-dark",
  "Executive Review": "info text-dark",
};

function StatusBadge({ status }) {
  const cls = STATUS_CLASSES[status] ?? "secondary";
  return <span className={`badge bg-${cls}`}>{status}</span>;
}

// ── Action modal ──────────────────────────────────────────────────────────────
function ActionModal({ quote, action, onConfirm, onCancel, processing }) {
  const [comment, setComment] = useState("");

  if (!quote) return null;

  const isApprove = action === "approve";
  const title = isApprove ? "Approve Quote" : "Reject Quote";
  const btnClass = isApprove ? "btn-success" : "btn-danger";
  const btnLabel = isApprove ? "Approve" : "Reject";

  return (
    <div
      className="modal d-block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-modal-title"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title h5" id="action-modal-title">
              {title}
            </h2>
            <button
              type="button"
              className="btn-close"
              onClick={onCancel}
              aria-label="Close"
              disabled={processing}
            />
          </div>
          <div className="modal-body">
            <p>
              <strong>Client:</strong> {quote.clientName}
            </p>
            <p>
              <strong>Net TCV:</strong> {USD.format(quote.netTCV ?? 0)}
            </p>
            <div className="mb-3">
              <label htmlFor="approval-comment" className="form-label">
                Comment{isApprove ? " (optional)" : " (optional)"}
              </label>
              <textarea
                id="approval-comment"
                className="form-control"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a note for the quote owner…"
                aria-label="Approval comment"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={processing}
            >
              <i className="bi bi-x-lg me-2" aria-hidden="true" />
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${btnClass}`}
              onClick={() => onConfirm(comment)}
              disabled={processing}
            >
              {processing ? (
                "Saving…"
              ) : isApprove ? (
                <>
                  <i className="bi bi-check-circle me-2" aria-hidden="true" />
                  Approve
                </>
              ) : (
                <>
                  <i className="bi bi-x-circle me-2" aria-hidden="true" />
                  Reject
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ApprovalQueue() {
  return (
    <RequireRole roles={["sales_manager", "executive", "admin", "super_admin"]}>
      <ApprovalQueueContent />
    </RequireRole>
  );
}

function ApprovalQueueContent() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  // Action modal state
  const [modalQuote, setModalQuote] = useState(null);
  const [modalAction, setModalAction] = useState(null); // "approve" | "reject"
  const [processing, setProcessing] = useState(false);

  const loadQueue = useCallback((pg = 1) => {
    setLoading(true);
    setError(null);
    getApprovalQueue({ page: pg, limit: LIMIT })
      .then((res) => {
        setQuotes(res.data ?? []);
        setTotal(res.meta?.total ?? 0);
        setPage(res.meta?.page ?? 1);
      })
      .catch((err) => {
        setError(
          err?.response?.data?.error ??
            "Failed to load approval queue. Please try again.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadQueue(1);
  }, [loadQueue]);

  function openModal(quote, action) {
    setModalQuote(quote);
    setModalAction(action);
  }

  function closeModal() {
    setModalQuote(null);
    setModalAction(null);
  }

  async function handleConfirm(comment) {
    if (!modalQuote || !modalAction) return;
    setProcessing(true);
    try {
      if (modalAction === "approve") {
        await approveQuote(modalQuote._id, comment);
        toast.success(`Quote "${modalQuote.clientName}" approved.`);
      } else {
        await rejectQuote(modalQuote._id, comment);
        toast.success(`Quote "${modalQuote.clientName}" rejected.`);
      }
      closeModal();
      loadQueue(page);
    } catch (err) {
      toast.error(
        err?.response?.data?.error ??
          `Failed to ${modalAction} quote. Please try again.`,
      );
    } finally {
      setProcessing(false);
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="container-fluid py-4">
      <h1 className="h3 mb-1">Approval Queue</h1>
      <p className="text-muted mb-4">
        Quotes awaiting your review and decision.
      </p>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div aria-live="polite" aria-busy="true">
          <p>Loading…</p>
        </div>
      ) : quotes.length === 0 ? (
        <div className="alert alert-info" role="status">
          No quotes are currently pending approval.
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table
              className="table table-hover align-middle"
              aria-label="Approval queue"
            >
              <thead className="table-light">
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Members</th>
                  <th scope="col">Net TCV</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q._id}>
                    <td>
                      <Link to={`/quotes/${q._id}`}>{q.clientName}</Link>
                    </td>
                    <td>{formatDate(q.updatedAt)}</td>
                    <td>
                      {q.ownerId
                        ? `${q.ownerId.firstName} ${q.ownerId.lastName}`
                        : "—"}
                    </td>
                    <td>{q.membershipCount?.toLocaleString() ?? "—"}</td>
                    <td>{USD.format(q.netTCV ?? 0)}</td>
                    <td>
                      <StatusBadge status={q.status} />
                    </td>
                    <td>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          onClick={() => openModal(q, "approve")}
                          aria-label={`Approve quote for ${q.clientName}`}
                        >
                          <i
                            className="bi bi-check-circle me-1"
                            aria-hidden="true"
                          />
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => openModal(q, "reject")}
                          aria-label={`Reject quote for ${q.clientName}`}
                        >
                          <i
                            className="bi bi-x-circle me-1"
                            aria-hidden="true"
                          />
                          Reject
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
            <nav aria-label="Approval queue pagination">
              <ul className="pagination">
                <li className={`page-item${page <= 1 ? " disabled" : ""}`}>
                  <button
                    className="page-link"
                    onClick={() => loadQueue(page - 1)}
                    disabled={page <= 1}
                    aria-label="Previous page"
                  >
                    &laquo;
                  </button>
                </li>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (pg) => (
                    <li
                      key={pg}
                      className={`page-item${pg === page ? " active" : ""}`}
                      aria-current={pg === page ? "page" : undefined}
                    >
                      <button
                        className="page-link"
                        onClick={() => loadQueue(pg)}
                      >
                        {pg}
                      </button>
                    </li>
                  ),
                )}
                <li
                  className={`page-item${page >= totalPages ? " disabled" : ""}`}
                >
                  <button
                    className="page-link"
                    onClick={() => loadQueue(page + 1)}
                    disabled={page >= totalPages}
                    aria-label="Next page"
                  >
                    &raquo;
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </>
      )}

      <ActionModal
        quote={modalQuote}
        action={modalAction}
        onConfirm={handleConfirm}
        onCancel={closeModal}
        processing={processing}
      />
    </div>
  );
}
