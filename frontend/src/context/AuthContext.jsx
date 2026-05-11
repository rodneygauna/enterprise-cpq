import { createContext, useState, useEffect } from "react";
import api from "../api/axios";

export const AuthContext = createContext(null);

/**
 * Provides authentication state and helpers to the component tree.
 *
 * On mount it calls GET /api/auth/me to restore an existing session from the
 * httpOnly cookie without exposing the token to JavaScript.
 * Renders nothing while the initial session check is in progress to avoid
 * flashes of unauthenticated content.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => setUser(res.data.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  /** Call after a successful login or register API response. */
  const login = (userData) => setUser(userData);

  /** Calls logout API and clears local state. */
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Best-effort logout — clear state regardless
    }
    setUser(null);
  };

  // Block rendering until the initial session check completes.
  // Replace with a full-page spinner for a better UX if preferred.
  if (loading) return null;

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
