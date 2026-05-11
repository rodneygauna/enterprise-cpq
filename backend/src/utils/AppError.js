/**
 * Operational error with a safe-to-expose message and HTTP status code.
 * Non-operational errors (e.g. programming bugs) bubble up to the global
 * error handler which returns a generic 500 message in production.
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
