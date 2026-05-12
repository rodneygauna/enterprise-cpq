import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../hooks/useAuth";

export default function AcceptInvite() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("invite");
  const prefillEmail = searchParams.get("email") ?? "";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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
            <h2 className="h4 mb-3">Invalid invitation link</h2>
            <p className="text-muted">
              This invitation link is invalid or has expired.
            </p>
            <Link to="/login" className="btn btn-primary">
              <i className="bi bi-box-arrow-in-right me-2" aria-hidden="true" />
              Go to sign in
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
      const res = await api.post("/auth/accept-invite", {
        token,
        password,
        firstName,
        lastName,
      });
      login(res.data.data);
      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.error ??
          "Failed to accept invitation. The link may have expired.",
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
          <h2 className="h4 mb-1">Accept your invitation</h2>
          {prefillEmail && (
            <p className="text-muted small mb-3">
              Setting up account for <strong>{prefillEmail}</strong>
            </p>
          )}

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="row g-2 mb-3">
              <div className="col">
                <label htmlFor="firstName" className="form-label">
                  First name
                </label>
                <input
                  id="firstName"
                  type="text"
                  className="form-control"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                  autoFocus
                />
              </div>
              <div className="col">
                <label htmlFor="lastName" className="form-label">
                  Last name
                </label>
                <input
                  id="lastName"
                  type="text"
                  className="form-control"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="mb-3">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <div className="form-text">Minimum 8 characters.</div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                "Setting up account…"
              ) : (
                <>
                  <i className="bi bi-person-check me-2" aria-hidden="true" />
                  Accept invitation
                </>
              )}
            </button>
          </form>

          <p className="text-center mt-3 mb-0 small">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
