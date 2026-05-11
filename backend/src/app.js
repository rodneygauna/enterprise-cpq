const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const rateLimit = require("express-rate-limit");

// Load passport strategies
require("./config/passport");

const app = express();

// Security headers (OWASP A05)
app.use(helmet());

// CORS — credentials required for httpOnly cookie exchange in development
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

// Passport (JWT strategy — no session)
app.use(passport.initialize());

// Rate limiting on authentication endpoints (OWASP A07 brute-force protection)
// Disabled in the test environment so Jest suites never hit the limit.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    data: null,
    error: "Too many requests. Please try again later.",
    meta: null,
  },
});

// Routes
app.use("/api/auth", authLimiter, require("./routes/auth"));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ data: null, error: "Route not found", meta: null });
});

// Global error handler (must be last)
app.use(require("./middleware/errorHandler"));

module.exports = app;
