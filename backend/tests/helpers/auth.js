const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

/**
 * Returns a signed JWT access token for use in test requests.
 *
 * @param {string} role  - One of ROLES from User model
 * @param {string} [userId] - Optional user ID; defaults to a new ObjectId
 * @returns {string} Signed JWT
 */
function tokenFor(role, userId) {
  const id = userId || new mongoose.Types.ObjectId().toString();
  return jwt.sign({ sub: id, role }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
}

/**
 * Returns a signed JWT refresh token for test requests.
 */
function refreshTokenFor(userId) {
  const id = userId || new mongoose.Types.ObjectId().toString();
  return jwt.sign({ sub: id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
}

module.exports = { tokenFor, refreshTokenFor };
