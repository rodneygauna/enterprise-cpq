/**
 * Users route tests — covers FR-USER-1, FR-USER-2, FR-USER-3.
 * Uses mongodb-memory-server; no real DB connections.
 *
 * Coverage:
 *   GET /api/users
 *     - 401 unauthenticated
 *     - 403 sales_rep (insufficient role)
 *     - 200 admin sees paginated list
 *     - 200 filters by role
 *     - 200 filters by status=active
 *     - 200 filters by status=inactive
 *     - 422 invalid role query param
 *     - 422 invalid status query param
 *
 *   GET /api/users/:id
 *     - 401 unauthenticated
 *     - 403 sales_rep
 *     - 422 invalid Mongo ID
 *     - 404 not found
 *     - 200 admin gets user by id
 *
 *   PATCH /api/users/:id/role
 *     - 401 unauthenticated
 *     - 403 sales_rep
 *     - 422 invalid Mongo ID
 *     - 422 invalid role value
 *     - 404 not found
 *     - 200 admin updates role
 *
 *   PATCH /api/users/:id/status
 *     - 401 unauthenticated
 *     - 403 sales_rep
 *     - 422 invalid Mongo ID
 *     - 422 missing isActive field
 *     - 404 not found
 *     - 200 admin deactivates user
 *     - 200 admin activates user
 *
 *   POST /api/users/invite
 *     - 401 unauthenticated
 *     - 403 sales_rep
 *     - 422 missing email
 *     - 422 invalid email
 *     - 409 email already active
 *     - 201 success — pending user created
 *     - 201 success — re-invite of pending user succeeds
 */
const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../../app");
const User = require("../../models/User");
const {
  connect,
  clearDatabase,
  closeDatabase,
} = require("../../../tests/helpers/db");
const { tokenFor } = require("../../../tests/helpers/auth");

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _seq = 0;
async function createUser(role = "sales_rep", overrides = {}) {
  _seq += 1;
  const base = {
    email: `user${_seq}-${Date.now()}@example.com`,
    passwordHash: await bcrypt.hash("Password123!", 12),
    firstName: "Test",
    lastName: "User",
    role,
    isActive: true,
  };
  return User.create({ ...base, ...overrides });
}

function cookie(role, userId) {
  return { Cookie: `access_token=${tokenFor(role, userId)}` };
}

