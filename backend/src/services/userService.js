const crypto = require("crypto");

const User = require("../models/User");
const AppError = require("../utils/AppError");
const { sendInviteEmail } = require("../utils/email");

const INVITE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * List users with optional filters.
 *
 * @param {object} query  - { role, status, page, limit }
 * @returns {{ users: User[], total: number, page: number }}
 */
async function listUsers({ role, status, page = 1, limit = 20 } = {}) {
  const filter = {};

  if (role) filter.role = role;

  if (status === "active") filter.isActive = true;
  else if (status === "inactive") filter.isActive = false;

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(filter)
      .select(
        "-passwordHash -passwordResetToken -passwordResetExpires -inviteToken -inviteExpires",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return { users, total, page };
}

/**
 * Fetch a single user by ID.
 * Throws 404 if not found.
 */
async function getUser(userId) {
  const user = await User.findById(userId)
    .select(
      "-passwordHash -passwordResetToken -passwordResetExpires -inviteToken -inviteExpires",
    )
    .lean();
  if (!user) throw new AppError("User not found", 404);
  return user;
}

/**
 * Update a user's role.
 * Throws 404 if not found.
 *
 * @param {string} userId
 * @param {string} role  - must be a valid ROLES enum value
 */
async function updateUserRole(userId, role) {
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404);

  user.role = role;
  await user.save();
  return user;
}

/**
 * Activate or deactivate a user account (soft-delete pattern).
 * Throws 404 if not found.
 *
 * @param {string}  userId
 * @param {boolean} isActive
 */
async function setUserStatus(userId, isActive) {
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404);

  user.isActive = isActive;
  await user.save();
  return user;
}

/**
 * Invite a new user by email.
 *  - Creates a pending (isActive: false) User record if no user with that
 *    email exists; reuses an existing inactive/pending record if present.
 *  - Throws 409 if an active, registered user already has that email.
 *  - Generates a raw invite token → hashes it → stores hash + expiry.
 *  - Sends an invite email with the raw token.
 *
 * @param {string} email            - invitation target email
 * @param {object} invitingUser     - the admin performing the invite
 * @returns {User}                  - the created/updated pending user
 */
async function inviteUser(email, invitingUser) {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await User.findOne({ email: normalizedEmail });

  if (existing && existing.isActive && existing.passwordHash) {
    // Fully registered active user — do not re-invite
    throw new AppError("An active account with this email already exists", 409);
  }

  // Generate invite token — raw token goes in email, hash stored in DB
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  let pending;
  if (existing) {
    // Reuse the existing stub record and refresh the token
    existing.inviteToken = tokenHash;
    existing.inviteExpires = new Date(Date.now() + INVITE_TOKEN_TTL_MS);
    await existing.save();
    pending = existing;
  } else {
    // Create a placeholder record (firstName/lastName filled in on registration)
    pending = await User.create({
      email: normalizedEmail,
      passwordHash: null,
      firstName: "Invited",
      lastName: "User",
      role: "sales_rep",
      isActive: false,
      inviteToken: tokenHash,
      inviteExpires: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
    });
  }

  await sendInviteEmail(
    normalizedEmail,
    rawToken,
    `${invitingUser.firstName} ${invitingUser.lastName}`,
  );

  return pending;
}

module.exports = {
  listUsers,
  getUser,
  updateUserRole,
  setUserStatus,
  inviteUser,
};
