const bcrypt = require("bcrypt");
const crypto = require("crypto");

const User = require("../models/User");
const AppError = require("../utils/AppError");
const { sendPasswordResetEmail } = require("../utils/email");

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Creates a new user account with the sales_rep role.
 * Throws 409 AppError if the email is already registered.
 */
async function registerUser({ email, password, firstName, lastName }) {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new AppError("An account with this email already exists", 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await User.create({
    email: normalizedEmail,
    passwordHash,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    role: "sales_rep",
    isActive: true,
  });

  return user;
}

/**
 * Generates a password-reset token for the given email and sends it.
 * Always returns silently even when the email is not found —
 * prevents email-enumeration attacks (OWASP A07).
 */
async function forgotPassword(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail, isActive: true });

  // Silently return — do not reveal whether an account exists
  if (!user) return;

  // Raw token goes in the email; only the SHA-256 hash is stored in the DB
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  user.passwordResetToken = tokenHash;
  user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();

  await sendPasswordResetEmail(user.email, rawToken);
}

/**
 * Validates a raw password-reset token and updates the user's password.
 * Clears the token after use to prevent reuse (security edge case).
 * Throws 400 AppError when the token is invalid or expired.
 */
async function resetPassword(rawToken, newPassword) {
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new AppError("Invalid or expired password reset token", 400);
  }

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Clear token fields to prevent reuse (null matches the schema default)
  user.passwordResetToken = null;
  user.passwordResetExpires = null;

  await user.save();
}

module.exports = { registerUser, forgotPassword, resetPassword };
