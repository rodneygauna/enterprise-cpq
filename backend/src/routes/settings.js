const router = require("express").Router();
const { body } = require("express-validator");

const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const { getSettings, updateSettings } = require("../services/settingsService");

// ── GET /api/settings ─────────────────────────────────────────────────────────
// Public — no authentication required.
// Returns current settings or creates defaults on first call.
// Used by the frontend to bootstrap brand colors before the user logs in.
router.get("/", async (req, res, next) => {
  try {
    const settings = await getSettings();
    res.json({ data: settings, error: null, meta: null });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/settings ─────────────────────────────────────────────────────────
// super_admin only — upserts the singleton settings document.
router.put(
  "/",
  authenticate,
  requireRole(["super_admin"]),
  [
    body("companyName")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("Company name cannot be blank"),
    body("logoUrl").optional().isString(),
    body("primaryColor")
      .optional()
      .matches(/^#[0-9a-fA-F]{6}$/)
      .withMessage(
        "primaryColor must be a valid 6-digit hex color (e.g. #0d6efd)",
      ),
    body("accentColor")
      .optional()
      .matches(/^#[0-9a-fA-F]{6}$/)
      .withMessage(
        "accentColor must be a valid 6-digit hex color (e.g. #6c757d)",
      ),
  ],
  validate,
  async (req, res, next) => {
    try {
      // Only allow branding fields to be updated via this endpoint.
      // Phase 2/3 config fields (discountThresholds, salesforceConfig, etc.)
      // will be exposed via their own dedicated endpoints in future phases.
      const ALLOWED = ["companyName", "logoUrl", "primaryColor", "accentColor"];
      const fields = Object.fromEntries(
        Object.entries(req.body).filter(([k]) => ALLOWED.includes(k)),
      );
      const settings = await updateSettings(fields);
      res.json({ data: settings, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
