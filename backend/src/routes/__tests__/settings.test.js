/**
 * Settings route tests — covers FR-BRAND-1 through FR-BRAND-4.
 * Uses mongodb-memory-server; no real DB connections.
 *
 * Test coverage:
 *   - GET returns defaults when no settings document exists
 *   - GET returns stored settings when they exist
 *   - GET does not require authentication
 *   - PUT returns 401 when unauthenticated
 *   - PUT returns 403 when role is not super_admin
 *   - PUT returns 200 and updates settings for super_admin
 *   - PUT returns 422 for invalid hex color value
 *   - PUT returns 422 when companyName is blank string
 */

const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../../app");
const Settings = require("../../models/Settings");
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
async function createUser(role = "sales_rep") {
  return User.create({
    email: `${role}@example.com`,
    passwordHash: await bcrypt.hash("Password123!", 12),
    firstName: "Test",
    lastName: "User",
    role,
    isActive: true,
  });
}

// ─── GET /api/settings ────────────────────────────────────────────────────────
describe("GET /api/settings", () => {
  it("returns 200 with default values when no settings document exists", async () => {
    const res = await request(app).get("/api/settings");

    expect(res.status).toBe(200);
    expect(res.body.data.companyName).toBe("Enterprise CPQ");
    expect(res.body.data.primaryColor).toBe("#0d6efd");
    expect(res.body.data.accentColor).toBe("#6c757d");
    expect(res.body.error).toBeNull();
  });

  it("returns 200 with stored settings when they exist", async () => {
    await Settings.create({
      companyName: "Acme Health",
      primaryColor: "#ff0000",
    });

    const res = await request(app).get("/api/settings");

    expect(res.status).toBe(200);
    expect(res.body.data.companyName).toBe("Acme Health");
    expect(res.body.data.primaryColor).toBe("#ff0000");
  });

  it("does not require authentication (200 with no cookies)", async () => {
    const res = await request(app).get("/api/settings");
    expect(res.status).toBe(200);
  });
});

// ─── PUT /api/settings ────────────────────────────────────────────────────────
describe("PUT /api/settings", () => {
  it("returns 401 when not authenticated", async () => {
    const res = await request(app)
      .put("/api/settings")
      .send({ companyName: "Test" });

    expect(res.status).toBe(401);
  });

  it("returns 403 when role is not super_admin", async () => {
    for (const role of ["sales_rep", "sales_manager", "admin", "executive"]) {
      const user = await createUser(role);
      const token = tokenFor(role, user._id.toString());
      const res = await request(app)
        .put("/api/settings")
        .set("Cookie", `access_token=${token}`)
        .send({ companyName: "Test" });

      expect(res.status).toBe(403);
      await User.deleteOne({ _id: user._id });
    }
  });

  it("updates settings and returns 200 for super_admin", async () => {
    const user = await createUser("super_admin");
    const token = tokenFor("super_admin", user._id.toString());
    const res = await request(app)
      .put("/api/settings")
      .set("Cookie", `access_token=${token}`)
      .send({ companyName: "Updated Corp", primaryColor: "#123456" });

    expect(res.status).toBe(200);
    expect(res.body.data.companyName).toBe("Updated Corp");
    expect(res.body.data.primaryColor).toBe("#123456");
    expect(res.body.error).toBeNull();
  });

  it("persists changes to the database", async () => {
    const user = await createUser("super_admin");
    const token = tokenFor("super_admin", user._id.toString());
    await request(app)
      .put("/api/settings")
      .set("Cookie", `access_token=${token}`)
      .send({ companyName: "Persisted Corp" });

    const stored = await Settings.findOne({});
    expect(stored.companyName).toBe("Persisted Corp");
  });

  it("returns 422 for invalid hex color", async () => {
    const user = await createUser("super_admin");
    const token = tokenFor("super_admin", user._id.toString());
    const res = await request(app)
      .put("/api/settings")
      .set("Cookie", `access_token=${token}`)
      .send({ primaryColor: "not-a-color" });

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it("returns 422 when companyName is a blank string", async () => {
    const user = await createUser("super_admin");
    const token = tokenFor("super_admin", user._id.toString());
    const res = await request(app)
      .put("/api/settings")
      .set("Cookie", `access_token=${token}`)
      .send({ companyName: "" });

    expect(res.status).toBe(422);
  });
});
