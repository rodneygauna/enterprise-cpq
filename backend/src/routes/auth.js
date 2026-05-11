const express = require("express");
const passport = require("passport");
const { body } = require("express-validator");
const jwt = require("jsonwebtoken");

const { authenticate } = require("../middleware/authenticate");
const { validate } = require("../middleware/validate");
const { issueTokens, clearTokens } = require("../utils/tokens");
const {
  registerUser,
  forgotPassword,
  resetPassword,
} = require("../services/authService");
const AppError = require("../utils/AppError");
const User = require("../models/User");

const router = express.Router();

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post(
  "/register",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
    body("firstName").notEmpty().trim().withMessage("First name is required"),
    body("lastName").notEmpty().trim().withMessage("Last name is required"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const user = await registerUser(req.body);
      issueTokens(res, user._id, user.role);
      res.status(201).json({ data: user, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post(
  "/login",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validate,
  (req, res, next) => {
    passport.authenticate("local", { session: false }, async (err, user) => {
      if (err) return next(err);
      if (!user) {
        return res
          .status(401)
          .json({ data: null, error: "Invalid email or password", meta: null });
      }
      try {
        user.lastLogin = new Date();
        await user.save();
        issueTokens(res, user._id, user.role);
        res.json({ data: user, error: null, meta: null });
      } catch (saveErr) {
        next(saveErr);
      }
    })(req, res, next);
  },
);

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post("/logout", authenticate, (req, res) => {
  clearTokens(res);
  res.status(204).send();
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) throw new AppError("No refresh token provided", 401);

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      throw new AppError("Invalid or expired refresh token", 401);
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new AppError("User not found or account is inactive", 401);
    }

    issueTokens(res, user._id, user.role);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get("/me", authenticate, (req, res) => {
  // req.user has toJSON transform applied — passwordHash is stripped automatically
  res.json({ data: req.user, error: null, meta: null });
});

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
router.post(
  "/forgot-password",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
  ],
  validate,
  async (req, res, next) => {
    try {
      await forgotPassword(req.body.email);
      // Always return the same response — no email enumeration (OWASP A07)
      res.json({
        data: {
          message:
            "If an account exists for that email, a reset link has been sent.",
        },
        error: null,
        meta: null,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
router.post(
  "/reset-password",
  [
    body("token").notEmpty().withMessage("Reset token is required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
  ],
  validate,
  async (req, res, next) => {
    try {
      await resetPassword(req.body.token, req.body.password);
      res.json({
        data: { message: "Password reset successfully" },
        error: null,
        meta: null,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/auth/salesforce ──────────────────────────────────────────────────
router.get("/salesforce", (req, res, next) => {
  if (!process.env.SF_CONSUMER_KEY) {
    return res
      .status(501)
      .json({
        data: null,
        error: "Salesforce OAuth is not configured",
        meta: null,
      });
  }
  passport.authenticate("salesforce", {
    session: false,
    scope: ["openid", "email", "profile"],
  })(req, res, next);
});

// ── GET /api/auth/salesforce/callback ─────────────────────────────────────────
router.get(
  "/salesforce/callback",
  (req, res, next) => {
    if (!process.env.SF_CONSUMER_KEY) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      return res.redirect(`${frontendUrl}/login?error=oauth_not_configured`);
    }
    passport.authenticate("salesforce", { session: false }, (err, user) => {
      if (err || !user) {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
      }
      req.user = user;
      next();
    })(req, res, next);
  },
  async (req, res, next) => {
    try {
      issueTokens(res, req.user._id, req.user.role);
      res.redirect(process.env.FRONTEND_URL || "http://localhost:5173");
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
