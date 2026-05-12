import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Guard: no token in URL means the link is invalid or was not followed correctly.
  if (!token) {
    return (
      <main
        id="main-content"
        className="d-flex align-items-center justify-content-center min-vh-100 bg-light"
      >
        <div
          className="card shadow-sm"
          style={{ width: "100%", maxWidth: "420px" }}
        >
          <div className="cpq-auth-header">
            <h1>Enterprise CPQ</h1>
          </div>
          <div className="card-body p-4 text-center">
            <h2 className="h4 mb-3">Invalid reset link</h2>
            <p className="text-muted">
              This password reset link is invalid or has expired.
            </p>
            <Link to="/forgot-password" className="btn btn-primary">
              <i className="bi bi-envelope me-2" aria-hidden="true" />
              Request a new link
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post("/auth/reset-password", { token, password });
      navigate("/login?reset=success");
    } catch (err) {
      setError(
        err.response?.data?.error ??
          "Failed to reset your password. The link may have expired.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      id="main-content"
      className="d-flex align-items-center justify-content-center min-vh-100 bg-light"
    >
      <div
        className="card shadow-sm"
        style={{ width: "100%", maxWidth: "420px" }}
      >
        <div className="cpq-auth-header">
          <h1>Enterprise CPQ</h1>
        </div>
        <div className="card-body p-4">
          <h2 className="h4 mb-4">Set new password</h2>

          {error && (
            <div className="alert alert-danger" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4">
              <label htmlFor="password" className="form-label">
                New password
              </label>
              <input
                id="password"
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                aria-describedby="password-hint"
                required
              />
              <div id="password-hint" className="form-text">
                At least 8 characters.
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                  />
                  <span>Updating password…</span>
                </>
              ) : (
                <>
                  <i className="bi bi-check-lg me-2" aria-hidden="true" />
                  Update password
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
