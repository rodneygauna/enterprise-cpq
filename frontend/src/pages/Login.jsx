import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import api from "../api/axios";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post("/auth/login", form);
      login(res.data.data);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error ?? "Login failed. Please try again.");
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
          <h2 className="h5 mb-4 text-center">Sign in to Enterprise CPQ</h2>

          {/* Live region so screen readers announce auth errors */}
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
                name="email"
                className="form-control"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                className="form-control"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
              <div className="text-end mt-1">
                <Link to="/forgot-password" className="small">
                  Forgot password?
                </Link>
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
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <i
                    className="bi bi-box-arrow-in-right me-2"
                    aria-hidden="true"
                  />
                  Sign in
                </>
              )}
            </button>
          </form>

          <hr className="my-3" />

          {/* Full-page redirect — not an Axios call — because OAuth requires browser navigation */}
          <a
            href="/api/auth/salesforce"
            className="btn btn-outline-secondary w-100"
          >
            Sign in with Salesforce
          </a>

          <p className="text-center mt-3 mb-0 small">
            Don&apos;t have an account? <Link to="/register">Create one</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
