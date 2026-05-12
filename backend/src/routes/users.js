const express = require("express");
const { body, param, query } = require("express-validator");

const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const {
  listUsers,
  getUser,
  updateUserRole,
  setUserStatus,
  inviteUser,
} = require("../services/userService");
const { ROLES } = require("../models/User");

const router = express.Router();

const ADMIN_ROLES = ["admin", "super_admin"];

// ── GET /api/users ────────────────────────────────────────────────────────────
router.get(
  "/",
  authenticate,
  requireRole(ADMIN_ROLES),
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .toInt()
      .withMessage("page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .toInt()
      .withMessage("limit must be between 1 and 100"),
    query("role")
      .optional()
      .isIn(ROLES)
      .withMessage(`role must be one of: ${ROLES.join(", ")}`),
    query("status")
      .optional()
      .isIn(["active", "inactive"])
      .withMessage("status must be 'active' or 'inactive'"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { page = 1, limit = 20, role, status } = req.query;
      const result = await listUsers({ page, limit, role, status });
      res.json({
        data: result.users,
        error: null,
        meta: { page: result.page, total: result.total, limit },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/users/:id ────────────────────────────────────────────────────────
router.get(
  "/:id",
  authenticate,
  requireRole(ADMIN_ROLES),
  [param("id").isMongoId().withMessage("Invalid user ID")],
  validate,
  async (req, res, next) => {
    try {
      const user = await getUser(req.params.id);
      res.json({ data: user, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /api/users/:id/role ─────────────────────────────────────────────────
router.patch(
  "/:id/role",
  authenticate,
  requireRole(ADMIN_ROLES),
  [
    param("id").isMongoId().withMessage("Invalid user ID"),
    body("role")
      .notEmpty()
      .isIn(ROLES)
      .withMessage(`role must be one of: ${ROLES.join(", ")}`),
  ],
  validate,
  async (req, res, next) => {
    try {
      const user = await updateUserRole(req.params.id, req.body.role);
      res.json({ data: user, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /api/users/:id/status ───────────────────────────────────────────────
router.patch(
  "/:id/status",
  authenticate,
  requireRole(ADMIN_ROLES),
  [
    param("id").isMongoId().withMessage("Invalid user ID"),
    body("isActive").isBoolean().withMessage("isActive must be a boolean"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const user = await setUserStatus(
        req.params.id,
        Boolean(req.body.isActive),
      );
      res.json({ data: user, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/users/invite ────────────────────────────────────────────────────
router.post(
  "/invite",
  authenticate,
  requireRole(ADMIN_ROLES),
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("A valid email address is required"),
    body("role")
      .optional()
      .isIn(["super_admin", "admin", "executive", "sales_manager", "sales_rep"])
      .withMessage("Invalid role"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const pending = await inviteUser(req.body.email, req.user, req.body.role);
      res.status(201).json({ data: pending, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
