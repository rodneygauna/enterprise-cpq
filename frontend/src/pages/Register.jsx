import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import api from "../api/axios";

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      const res = await api.post("/auth/register", form);
      login(res.data.data);
      navigate("/");
    } catch (err) {
      if (err.response?.data?.errors) {
        const mapped = {};
        err.response.data.errors.forEach((e) => {
          mapped[e.path] = e.msg;
        });
        setFieldErrors(mapped);
      } else {
        setError(
          err.response?.data?.error ?? "Registration failed. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const fieldProps = (name) => ({
    id: name,
    name,
    className: `form-control${fieldErrors[name] ? " is-invalid" : ""}`,
    value: form[name],
    onChange: handleChange,
    "aria-describedby": fieldErrors[name] ? `${name}-error` : undefined,
    "aria-invalid": fieldErrors[name] ? true : undefined,
  });

  return (
    <main
      id="main-content"
      className="d-flex align-items-center justify-content-center min-vh-100 bg-light"
    >
      <div
        className="card shadow-sm"
        style={{ width: "100%", maxWidth: "500px" }}
      >
        <div className="cpq-auth-header">
          <h1>Enterprise CPQ</h1>
        </div>
        <div className="card-body p-4">
          <h2 className="h5 mb-4 text-center">Create your account</h2>

          {error && (
            <div className="alert alert-danger" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="row">
              {/* First name */}
              <div className="col-sm-6 mb-3">
                <label htmlFor="firstName" className="form-label">
                  First name
                </label>
                <input
                  {...fieldProps("firstName")}
                  type="text"
                  autoComplete="given-name"
                  required
                />
                {fieldErrors.firstName && (
                  <div id="firstName-error" className="invalid-feedback">
                    {fieldErrors.firstName}
                  </div>
                )}
              </div>

              {/* Last name */}
              <div className="col-sm-6 mb-3">
                <label htmlFor="lastName" className="form-label">
                  Last name
                </label>
                <input
                  {...fieldProps("lastName")}
                  type="text"
                  autoComplete="family-name"
                  required
                />
                {fieldErrors.lastName && (
                  <div id="lastName-error" className="invalid-feedback">
                    {fieldErrors.lastName}
                  </div>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="mb-3">
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <input
                {...fieldProps("email")}
                type="email"
                autoComplete="email"
                required
              />
              {fieldErrors.email && (
                <div id="email-error" className="invalid-feedback">
                  {fieldErrors.email}
                </div>
              )}
            </div>

            {/* Password */}
            <div className="mb-4">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                {...fieldProps("password")}
                type="password"
                autoComplete="new-password"
                aria-describedby={`password-hint${fieldErrors.password ? " password-error" : ""}`}
                required
              />
              <div id="password-hint" className="form-text">
                At least 8 characters.
              </div>
              {fieldErrors.password && (
                <div id="password-error" className="invalid-feedback">
                  {fieldErrors.password}
                </div>
              )}
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
                  <span>Creating account…</span>
                </>
              ) : (
                <>
                  <i className="bi bi-person-check me-2" aria-hidden="true" />
                  Create account
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
