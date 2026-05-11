const mongoose = require("mongoose");

// Canonical role list — matches PRD Section 8
const ROLES = [
  "super_admin",
  "admin",
  "executive",
  "sales_manager",
  "sales_rep",
];

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      default: null, // null for Salesforce-only accounts
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ROLES,
      default: "sales_rep",
    },
    salesforceId: {
      type: String,
      default: null,
      sparse: true, // allows multiple nulls
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    // Password reset — store SHA-256 hash of the raw token; send raw token in email
    passwordResetToken: {
      type: String,
      default: null,
      index: { sparse: true },
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
    // Invite flow (FR-USER-3, implemented in Phase 1 §7.7)
    inviteToken: {
      type: String,
      default: null,
    },
    inviteExpires: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Strip sensitive fields from all JSON serialisations (toJSON is called by
// JSON.stringify, which Express uses in res.json).
UserSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.inviteToken;
    delete ret.inviteExpires;
    return ret;
  },
});

const User = mongoose.model("User", UserSchema);

module.exports = User;
module.exports.ROLES = ROLES;
