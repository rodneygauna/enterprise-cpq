const { validationResult } = require("express-validator");

/**
 * Reads express-validator results from the request and returns a 422
 * response if any validation errors are present.
 * Must be placed after the validation rule arrays in the route definition.
 */
const validate = (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).json({
      data: null,
      error: "Validation failed",
      errors: result.array(),
      meta: null,
    });
  }
  return next();
};

module.exports = { validate };
