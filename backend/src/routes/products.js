const router = require("express").Router();
const { body, param, query } = require("express-validator");
const multer = require("multer");

const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const {
  PRODUCT_TYPES,
  PRICING_MODELS,
  PRICING_STRATEGIES,
  BILLING_TYPES,
  SCOPE_BASED_PRICING,
} = require("../models/Product");
const {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  exportCatalogXlsx,
  importCatalogXlsx,
  resetCatalog,
} = require("../services/productService");

// Seed products for the reset action — loaded lazily so the router works without seeds present
let _seedProducts = null;
function getSeedProducts() {
  if (!_seedProducts) {
    try {
      _seedProducts = require("../../seeds/productCatalog");
    } catch {
      _seedProducts = [];
    }
  }
  return _seedProducts;
}

const ADMIN_ROLES = ["admin", "super_admin"];

// Multer — accept XLSX uploads in memory (max 10 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.endsWith(".xlsx");
    cb(ok ? null : new Error("Only .xlsx files are accepted"), ok);
  },
});

// Shared validation rules for product body fields
const productBodyRules = [
  body("name").notEmpty().trim().withMessage("name is required"),
  body("type")
    .optional()
    .isIn(PRODUCT_TYPES)
    .withMessage(`type must be one of: ${PRODUCT_TYPES.join(", ")}`),
  body("pricingModel")
    .optional()
    .isIn(PRICING_MODELS)
    .withMessage(`pricingModel must be one of: ${PRICING_MODELS.join(", ")}`),
  body("pricingStrategy")
    .optional()
    .isIn(PRICING_STRATEGIES)
    .withMessage(
      `pricingStrategy must be one of: ${PRICING_STRATEGIES.join(", ")}`,
    ),
  body("billingType")
    .optional()
    .isIn(BILLING_TYPES)
    .withMessage(`billingType must be one of: ${BILLING_TYPES.join(", ")}`),
  body("scopeBasedPricing")
    .optional()
    .isIn(SCOPE_BASED_PRICING)
    .withMessage(
      `scopeBasedPricing must be one of: ${SCOPE_BASED_PRICING.join(", ")}`,
    ),
  body("basePrice").optional().isFloat({ min: 0 }),
  body("unitCost").optional().isFloat({ min: 0 }),
  body("implementationFee").optional().isFloat({ min: 0 }),
  body("overagePrice").optional().isFloat({ min: 0 }),
  body("productLineId")
    .optional({ nullable: true })
    .custom((v) => {
      if (v === null || v === "") return true;
      return /^[a-f\d]{24}$/i.test(v);
    })
    .withMessage("productLineId must be a valid Mongo ID or null"),
  body("tiers").optional().isArray().withMessage("tiers must be an array"),
  body("tiers.*.min")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("tier min must be a non-negative number"),
  body("tiers.*.price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("tier price must be a non-negative number"),
  body("volumeBands")
    .optional()
    .isArray()
    .withMessage("volumeBands must be an array"),
  body("compatibleCoreIds")
    .optional()
    .isArray()
    .withMessage("compatibleCoreIds must be an array"),
  body("compatibleCoreIds.*")
    .optional()
    .isMongoId()
    .withMessage("Each compatibleCoreId must be a valid Mongo ID"),
  body("recommendedProductIds")
    .optional()
    .isArray()
    .withMessage("recommendedProductIds must be an array"),
  body("recommendedProductIds.*")
    .optional()
    .isMongoId()
    .withMessage("Each recommendedProductId must be a valid Mongo ID"),
];

// ── GET /api/products ─────────────────────────────────────────────────────────
// All authenticated users (read-only, FR-PROD-1).
router.get(
  "/",
  authenticate,
  [
    query("productLineId")
      .optional()
      .isMongoId()
      .withMessage("productLineId must be a valid Mongo ID"),
    query("search").optional().isString().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const filters = {};
      if (req.query.productLineId)
        filters.productLineId = req.query.productLineId;
      if (req.query.search) filters.search = req.query.search;
      const products = await listProducts(filters);
      res.json({
        data: products,
        error: null,
        meta: { total: products.length },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/products/export ───────────────────────────────────────────────────
// Admin only — XLSX download (FR-PROD-4). Must come before /:id.
router.get(
  "/export",
  authenticate,
  requireRole(ADMIN_ROLES),
  async (req, res, next) => {
    try {
      const buffer = await exportCatalogXlsx();
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="product-catalog-${Date.now()}.xlsx"`,
      );
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/products/:id ─────────────────────────────────────────────────────
// All authenticated users (FR-PROD-1).
router.get(
  "/:id",
  authenticate,
  [param("id").isMongoId().withMessage("Invalid product ID")],
  validate,
  async (req, res, next) => {
    try {
      const product = await getProduct(req.params.id);
      if (!product) {
        return res
          .status(404)
          .json({ data: null, error: "Product not found.", meta: null });
      }
      res.json({ data: product, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/products ────────────────────────────────────────────────────────
// Admin only (FR-PROD-1).
router.post(
  "/",
  authenticate,
  requireRole(ADMIN_ROLES),
  productBodyRules,
  validate,
  async (req, res, next) => {
    try {
      const product = await createProduct(req.body, req.user._id);
      res.status(201).json({ data: product, error: null, meta: null });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({
          data: null,
          error: "A product with that SKU already exists.",
          meta: null,
        });
      }
      next(err);
    }
  },
);

// ── POST /api/products/import ─────────────────────────────────────────────────
// Admin only — XLSX import (FR-PROD-5). Must come before /:id.
router.post(
  "/import",
  authenticate,
  requireRole(ADMIN_ROLES),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res
          .status(422)
          .json({
            data: null,
            error: "An .xlsx file is required.",
            meta: null,
          });
      }
      const results = await importCatalogXlsx(req.file.buffer);
      res.json({ data: results, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/products/reset ──────────────────────────────────────────────────
// Super admin only (FR-PROD-8). Must come before /:id.
router.post(
  "/reset",
  authenticate,
  requireRole(["super_admin"]),
  async (req, res, next) => {
    try {
      const seeds = getSeedProducts();
      await resetCatalog(seeds);
      res.json({
        data: { message: "Product catalog reset to seed data." },
        error: null,
        meta: null,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── PUT /api/products/:id ─────────────────────────────────────────────────────
// Admin only (FR-PROD-1).
router.put(
  "/:id",
  authenticate,
  requireRole(ADMIN_ROLES),
  [
    param("id").isMongoId().withMessage("Invalid product ID"),
    ...productBodyRules,
  ],
  validate,
  async (req, res, next) => {
    try {
      const product = await updateProduct(req.params.id, req.body);
      if (!product) {
        return res
          .status(404)
          .json({ data: null, error: "Product not found.", meta: null });
      }
      res.json({ data: product, error: null, meta: null });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({
          data: null,
          error: "A product with that SKU already exists.",
          meta: null,
        });
      }
      next(err);
    }
  },
);

// ── DELETE /api/products/:id ──────────────────────────────────────────────────
// Admin only (FR-PROD-1).
router.delete(
  "/:id",
  authenticate,
  requireRole(ADMIN_ROLES),
  [param("id").isMongoId().withMessage("Invalid product ID")],
  validate,
  async (req, res, next) => {
    try {
      const product = await deleteProduct(req.params.id);
      if (!product) {
        return res
          .status(404)
          .json({ data: null, error: "Product not found.", meta: null });
      }
      res.json({ data: product, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/products/:id/duplicate ─────────────────────────────────────────
// Admin only (FR-PROD-7).
router.post(
  "/:id/duplicate",
  authenticate,
  requireRole(ADMIN_ROLES),
  [param("id").isMongoId().withMessage("Invalid product ID")],
  validate,
  async (req, res, next) => {
    try {
      const product = await duplicateProduct(req.params.id, req.user._id);
      if (!product) {
        return res
          .status(404)
          .json({ data: null, error: "Product not found.", meta: null });
      }
      res.status(201).json({ data: product, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
