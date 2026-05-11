import { createContext, useContext, useEffect, useState } from "react";
import { getSettings } from "../api/settings";

/**
 * Converts a 6-digit hex color string to a comma-separated RGB string
 * suitable for Bootstrap 5's `--bs-*-rgb` CSS custom properties.
 *
 * Bootstrap 5.2+ utility classes (bg-primary, btn-primary, etc.) use:
 *   background-color: rgba(var(--bs-primary-rgb), var(--bs-bg-opacity));
 * so both --bs-primary and --bs-primary-rgb must be set for full coverage.
 *
 * @param {string} hex - e.g. "#198754"
 * @returns {string|null} e.g. "25, 135, 84"
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

/** Sets both the hex and RGB CSS custom properties for a Bootstrap color token. */
function applyBsColor(token, hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  document.documentElement.style.setProperty(`--bs-${token}`, hex);
  document.documentElement.style.setProperty(`--bs-${token}-rgb`, rgb);
}

const DEFAULTS = {
  companyName: "Enterprise CPQ",
  primaryColor: "#0d6efd",
  accentColor: "#6c757d",
  logoUrl: null,
};

export const BrandingContext = createContext({
  branding: DEFAULTS,
  setBranding: () => {},
});

/**
 * Fetches branding settings on mount and injects CSS custom properties so
 * Bootstrap utility classes automatically pick up the brand colors at runtime.
 *
 * Applied properties:
 *   --bs-primary   → settings.primaryColor
 *   --bs-secondary → settings.accentColor
 *
 * GET /api/settings is a public endpoint — this context works even before login.
 */
export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULTS);

  useEffect(() => {
    getSettings()
      .then((settings) => {
        const updated = {
          companyName: settings.companyName ?? DEFAULTS.companyName,
          primaryColor: settings.primaryColor ?? DEFAULTS.primaryColor,
          accentColor: settings.accentColor ?? DEFAULTS.accentColor,
          logoUrl: settings.logoUrl ?? null,
        };
        setBranding(updated);
        applyBsColor("primary", updated.primaryColor);
        applyBsColor("secondary", updated.accentColor);
      })
      .catch(() => {
        // Network failure — keep defaults; branding is non-critical
      });
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, setBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
