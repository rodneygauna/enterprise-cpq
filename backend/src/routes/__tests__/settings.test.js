/**
 * Settings route tests — covers FR-BRAND-1 through FR-BRAND-4,
 *                         FR-DISC-1 (discount governance settings).
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
 *
 *   PUT /api/settings/discount
 *   - returns 401 when unauthenticated
 *   - returns 403 when sales_rep tries to update
 *   - returns 403 when sales_manager tries to update
 *   - returns 200 when admin updates thresholds
 *   - returns 200 when super_admin updates thresholds
 *   - returns 422 for managerReviewPercent out of range
 *   - stores volumeDiscountRules array
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

// ─── PUT /api/settings/discount ───────────────────────────────────────────────
describe("PUT /api/settings/discount", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app)
      .put("/api/settings/discount")
      .send({ discountThresholds: { managerReviewPercent: 15 } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when sales_rep tries to update", async () => {
    const user = await createUser("sales_rep");
    const token = tokenFor("sales_rep", user._id.toString());
    const res = await request(app)
      .put("/api/settings/discount")
      .set("Cookie", `access_token=${token}`)
      .send({ discountThresholds: { managerReviewPercent: 15 } });
    expect(res.status).toBe(403);
  });

  it("returns 403 when sales_manager tries to update", async () => {
    const user = await createUser("sales_manager");
    const token = tokenFor("sales_manager", user._id.toString());
    const res = await request(app)
      .put("/api/settings/discount")
      .set("Cookie", `access_token=${token}`)
      .send({ discountThresholds: { managerReviewPercent: 15 } });
    expect(res.status).toBe(403);
  });

  it("returns 200 when admin updates discount thresholds", async () => {
    const user = await createUser("admin");
    const token = tokenFor("admin", user._id.toString());
    const res = await request(app)
      .put("/api/settings/discount")
      .set("Cookie", `access_token=${token}`)
      .send({
        discountThresholds: {
          managerReviewPercent: 12,
          executiveReviewPercent: 30,
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.data.discountThresholds.managerReviewPercent).toBe(12);
    expect(res.body.data.discountThresholds.executiveReviewPercent).toBe(30);
  });

  it("returns 200 when super_admin updates discount thresholds", async () => {
    const user = await createUser("super_admin");
    const token = tokenFor("super_admin", user._id.toString());
    const res = await request(app)
      .put("/api/settings/discount")
      .set("Cookie", `access_token=${token}`)
      .send({
        discountThresholds: {
          managerReviewPercent: 8,
          executiveReviewPercent: 20,
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.data.discountThresholds.managerReviewPercent).toBe(8);
  });

  it("returns 422 for managerReviewPercent out of range (>100)", async () => {
    const user = await createUser("admin");
    const token = tokenFor("admin", user._id.toString());
    const res = await request(app)
      .put("/api/settings/discount")
      .set("Cookie", `access_token=${token}`)
      .send({
        discountThresholds: { managerReviewPercent: 150 },
      });
    expect(res.status).toBe(422);
  });

  it("stores volumeDiscountRules array", async () => {
    const user = await createUser("admin");
    const token = tokenFor("admin", user._id.toString());
    const rules = [
      { membersThreshold: 50000, discountPercent: 5 },
      { membersThreshold: 200000, discountPercent: 10 },
    ];
    const res = await request(app)
      .put("/api/settings/discount")
      .set("Cookie", `access_token=${token}`)
      .send({ volumeDiscountRules: rules });
    expect(res.status).toBe(200);
    expect(res.body.data.volumeDiscountRules).toHaveLength(2);
    expect(res.body.data.volumeDiscountRules[0].discountPercent).toBe(5);
  });
});

// ── PUT /api/settings/margin ──────────────────────────────────────────────────
describe("PUT /api/settings/margin", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const res = await request(app)
      .put("/api/settings/margin")
      .send({ marginTargets: { global: { green: 55, yellow: 35 } } });
    expect(res.status).toBe(401);
  });

  it("returns 403 for sales_rep", async () => {
    const user = await createUser("sales_rep");
    const token = tokenFor("sales_rep", user._id.toString());
    const res = await request(app)
      .put("/api/settings/margin")
      .set("Cookie", `access_token=${token}`)
      .send({ marginTargets: { global: { green: 55, yellow: 35 } } });
    expect(res.status).toBe(403);
  });

  it("returns 200 and updates global thresholds for admin", async () => {
    const user = await createUser("admin");
    const token = tokenFor("admin", user._id.toString());
    const res = await request(app)
      .put("/api/settings/margin")
      .set("Cookie", `access_token=${token}`)
      .send({ marginTargets: { global: { green: 60, yellow: 40 } } });
    expect(res.status).toBe(200);
    expect(res.body.data.marginTargets.global.green).toBe(60);
    expect(res.body.data.marginTargets.global.yellow).toBe(40);
  });

  it("returns 200 and updates global thresholds for super_admin", async () => {
    const user = await createUser("super_admin");
    const token = tokenFor("super_admin", user._id.toString());
    const res = await request(app)
      .put("/api/settings/margin")
      .set("Cookie", `access_token=${token}`)
      .send({ marginTargets: { global: { green: 55, yellow: 35 } } });
    expect(res.status).toBe(200);
    expect(res.body.data.marginTargets.global.green).toBe(55);
  });

  it("returns 422 when global.green is out of range (> 100)", async () => {
    const user = await createUser("admin");
    const token = tokenFor("admin", user._id.toString());
    const res = await request(app)
      .put("/api/settings/margin")
      .set("Cookie", `access_token=${token}`)
      .send({ marginTargets: { global: { green: 120, yellow: 30 } } });
    expect(res.status).toBe(422);
  });

  it("stores per-product-line overrides", async () => {
    const user = await createUser("admin");
    const token = tokenFor("admin", user._id.toString());
    const res = await request(app)
      .put("/api/settings/margin")
      .set("Cookie", `access_token=${token}`)
      .send({
        marginTargets: {
          global: { green: 50, yellow: 30 },
          productLines: {
            "Core Benefits": { green: 65, yellow: 45 },
          },
        },
      });
    expect(res.status).toBe(200);
    // productLines is stored as a Map; the response serializes it as an object
    const productLines = res.body.data.marginTargets.productLines;
    expect(productLines["Core Benefits"]).toMatchObject({
      green: 65,
      yellow: 45,
    });
  });
});
