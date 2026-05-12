import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useBranding } from "../context/BrandingContext";

/**
 * Root layout: accessible top navigation bar + main content area.
 * Renders only when the user is authenticated (wrapped by ProtectedRoute).
 *
 * Navigation adapts to the current user's role:
 *   - All roles:   Dashboard
 *   - super_admin: Settings
 */
export default function Layout() {
  const { user, logout } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <>
      {/* Skip-to-content link — keyboard / screen-reader requirement (WCAG 2.4.1) */}
      <a href="#main-content" className="visually-hidden-focusable">
        Skip to main content
      </a>

      <header>
        <nav
          className="navbar navbar-expand-lg navbar-dark bg-primary"
          aria-label="Main navigation"
        >
          <div className="container-fluid">
            <span className="navbar-brand fw-bold">{branding.companyName}</span>

            <button
              className="navbar-toggler"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#main-nav"
              aria-controls="main-nav"
              aria-expanded="false"
              aria-label="Toggle navigation"
            >
              <span className="navbar-toggler-icon" aria-hidden="true" />
            </button>

            <div className="collapse navbar-collapse" id="main-nav">
              <ul className="navbar-nav me-auto mb-2 mb-lg-0" role="list">
                <li className="nav-item">
                  <NavLink
                    to="/"
                    end
                    className={({ isActive }) =>
                      "nav-link" + (isActive ? " active" : "")
                    }
                    aria-current={({ isActive }) =>
                      isActive ? "page" : undefined
                    }
                  >
                    Dashboard
                  </NavLink>
                </li>

                <li className="nav-item">
                  <NavLink
                    to="/quotes"
                    className={({ isActive }) =>
                      "nav-link" + (isActive ? " active" : "")
                    }
                    aria-current={({ isActive }) =>
                      isActive ? "page" : undefined
                    }
                  >
                    Quotes
                  </NavLink>
                </li>

                {["admin", "super_admin"].includes(user?.role) && (
                  <>
                    <li className="nav-item">
                      <NavLink
                        to="/admin/product-lines"
                        className={({ isActive }) =>
                          "nav-link" + (isActive ? " active" : "")
                        }
                        aria-current={({ isActive }) =>
                          isActive ? "page" : undefined
                        }
                      >
                        Product Lines
                      </NavLink>
                    </li>
                    <li className="nav-item">
                      <NavLink
                        to="/admin/products"
                        className={({ isActive }) =>
                          "nav-link" + (isActive ? " active" : "")
                        }
                        aria-current={({ isActive }) =>
                          isActive ? "page" : undefined
                        }
                      >
                        Products
                      </NavLink>
                    </li>
                    <li className="nav-item">
                      <NavLink
                        to="/admin/users"
                        className={({ isActive }) =>
                          "nav-link" + (isActive ? " active" : "")
                        }
                        aria-current={({ isActive }) =>
                          isActive ? "page" : undefined
                        }
                      >
                        Users
                      </NavLink>
                    </li>
                  </>
                )}

                {user?.role === "super_admin" && (
                  <li className="nav-item">
                    <NavLink
                      to="/settings"
                      className={({ isActive }) =>
                        "nav-link" + (isActive ? " active" : "")
                      }
                      aria-current={({ isActive }) =>
                        isActive ? "page" : undefined
                      }
                    >
                      Settings
                    </NavLink>
                  </li>
                )}
              </ul>

              <ul className="navbar-nav ms-auto" role="list">
                <li className="nav-item d-flex align-items-center">
                  <span className="nav-link text-light" aria-live="polite">
                    {user?.firstName} {user?.lastName}
                  </span>
                </li>
                <li className="nav-item">
                  <button
                    className="btn btn-outline-light btn-sm ms-2"
                    onClick={handleLogout}
                  >
                    Sign out
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </nav>
      </header>

      <main id="main-content">
        <Outlet />
      </main>
    </>
  );
}
