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
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Passport (JWT strategy — no session)
app.use(passport.initialize());

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/product-lines", require("./routes/productLines"));
app.use("/api/products", require("./routes/products"));
app.use("/api/quotes", require("./routes/quotes"));
app.use("/api/users", require("./routes/users"));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ data: null, error: "Route not found", meta: null });
});

// Global error handler (must be last)
app.use(require("./middleware/errorHandler"));

module.exports = app;
