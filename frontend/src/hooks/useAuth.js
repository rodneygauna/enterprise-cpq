import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

/**
 * Returns the AuthContext value: { user, isAuthenticated, login, logout }.
 * Must be used inside an <AuthProvider> ancestor.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