// ─── GET /api/users ────────────────────────────────────────────────────────────
describe("GET /api/users", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
  });

  it("returns 403 for sales_rep", async () => {
    const u = await createUser("sales_rep");
    const res = await request(app)
      .get("/api/users")
      .set(cookie("sales_rep", u._id.toString()));
    expect(res.status).toBe(403);
  });

  it("returns 200 and paginated list for admin", async () => {
    const admin = await createUser("admin");
    await createUser("sales_rep");
    const res = await request(app)
      .get("/api/users")
      .set(cookie("admin", admin._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.meta).toMatchObject({ page: 1 });
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it("returns 200 and list for super_admin", async () => {
    const sa = await createUser("super_admin");
    const res = await request(app)
      .get("/api/users")
      .set(cookie("super_admin", sa._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it("filters by role", async () => {
    const admin = await createUser("admin");
    await createUser("sales_rep");
    await createUser("executive");
    const res = await request(app)
      .get("/api/users?role=executive")
      .set(cookie("admin", admin._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.data.every((u) => u.role === "executive")).toBe(true);
  });

  it("filters by status=active", async () => {
    const admin = await createUser("admin");
    await createUser("sales_rep", { isActive: false });
    const res = await request(app)
      .get("/api/users?status=active")
      .set(cookie("admin", admin._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.data.every((u) => u.isActive === true)).toBe(true);
  });

  it("filters by status=inactive", async () => {
    const admin = await createUser("admin");
    await createUser("sales_rep", { isActive: false });
    await createUser("sales_manager");
    const res = await request(app)
      .get("/api/users?status=inactive")
      .set(cookie("admin", admin._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.data.every((u) => u.isActive === false)).toBe(true);
  });

  it("returns 422 for invalid role query param", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .get("/api/users?role=hacker")
      .set(cookie("admin", admin._id.toString()));
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid status query param", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .get("/api/users?status=maybe")
      .set(cookie("admin", admin._id.toString()));
    expect(res.status).toBe(422);
  });

  it("does not return sensitive fields in the list", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .get("/api/users")
      .set(cookie("admin", admin._id.toString()));
    expect(res.status).toBe(200);
    const found = res.body.data.find((u) => u._id === admin._id.toString());
    expect(found?.passwordHash).toBeUndefined();
    expect(found?.inviteToken).toBeUndefined();
  });
});

// ─── GET /api/users/:id ────────────────────────────────────────────────────────
describe("GET /api/users/:id", () => {
  it("returns 401 when unauthenticated", async () => {
    const u = await createUser();
    const res = await request(app).get(`/api/users/${u._id}`);
    expect(res.status).toBe(401);
  });

  it("returns 403 for sales_rep", async () => {
    const rep = await createUser("sales_rep");
    const target = await createUser("sales_manager");
    const res = await request(app)
      .get(`/api/users/${target._id}`)
      .set(cookie("sales_rep", rep._id.toString()));
    expect(res.status).toBe(403);
  });

  it("returns 422 for invalid Mongo ID", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .get("/api/users/not-a-valid-id")
      .set(cookie("admin", admin._id.toString()));
    expect(res.status).toBe(422);
  });

  it("returns 404 when user not found", async () => {
    const admin = await createUser("admin");
    const fakeId = "000000000000000000000001";
    const res = await request(app)
      .get(`/api/users/${fakeId}`)
      .set(cookie("admin", admin._id.toString()));
    expect(res.status).toBe(404);
  });

  it("returns 200 with user data for admin", async () => {
    const admin = await createUser("admin");
    const target = await createUser("sales_rep");
    const res = await request(app)
      .get(`/api/users/${target._id}`)
      .set(cookie("admin", admin._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(target._id.toString());
    expect(res.body.data.email).toBe(target.email);
    expect(res.body.data.passwordHash).toBeUndefined();
  });
});

// ─── PATCH /api/users/:id/role ─────────────────────────────────────────────────
describe("PATCH /api/users/:id/role", () => {
  it("returns 401 when unauthenticated", async () => {
    const u = await createUser();
    const res = await request(app)
      .patch(`/api/users/${u._id}/role`)
      .send({ role: "admin" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for sales_rep", async () => {
    const rep = await createUser("sales_rep");
    const target = await createUser("sales_manager");
    const res = await request(app)
      .patch(`/api/users/${target._id}/role`)
      .set(cookie("sales_rep", rep._id.toString()))
      .send({ role: "admin" });
    expect(res.status).toBe(403);
  });

  it("returns 422 for invalid Mongo ID", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .patch("/api/users/bad-id/role")
      .set(cookie("admin", admin._id.toString()))
      .send({ role: "admin" });
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid role value", async () => {
    const admin = await createUser("admin");
    const target = await createUser("sales_rep");
    const res = await request(app)
      .patch(`/api/users/${target._id}/role`)
      .set(cookie("admin", admin._id.toString()))
      .send({ role: "superuser" });
    expect(res.status).toBe(422);
  });

  it("returns 404 when user not found", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .patch("/api/users/000000000000000000000001/role")
      .set(cookie("admin", admin._id.toString()))
      .send({ role: "admin" });
    expect(res.status).toBe(404);
  });

  it("returns 200 and updates role", async () => {
    const admin = await createUser("admin");
    const target = await createUser("sales_rep");
    const res = await request(app)
      .patch(`/api/users/${target._id}/role`)
      .set(cookie("admin", admin._id.toString()))
      .send({ role: "sales_manager" });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("sales_manager");
    const updated = await User.findById(target._id);
    expect(updated.role).toBe("sales_manager");
  });
});

// ─── PATCH /api/users/:id/status ──────────────────────────────────────────────
describe("PATCH /api/users/:id/status", () => {
  it("returns 401 when unauthenticated", async () => {
    const u = await createUser();
    const res = await request(app)
      .patch(`/api/users/${u._id}/status`)
      .send({ isActive: false });
    expect(res.status).toBe(401);
  });

  it("returns 403 for sales_rep", async () => {
    const rep = await createUser("sales_rep");
    const target = await createUser("sales_manager");
    const res = await request(app)
      .patch(`/api/users/${target._id}/status`)
      .set(cookie("sales_rep", rep._id.toString()))
      .send({ isActive: false });
    expect(res.status).toBe(403);
  });

  it("returns 422 for invalid Mongo ID", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .patch("/api/users/bad-id/status")
      .set(cookie("admin", admin._id.toString()))
      .send({ isActive: false });
    expect(res.status).toBe(422);
  });

  it("returns 422 when isActive is missing", async () => {
    const admin = await createUser("admin");
    const target = await createUser("sales_rep");
    const res = await request(app)
      .patch(`/api/users/${target._id}/status`)
      .set(cookie("admin", admin._id.toString()))
      .send({});
    expect(res.status).toBe(422);
  });

  it("returns 422 when isActive is not a boolean", async () => {
    const admin = await createUser("admin");
    const target = await createUser("sales_rep");
    const res = await request(app)
      .patch(`/api/users/${target._id}/status`)
      .set(cookie("admin", admin._id.toString()))
      .send({ isActive: "yes" });
    expect(res.status).toBe(422);
  });

  it("returns 404 when user not found", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .patch("/api/users/000000000000000000000001/status")
      .set(cookie("admin", admin._id.toString()))
      .send({ isActive: false });
    expect(res.status).toBe(404);
  });

  it("returns 200 and deactivates user", async () => {
    const admin = await createUser("admin");
    const target = await createUser("sales_rep", { isActive: true });
    const res = await request(app)
      .patch(`/api/users/${target._id}/status`)
      .set(cookie("admin", admin._id.toString()))
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
    const updated = await User.findById(target._id);
    expect(updated.isActive).toBe(false);
  });

  it("returns 200 and activates user", async () => {
    const admin = await createUser("admin");
    const target = await createUser("sales_rep", { isActive: false });
    const res = await request(app)
      .patch(`/api/users/${target._id}/status`)
      .set(cookie("admin", admin._id.toString()))
      .send({ isActive: true });
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(true);
  });
});

// ─── POST /api/users/invite ────────────────────────────────────────────────────
describe("POST /api/users/invite", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app)
      .post("/api/users/invite")
      .send({ email: "new@example.com" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for sales_rep", async () => {
    const rep = await createUser("sales_rep");
    const res = await request(app)
      .post("/api/users/invite")
      .set(cookie("sales_rep", rep._id.toString()))
      .send({ email: "new@example.com" });
    expect(res.status).toBe(403);
  });

  it("returns 422 when email is missing", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/users/invite")
      .set(cookie("admin", admin._id.toString()))
      .send({});
    expect(res.status).toBe(422);
  });

  it("returns 422 when email is invalid", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/users/invite")
      .set(cookie("admin", admin._id.toString()))
      .send({ email: "not-an-email" });
    expect(res.status).toBe(422);
  });

  it("returns 409 when email is already active", async () => {
    const admin = await createUser("admin");
    const existing = await createUser("sales_rep", { isActive: true });
    const res = await request(app)
      .post("/api/users/invite")
      .set(cookie("admin", admin._id.toString()))
      .send({ email: existing.email });
    expect(res.status).toBe(409);
  });

  it("returns 201 and creates a pending user", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/users/invite")
      .set(cookie("admin", admin._id.toString()))
      .send({ email: "invite-new@example.com" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email: "invite-new@example.com" });
    const created = await User.findOne({ email: "invite-new@example.com" });
    expect(created).not.toBeNull();
    expect(created.isActive).toBe(false);
    expect(created.passwordHash).toBeNull();
    expect(created.inviteToken).toBeTruthy();
  });

  it("returns 201 and assigns the specified role to the pending user", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/users/invite")
      .set(cookie("admin", admin._id.toString()))
      .send({ email: "invite-exec@example.com", role: "executive" });
    expect(res.status).toBe(201);
    const created = await User.findOne({ email: "invite-exec@example.com" });
    expect(created.role).toBe("executive");
  });

  it("returns 422 for an invalid role value", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/users/invite")
      .set(cookie("admin", admin._id.toString()))
      .send({ email: "invite-bad@example.com", role: "god" });
    expect(res.status).toBe(422);
  });

  it("returns 201 and refreshes token for pending (not yet accepted) user", async () => {
    const admin = await createUser("admin");
    // First invite
    await request(app)
      .post("/api/users/invite")
      .set(cookie("admin", admin._id.toString()))
      .send({ email: "pending@example.com" });

    const firstInvite = await User.findOne({ email: "pending@example.com" });
    const firstToken = firstInvite.inviteToken;

    // Re-invite — should succeed and refresh token
    const res = await request(app)
      .post("/api/users/invite")
      .set(cookie("admin", admin._id.toString()))
      .send({ email: "pending@example.com" });
    expect(res.status).toBe(201);

    const refreshed = await User.findOne({ email: "pending@example.com" });
    expect(refreshed.inviteToken).not.toBe(firstToken);
  });
});
