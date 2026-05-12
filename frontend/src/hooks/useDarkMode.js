import { useState, useEffect } from "react";

const STORAGE_KEY = "cpq-theme";

/**
 * Persistent dark-mode toggle.
 * Reads from localStorage on mount, applies `data-bs-theme` attribute to
 * <html>, and persists preference across page loads.
 */
export function useDarkMode() {
  const [isDark, setIsDark] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "dark",
  );

  useEffect(() => {
    const theme = isDark ? "dark" : "light";
    document.documentElement.setAttribute("data-bs-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((prev) => !prev) };
}
