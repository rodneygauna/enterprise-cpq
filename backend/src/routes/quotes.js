/**
 * Quote routes — FR-QUOTE-15 (save/load), FR-QUOTE-16 (duplicate).
 *
 * All routes require a valid JWT (authenticate).
 * Service layer enforces ownership / role-based access control.
 *
 * Endpoints:
 *   GET    /api/quotes         — list (role-scoped)
 *   GET    /api/quotes/:id     — get single
 *   POST   /api/quotes         — create new quote
 *   PUT    /api/quotes/:id     — update (owner if Draft, or admin)
 *   DELETE /api/quotes/:id     — delete (owner or admin)
 *   POST   /api/quotes/:id/duplicate — copy to new Draft
 */
const router = require("express").Router();
const { body, param, query } = require("express-validator");

const { authenticate } = require("../middleware/authenticate");
const { validate } = require("../middleware/validate");
const { QUOTE_STATUSES } = require("../models/Quote");
const {
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  deleteQuote,
  duplicateQuote,
  getQuoteStats,
} = require("../services/quoteService");

// ── Shared validation ─────────────────────────────────────────────────────────
const quoteBodyRules = [
  body("clientName").notEmpty().trim().withMessage("clientName is required"),
  body("membershipCount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("membershipCount must be a non-negative number"),
  body("termLength")
    .optional()
    .isInt({ min: 1 })
    .withMessage("termLength must be a positive integer"),
  body("annualUplift")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("annualUplift must be a non-negative number"),
  body("selectedItems")
    .optional()
    .isArray()
    .withMessage("selectedItems must be an array"),
  body("status")
    .optional()
    .isIn(QUOTE_STATUSES)
    .withMessage(`status must be one of: ${QUOTE_STATUSES.join(", ")}`),
];

// PUT rules — all fields optional (defined independently to avoid mutating quoteBodyRules).
// In express-validator v7, .optional() modifies the chain in place; sharing objects
// across rule sets would corrupt the POST validation.
const quotePutRules = [
  body("clientName")
    .optional()
    .notEmpty()
    .trim()
    .withMessage("clientName cannot be empty"),
  body("membershipCount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("membershipCount must be a non-negative number"),
  body("termLength")
    .optional()
    .isInt({ min: 1 })
    .withMessage("termLength must be a positive integer"),
  body("annualUplift")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("annualUplift must be a non-negative number"),
  body("selectedItems")
    .optional()
    .isArray()
    .withMessage("selectedItems must be an array"),
  body("status")
    .optional()
    .isIn(QUOTE_STATUSES)
    .withMessage(`status must be one of: ${QUOTE_STATUSES.join(", ")}`),
];

const mongoIdParam = [param("id").isMongoId().withMessage("Invalid quote ID")];

// ── GET /api/quotes ───────────────────────────────────────────────────────────
router.get(
  "/",
  authenticate,
  [
    query("status")
      .optional()
      .isIn(QUOTE_STATUSES)
      .withMessage(`status must be one of: ${QUOTE_STATUSES.join(", ")}`),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be between 1 and 100"),
    query("dateFrom")
      .optional()
      .isISO8601()
      .withMessage("dateFrom must be a valid ISO 8601 date (YYYY-MM-DD)"),
    query("dateTo")
      .optional()
      .isISO8601()
      .withMessage("dateTo must be a valid ISO 8601 date (YYYY-MM-DD)"),
    query("productLineId")
      .optional()
      .isMongoId()
      .withMessage("productLineId must be a valid Mongo ID"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await listQuotes(req.user, req.query);
      res.json({
        data: result.quotes,
        error: null,
        meta: { page: result.page, total: result.total, limit: result.limit },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/quotes/stats ─────────────────────────────────────────────────
router.get("/stats", authenticate, async (req, res, next) => {
  try {
    const stats = await getQuoteStats(req.user);
    res.json({ data: stats, error: null, meta: null });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/quotes/:id ───────────────────────────────────────────────────────
router.get(
  "/:id",
  authenticate,
  mongoIdParam,
  validate,
  async (req, res, next) => {
    try {
      const quote = await getQuote(req.params.id, req.user);
      if (!quote) {
        return res
          .status(404)
          .json({ data: null, error: "Quote not found", meta: null });
      }
      res.json({ data: quote, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/quotes ──────────────────────────────────────────────────────────
router.post(
  "/",
  authenticate,
  quoteBodyRules,
  validate,
  async (req, res, next) => {
    try {
      const quote = await createQuote(req.body, req.user);
      res.status(201).json({ data: quote, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
);

// ── PUT /api/quotes/:id ───────────────────────────────────────────────────────
router.put(
  "/:id",
  authenticate,
  [...mongoIdParam, ...quotePutRules],
  validate,
  async (req, res, next) => {
    try {
      const result = await updateQuote(req.params.id, req.body, req.user);
      if (!result) {
        return res
          .status(404)
          .json({ data: null, error: "Quote not found", meta: null });
      }
      if (result.forbidden) {
        return res
          .status(403)
          .json({ data: null, error: "Forbidden", meta: null });
      }
      if (result.badRequest) {
        return res
          .status(400)
          .json({ data: null, error: result.badRequest, meta: null });
      }
      res.json({ data: result, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
);

// ── DELETE /api/quotes/:id ────────────────────────────────────────────────────
router.delete(
  "/:id",
  authenticate,
  mongoIdParam,
  validate,
  async (req, res, next) => {
    try {
      const result = await deleteQuote(req.params.id, req.user);
      if (!result) {
        return res
          .status(404)
          .json({ data: null, error: "Quote not found", meta: null });
      }
      if (result.forbidden) {
        return res
          .status(403)
          .json({ data: null, error: "Forbidden", meta: null });
      }
      res.json({ data: { deleted: true }, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/quotes/:id/duplicate ───────────────────────────────────────────
router.post(
  "/:id/duplicate",
  authenticate,
  mongoIdParam,
  validate,
  async (req, res, next) => {
    try {
      const result = await duplicateQuote(req.params.id, req.user);
      if (!result) {
        return res
          .status(404)
          .json({ data: null, error: "Quote not found", meta: null });
      }
      if (result.forbidden) {
        return res
          .status(403)
          .json({ data: null, error: "Forbidden", meta: null });
      }
      res.status(201).json({ data: result, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
