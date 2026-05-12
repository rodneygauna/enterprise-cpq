import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post("/auth/forgot-password", { email });
      // Always show success regardless of whether the email exists —
      // mirrors the backend's anti-enumeration behaviour.
      setSubmitted(true);
    } catch (err) {
      setError(
        err.response?.data?.error ?? "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
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
            <h2 className="h4 mb-3">Check your email</h2>
            <p className="text-muted">
              If an account exists for <strong>{email}</strong>, we&apos;ve sent
              a password reset link. The link expires in 1 hour.
            </p>
            <Link to="/login" className="btn btn-outline-primary mt-2">
              <i className="bi bi-arrow-left me-2" aria-hidden="true" />
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

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
          <h2 className="h4 mb-1">Reset your password</h2>
          <p className="text-muted small mb-4">
            Enter your email and we&apos;ll send you a reset link.
          </p>

          {error && (
            <div className="alert alert-danger" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <input
                id="email"
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
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
                  <span>Sending…</span>
                </>
              ) : (
                <>
                  <i className="bi bi-envelope me-2" aria-hidden="true" />
                  Send reset link
                </>
              )}
            </button>
          </form>

          <p className="text-center mt-3 mb-0 small">
            <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
