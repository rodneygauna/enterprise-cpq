import { createContext, useContext, useEffect, useState } from "react";
import { getSettings } from "../api/settings";

const DEFAULTS = {
  companyName: "Enterprise CPQ",
  logoUrl: null,
};

export const BrandingContext = createContext({
  branding: DEFAULTS,
  setBranding: () => {},
});

/**
 * Fetches branding settings on mount and makes them available via context.
 * Company Name and Logo are the only configurable brand identity fields.
 *
 * GET /api/settings is a public endpoint — this context works even before login.
 */
export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULTS);

  useEffect(() => {
    getSettings()
      .then((settings) => {
        setBranding({
          companyName: settings.companyName ?? DEFAULTS.companyName,
          logoUrl: settings.logoUrl ?? null,
        });
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
