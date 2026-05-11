const passport = require("passport");

/**
 * Middleware that validates the JWT access_token cookie.
 * Attaches the authenticated user to req.user on success.
 * Returns 401 if the token is missing, invalid, or the user is inactive.
 */
const authenticate = (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user) => {
    if (err) return next(err);
    if (!user) {
      return res
        .status(401)
        .json({ data: null, error: "Unauthorized", meta: null });
    }
    req.user = user;
    return next();
  })(req, res, next);
};

module.exports = { authenticate };
