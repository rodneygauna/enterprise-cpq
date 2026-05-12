/**
 * Auth route tests — covers FR-AUTH-1 through FR-AUTH-6.
 * Uses mongodb-memory-server; no real DB or SMTP connections.
 *
 * Test coverage:
 *   - Happy-path flows for every endpoint
 *   - Security edge cases: deactivated accounts, expired/reused tokens,
 *     duplicate email, passwordHash not leaked in responses
 */

jest.mock("nodemailer", () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: "mock-id" }),
  }),
}));

const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = require("../../app");
const User = require("../../models/User");
const {
  connect,
  clearDatabase,
  closeDatabase,
} = require("../../../tests/helpers/db");
const { tokenFor, refreshTokenFor } = require("../../../tests/helpers/auth");

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function createUser(overrides = {}) {
  return User.create({
    email: "user@example.com",
    passwordHash: await bcrypt.hash("password123", 12),
    firstName: "Test",
    lastName: "User",
    role: "sales_rep",
    isActive: true,
    ...overrides,
  });
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
describe("POST /api/auth/register", () => {
  it("creates a user and returns 201 with user data", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "new@example.com",
      password: "password123",
      firstName: "Jane",
      lastName: "Doe",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe("new@example.com");
    expect(res.body.data.role).toBe("sales_rep");
    expect(res.body.error).toBeNull();
  });

  it("stores a bcrypt hash — never plaintext (security)", async () => {
    await request(app).post("/api/auth/register").send({
      email: "new@example.com",
      password: "password123",
      firstName: "Jane",
      lastName: "Doe",
    });

    const dbUser = await User.findOne({ email: "new@example.com" }).lean();
    expect(dbUser.passwordHash).toBeTruthy();
    expect(dbUser.passwordHash).not.toBe("password123");
    const valid = await bcrypt.compare("password123", dbUser.passwordHash);
    expect(valid).toBe(true);
  });

  it("sets access_token and refresh_token cookies", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "new@example.com",
      password: "password123",
      firstName: "Jane",
      lastName: "Doe",
    });

    const cookies = res.headers["set-cookie"] || [];
    expect(cookies.some((c) => c.startsWith("access_token="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("refresh_token="))).toBe(true);
  });

  it("does NOT include passwordHash in the response (security)", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "new@example.com",
      password: "password123",
      firstName: "Jane",
      lastName: "Doe",
    });

    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it("returns 409 when email already exists (security)", async () => {
    await createUser({ email: "taken@example.com" });

    const res = await request(app).post("/api/auth/register").send({
      email: "taken@example.com",
      password: "password123",
      firstName: "Jane",
      lastName: "Doe",
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it("returns 422 when email is invalid", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "not-an-email",
      password: "password123",
      firstName: "Jane",
      lastName: "Doe",
    });

    expect(res.status).toBe(422);
  });

  it("returns 422 when password is too short", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "new@example.com",
      password: "short",
      firstName: "Jane",
      lastName: "Doe",
    });

    expect(res.status).toBe(422);
  });

  it("returns 422 when firstName is missing", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "new@example.com",
      password: "password123",
      lastName: "Doe",
    });

    expect(res.status).toBe(422);
  });

  it("returns 422 when lastName is missing", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "new@example.com",
      password: "password123",
      firstName: "Jane",
    });

    expect(res.status).toBe(422);
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  beforeEach(async () => createUser());

  it("returns 200 with user data for valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("user@example.com");
    expect(res.body.error).toBeNull();
  });

  it("does NOT include passwordHash in the login response (security)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com", password: "password123" });

    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it("sets auth cookies on successful login", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com", password: "password123" });

    const cookies = res.headers["set-cookie"] || [];
    expect(cookies.some((c) => c.startsWith("access_token="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("refresh_token="))).toBe(true);
  });

  it("returns 401 for wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com", password: "wrongpassword" });

    expect(res.status).toBe(401);
  });

  it("returns 401 for non-existent email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });

    expect(res.status).toBe(401);
  });

  it("returns 401 for a deactivated account (security edge case)", async () => {
    await createUser({ email: "inactive@example.com", isActive: false });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "inactive@example.com", password: "password123" });

    expect(res.status).toBe(401);
  });

  it("returns 422 for an invalid email format", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "bad-email", password: "password123" });

    expect(res.status).toBe(422);
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
describe("POST /api/auth/logout", () => {
  it("returns 401 without an access token", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(401);
  });

  it("clears cookies and returns 204 for an authenticated user", async () => {
    const user = await createUser();
    const token = tokenFor("sales_rep", user._id.toString());

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", `access_token=${token}`);

    expect(res.status).toBe(204);
    // Cookies should be cleared (set to empty / expired)
    const cookies = res.headers["set-cookie"] || [];
    const accessCookie = cookies.find((c) => c.startsWith("access_token="));
    expect(accessCookie).toMatch(/access_token=;|access_token=(?:;|$)/);
  });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
describe("POST /api/auth/refresh", () => {
  it("issues a new access_token for a valid refresh token", async () => {
    const user = await createUser();
    const refreshToken = refreshTokenFor(user._id.toString());

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `refresh_token=${refreshToken}`);

    expect(res.status).toBe(204);
    const cookies = res.headers["set-cookie"] || [];
    expect(cookies.some((c) => c.startsWith("access_token="))).toBe(true);
  });

  it("returns 401 with no refresh_token cookie", async () => {
    const res = await request(app).post("/api/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("returns 401 for an invalid refresh token (security edge case)", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", "refresh_token=totally.invalid.token");

    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired refresh token (security edge case)", async () => {
    const user = await createUser();
    const expiredToken = jwt.sign(
      { sub: user._id.toString() },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "-1s" },
    );

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `refresh_token=${expiredToken}`);

    expect(res.status).toBe(401);
  });

  it("returns 401 for a deactivated user (security edge case)", async () => {
    const user = await createUser({
      email: "deactivated@example.com",
      isActive: false,
    });
    const refreshToken = refreshTokenFor(user._id.toString());

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `refresh_token=${refreshToken}`);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
describe("GET /api/auth/me", () => {
  it("returns the current user for a valid access token", async () => {
    const user = await createUser();
    const token = tokenFor("sales_rep", user._id.toString());

    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `access_token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("user@example.com");
  });

  it("returns 401 without an access token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("does NOT include passwordHash in the response (security)", async () => {
    const user = await createUser();
    const token = tokenFor("sales_rep", user._id.toString());

    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `access_token=${token}`);

    expect(res.body.data.passwordHash).toBeUndefined();
    expect(res.body.data.passwordResetToken).toBeUndefined();
  });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
describe("POST /api/auth/forgot-password", () => {
  it("returns 200 for a known email and sends an email", async () => {
    await createUser();
    const nodemailer = require("nodemailer");

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "user@example.com" });

    expect(res.status).toBe(200);
    expect(nodemailer.createTransport().sendMail).toHaveBeenCalled();
  });

  it("returns 200 for an unknown email — no email enumeration (security)", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@example.com" });

    // Same response shape as a known email
    expect(res.status).toBe(200);
    expect(res.body.data.message).toBeTruthy();
  });

  it("returns 422 for an invalid email format", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "not-an-email" });

    expect(res.status).toBe(422);
  });
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
describe("POST /api/auth/reset-password", () => {
  async function setupResetToken() {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const user = await createUser();
    user.passwordResetToken = tokenHash;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    return { user, rawToken };
  }

  it("resets the password with a valid token", async () => {
    const { rawToken } = await setupResetToken();

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, password: "newPassword123" });

    expect(res.status).toBe(200);

    // Verify the new password works
    const dbUser = await User.findOne({ email: "user@example.com" }).lean();
    const valid = await bcrypt.compare("newPassword123", dbUser.passwordHash);
    expect(valid).toBe(true);
  });

  it("clears the reset token after successful reset (prevents reuse)", async () => {
    const { rawToken } = await setupResetToken();

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, password: "newPassword123" });

    const dbUser = await User.findOne({ email: "user@example.com" }).lean();
    expect(dbUser.passwordResetToken).toBeNull();
    expect(dbUser.passwordResetExpires).toBeNull();
  });

  it("returns 400 for an invalid token (security edge case)", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "completely-invalid-token", password: "newPassword123" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for an expired token (security edge case)", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const user = await createUser();
    user.passwordResetToken = tokenHash;
    user.passwordResetExpires = new Date(Date.now() - 1000); // already expired
    await user.save();

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, password: "newPassword123" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for a token that was already used (security edge case)", async () => {
    const { rawToken } = await setupResetToken();

    // First use — should succeed
    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, password: "newPassword123" });

    // Second use — token was cleared; should fail
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, password: "anotherPassword456" });

    expect(res.status).toBe(400);
  });

  it("returns 422 when the new password is too short", async () => {
    const { rawToken } = await setupResetToken();

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, password: "short" });

    expect(res.status).toBe(422);
  });
});

// ─── POST /api/auth/accept-invite ─────────────────────────────────────────────
describe("POST /api/auth/accept-invite", () => {
  async function setupInvite(overrides = {}) {
    const rawToken = "valid-invite-token-abc";
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const user = await User.create({
      email: "invited@example.com",
      passwordHash: null,
      firstName: "Pending",
      lastName: "User",
      role: "sales_rep",
      isActive: false,
      inviteToken: tokenHash,
      inviteExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ...overrides,
    });

    return { rawToken, tokenHash, user };
  }

  it("activates the account and returns 200 with user data", async () => {
    const { rawToken } = await setupInvite();

    const res = await request(app).post("/api/auth/accept-invite").send({
      token: rawToken,
      password: "NewPassword1!",
      firstName: "Jane",
      lastName: "Doe",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("invited@example.com");

    const saved = await User.findOne({ email: "invited@example.com" });
    expect(saved.isActive).toBe(true);
    expect(saved.inviteToken).toBeNull();
  });

  it("sets the provided first and last name on the account", async () => {
    const { rawToken } = await setupInvite();

    await request(app).post("/api/auth/accept-invite").send({
      token: rawToken,
      password: "NewPassword1!",
      firstName: "Jane",
      lastName: "Doe",
    });

    const saved = await User.findOne({ email: "invited@example.com" });
    expect(saved.firstName).toBe("Jane");
    expect(saved.lastName).toBe("Doe");
  });

  it("sets JWT cookies so the user is logged in after accepting", async () => {
    const { rawToken } = await setupInvite();

    const res = await request(app).post("/api/auth/accept-invite").send({
      token: rawToken,
      password: "NewPassword1!",
      firstName: "Jane",
      lastName: "Doe",
    });

    const cookies = res.headers["set-cookie"] ?? [];
    expect(cookies.some((c) => c.startsWith("access_token="))).toBe(true);
  });

  it("returns 400 for an invalid token", async () => {
    await setupInvite();

    const res = await request(app).post("/api/auth/accept-invite").send({
      token: "wrong-token",
      password: "NewPassword1!",
      firstName: "Jane",
      lastName: "Doe",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for an expired invite", async () => {
    const rawToken = "expired-invite-token";
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    await User.create({
      email: "expired@example.com",
      passwordHash: null,
      firstName: "Pending",
      lastName: "User",
      role: "sales_rep",
      isActive: false,
      inviteToken: tokenHash,
      inviteExpires: new Date(Date.now() - 1000), // already expired
    });

    const res = await request(app).post("/api/auth/accept-invite").send({
      token: rawToken,
      password: "NewPassword1!",
      firstName: "Jane",
      lastName: "Doe",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when the token has already been used", async () => {
    const { rawToken } = await setupInvite();

    // First use — should succeed
    await request(app).post("/api/auth/accept-invite").send({
      token: rawToken,
      password: "NewPassword1!",
      firstName: "Jane",
      lastName: "Doe",
    });

    // Second use — token was cleared
    const res = await request(app).post("/api/auth/accept-invite").send({
      token: rawToken,
      password: "AnotherPass2!",
      firstName: "Jane",
      lastName: "Doe",
    });

    expect(res.status).toBe(400);
  });

  it("returns 422 when token is missing", async () => {
    const res = await request(app).post("/api/auth/accept-invite").send({
      password: "NewPassword1!",
      firstName: "Jane",
      lastName: "Doe",
    });

    expect(res.status).toBe(422);
  });

  it("returns 422 when password is too short", async () => {
    const { rawToken } = await setupInvite();

    const res = await request(app).post("/api/auth/accept-invite").send({
      token: rawToken,
      password: "short",
      firstName: "Jane",
      lastName: "Doe",
    });

    expect(res.status).toBe(422);
  });
});
