const router = require("express").Router();
const { body, param } = require("express-validator");

const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const {
  listProductLines,
  createProductLine,
  updateProductLine,
  deleteProductLine,
  reorderProductLine,
} = require("../services/productLineService");

const ADMIN_ROLES = ["admin", "super_admin"];

const hexColorRule = (field) =>
  body(field)
    .optional({ nullable: true })
    .custom((val) => val === null || /^#[0-9a-fA-F]{6}$/.test(val))
    .withMessage(`${field} must be a valid 6-digit hex color or null`);

// ── GET /api/product-lines ────────────────────────────────────────────────────
// All authenticated users (needed for quote builder product line selector).
router.get("/", authenticate, async (req, res, next) => {
  try {
    const lines = await listProductLines();
    res.json({ data: lines, error: null, meta: { total: lines.length } });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/product-lines ───────────────────────────────────────────────────
// admin / super_admin only.
router.post(
  "/",
  authenticate,
  requireRole(ADMIN_ROLES),
  [
    body("name").notEmpty().trim().withMessage("name is required"),
    hexColorRule("displayColor"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const line = await createProductLine({
        name: req.body.name.trim(),
        displayColor: req.body.displayColor ?? null,
      });
      res.status(201).json({ data: line, error: null, meta: null });
    } catch (err) {
      // Duplicate name (unique index violation)
      if (err.code === 11000) {
        return res
          .status(409)
          .json({
            data: null,
            error: "A product line with that name already exists.",
            meta: null,
          });
      }
      next(err);
    }
  },
);

// ── PUT /api/product-lines/:id ────────────────────────────────────────────────
// admin / super_admin only.
router.put(
  "/:id",
  authenticate,
  requireRole(ADMIN_ROLES),
  [
    param("id").isMongoId().withMessage("Invalid product line ID"),
    body("name")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("name cannot be blank"),
    hexColorRule("displayColor"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const ALLOWED = ["name", "displayColor"];
      const fields = Object.fromEntries(
        Object.entries(req.body).filter(([k]) => ALLOWED.includes(k)),
      );
      const line = await updateProductLine(req.params.id, fields);
      if (!line) {
        return res
          .status(404)
          .json({ data: null, error: "Product line not found.", meta: null });
      }
      res.json({ data: line, error: null, meta: null });
    } catch (err) {
      if (err.code === 11000) {
        return res
          .status(409)
          .json({
            data: null,
            error: "A product line with that name already exists.",
            meta: null,
          });
      }
      next(err);
    }
  },
);

// ── DELETE /api/product-lines/:id ─────────────────────────────────────────────
// admin / super_admin only. Blocked if products are assigned (FR-LINE-3).
router.delete(
  "/:id",
  authenticate,
  requireRole(ADMIN_ROLES),
  [param("id").isMongoId().withMessage("Invalid product line ID")],
  validate,
  async (req, res, next) => {
    try {
      const line = await deleteProductLine(req.params.id);
      if (!line) {
        return res
          .status(404)
          .json({ data: null, error: "Product line not found.", meta: null });
      }
      res.json({ data: line, error: null, meta: null });
    } catch (err) {
      if (err.code === "IN_USE") {
        return res
          .status(409)
          .json({ data: null, error: err.message, meta: null });
      }
      next(err);
    }
  },
);

// ── POST /api/product-lines/:id/reorder ───────────────────────────────────────
// admin / super_admin only. Body: { direction: "up" | "down" }
router.post(
  "/:id/reorder",
  authenticate,
  requireRole(ADMIN_ROLES),
  [
    param("id").isMongoId().withMessage("Invalid product line ID"),
    body("direction")
      .isIn(["up", "down"])
      .withMessage("direction must be 'up' or 'down'"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const line = await reorderProductLine(req.params.id, req.body.direction);
      if (!line) {
        return res
          .status(404)
          .json({ data: null, error: "Product line not found.", meta: null });
      }
      res.json({ data: line, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
