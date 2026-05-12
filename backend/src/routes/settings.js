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
// super_admin only — upserts branding fields.
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

// ── PUT /api/settings/discount ────────────────────────────────────────────────
// admin / super_admin — configure discount thresholds and volume discount rules.
router.put(
  "/discount",
  authenticate,
  requireRole(["admin", "super_admin"]),
  [
    body("discountThresholds.managerReviewPercent")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("managerReviewPercent must be 0–100"),
    body("discountThresholds.executiveReviewPercent")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("executiveReviewPercent must be 0–100"),
    body("volumeDiscountRules")
      .optional()
      .isArray()
      .withMessage("volumeDiscountRules must be an array"),
    body("volumeDiscountRules.*.membersThreshold")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("membersThreshold must be a non-negative number"),
    body("volumeDiscountRules.*.discountPercent")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("discountPercent must be 0–100"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const ALLOWED = ["discountThresholds", "volumeDiscountRules"];
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
