import { useState, useEffect } from "react";

const STORAGE_KEY = "cpq-sidebar-collapsed";

/**
 * Persistent sidebar-collapsed toggle.
 * Reads from localStorage on mount and persists the preference across
 * page loads, matching the same pattern as useDarkMode.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "true",
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "true" : "false");
  }, [collapsed]);

  return { collapsed, toggle: () => setCollapsed((prev) => !prev) };
}
