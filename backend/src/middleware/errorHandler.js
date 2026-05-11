/**
 * Global error handler — must be registered last in app.js.
 *
 * Operational errors (AppError instances) expose their message safely.
 * Unexpected errors return a generic 500 in production to avoid leaking
 * implementation details (OWASP A09).
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  // Log non-operational errors for debugging
  if (!err.isOperational) {
    console.error("[ErrorHandler] Unexpected error:", err);
  }

  const message = err.isOperational
    ? err.message
    : process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : err.message;

  res.status(statusCode).json({ data: null, error: message, meta: null });
};

module.exports = errorHandler;
