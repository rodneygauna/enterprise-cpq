/**
 * Quote route tests — covers FR-QUOTE-15 (save/load), FR-QUOTE-16 (duplicate),
 *                     and FR-DISC-3/4 (submit, approve, reject, approval queue).
 * Uses mongodb-memory-server; no real DB connections.
 *
 * Coverage:
 *   GET /api/quotes
 *     - 401 unauthenticated
 *     - 200 + empty array when no quotes
 *     - 200 + sales_rep sees only own quotes
 *     - 200 + admin sees all quotes
 *     - 200 + filters by status
 *     - 200 + filters by clientName
 *
 *   GET /api/quotes/:id
 *     - 401 unauthenticated
 *     - 422 for invalid Mongo ID
 *     - 404 when not found
 *     - 404 when sales_rep requests another user's quote
 *     - 200 + quote for owner
 *     - 200 + quote for admin viewing any quote
 *
 *   POST /api/quotes
 *     - 401 unauthenticated
 *     - 422 when clientName is missing
 *     - 201 + created quote as sales_rep
 *     - 201 + ownerId set to authenticated user
 *     - 201 + status defaults to Draft
 *
 *   PUT /api/quotes/:id
 *     - 401 unauthenticated
 *     - 422 invalid Mongo ID
 *     - 404 not found
 *     - 403 when non-owner sales_rep tries to edit
 *     - 400 when attempting to edit a non-Draft quote as non-admin
 *     - 200 + updated quote for owner
 *     - 200 + admin can update any quote
 *
 *   DELETE /api/quotes/:id
 *     - 401 unauthenticated
 *     - 404 not found
 *     - 403 non-owner cannot delete
 *     - 200 + deleted for owner
 *     - 200 + admin can delete any quote
 *
 *   POST /api/quotes/:id/duplicate
 *     - 401 unauthenticated
 *     - 404 not found
 *     - 403 sales_rep cannot duplicate another user's quote
 *     - 201 + copy with "Copy of" prefix for owner
 *     - 201 + admin can duplicate any quote
 *
 *   POST /api/quotes/:id/submit
 *     - 401 unauthenticated
 *     - 404 not found
 *     - 403 non-owner sales_rep cannot submit
 *     - 400 when quote is not Draft (already submitted)
 *     - 200 + auto-approved when no threshold exceeded
 *     - 200 + Manager Review when discount exceeds manager threshold (boundary)
 *     - 200 + Executive Review when discount exceeds executive threshold
 *     - 200 + admin can submit any quote
 *
 *   POST /api/quotes/:id/approve
 *     - 401 unauthenticated
 *     - 403 sales_rep cannot approve
 *     - 404 not found
 *     - 400 when quote is not pending approval
 *     - 403 sales_manager cannot approve Executive Review quote
 *     - 200 + approved by executive
 *     - 200 + comment stored on quote
 *
 *   POST /api/quotes/:id/reject
 *     - 401 unauthenticated
 *     - 403 sales_rep cannot reject
 *     - 404 not found
 *     - 400 when quote is not pending approval
 *     - 200 + rejected with comment
 *
 *   GET /api/quotes/approval-queue
 *     - 401 unauthenticated
 *     - 403 sales_rep cannot access
 *     - 200 + returns pending quotes for sales_manager
 *     - 200 + returns both Manager Review and Executive Review quotes
 *     - 200 + empty when no pending quotes
 */
const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../../app");
const Quote = require("../../models/Quote");
const User = require("../../models/User");
const Settings = require("../../models/Settings");
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
    email: `${role}-${Date.now()}-${Math.random()}@example.com`,
    passwordHash: await bcrypt.hash("Password123!", 12),
    firstName: "Test",
    lastName: role,
    role,
    isActive: true,
  });
}

function cookie(role, userId) {
  return { Cookie: `access_token=${tokenFor(role, userId)}` };
}

async function createQuote(ownerId, overrides = {}) {
  return Quote.create({
    clientName: "Acme Corp",
    membershipCount: 5000,
    termLength: 12,
    annualUplift: 0,
    ownerId,
    status: "Draft",
    selectedItems: [],
    ...overrides,
  });
}

// ─── GET /api/quotes ──────────────────────────────────────────────────────────
describe("GET /api/quotes", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/quotes");
    expect(res.status).toBe(401);
  });

  it("returns 200 + empty array when no quotes", async () => {
    const user = await createUser("sales_rep");
    const res = await request(app)
      .get("/api/quotes")
      .set(cookie("sales_rep", user._id));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it("sales_rep sees only own quotes", async () => {
    const rep = await createUser("sales_rep");
    const other = await createUser("admin");
    await createQuote(rep._id, { clientName: "My Client" });
    await createQuote(other._id, { clientName: "Their Client" });

    const res = await request(app)
      .get("/api/quotes")
      .set(cookie("sales_rep", rep._id));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].clientName).toBe("My Client");
  });

  it("admin sees all quotes", async () => {
    const rep = await createUser("sales_rep");
    const admin = await createUser("admin");
    await createQuote(rep._id);
    await createQuote(admin._id);

    const res = await request(app)
      .get("/api/quotes")
      .set(cookie("admin", admin._id));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it("filters by status", async () => {
    const admin = await createUser("admin");
    await createQuote(admin._id, { status: "Draft" });
    await createQuote(admin._id, { status: "Approved", clientName: "B" });

    const res = await request(app)
      .get("/api/quotes?status=Approved")
      .set(cookie("admin", admin._id));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe("Approved");
  });

  it("filters by clientName (case-insensitive)", async () => {
    const admin = await createUser("admin");
    await createQuote(admin._id, { clientName: "Alpha Health" });
    await createQuote(admin._id, { clientName: "Beta Corp" });

    const res = await request(app)
      .get("/api/quotes?clientName=alpha")
      .set(cookie("admin", admin._id));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].clientName).toBe("Alpha Health");
  });
});

// ─── GET /api/quotes/:id ──────────────────────────────────────────────────────
describe("GET /api/quotes/:id", () => {
  it("returns 401 when unauthenticated", async () => {
    const user = await createUser();
    const q = await createQuote(user._id);
    const res = await request(app).get(`/api/quotes/${q._id}`);
    expect(res.status).toBe(401);
  });

  it("returns 422 for invalid Mongo ID", async () => {
    const user = await createUser();
    const res = await request(app)
      .get("/api/quotes/not-a-valid-id")
      .set(cookie("sales_rep", user._id));
    expect(res.status).toBe(422);
  });

  it("returns 404 when not found", async () => {
    const user = await createUser();
    const fakeId = "64000000000000000000abcd";
    const res = await request(app)
      .get(`/api/quotes/${fakeId}`)
      .set(cookie("sales_rep", user._id));
    expect(res.status).toBe(404);
  });

  it("returns 404 when sales_rep requests another user's quote", async () => {
    const owner = await createUser("sales_rep");
    const stranger = await createUser("sales_rep");
    const q = await createQuote(owner._id);

    const res = await request(app)
      .get(`/api/quotes/${q._id}`)
      .set(cookie("sales_rep", stranger._id));
    expect(res.status).toBe(404);
  });

  it("returns 200 for the quote owner", async () => {
    const owner = await createUser("sales_rep");
    const q = await createQuote(owner._id, { clientName: "Target Client" });

    const res = await request(app)
      .get(`/api/quotes/${q._id}`)
      .set(cookie("sales_rep", owner._id));
    expect(res.status).toBe(200);
    expect(res.body.data.clientName).toBe("Target Client");
  });

  it("returns 200 for admin viewing any quote", async () => {
    const owner = await createUser("sales_rep");
    const admin = await createUser("admin");
    const q = await createQuote(owner._id);

    const res = await request(app)
      .get(`/api/quotes/${q._id}`)
      .set(cookie("admin", admin._id));
    expect(res.status).toBe(200);
    expect(res.body.data._id.toString()).toBe(q._id.toString());
  });
});

// ─── POST /api/quotes ─────────────────────────────────────────────────────────
describe("POST /api/quotes", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app)
      .post("/api/quotes")
      .send({ clientName: "Test" });
    expect(res.status).toBe(401);
  });

  it("returns 422 when clientName is missing", async () => {
    const user = await createUser();
    const res = await request(app)
      .post("/api/quotes")
      .set(cookie("sales_rep", user._id))
      .send({ membershipCount: 1000 });
    expect(res.status).toBe(422);
  });

  it("returns 201 + created quote as sales_rep", async () => {
    const user = await createUser("sales_rep");
    const res = await request(app)
      .post("/api/quotes")
      .set(cookie("sales_rep", user._id))
      .send({ clientName: "New Client", termLength: 24 });
    expect(res.status).toBe(201);
    expect(res.body.data.clientName).toBe("New Client");
    expect(res.body.data.termLength).toBe(24);
  });

  it("sets ownerId to the authenticated user", async () => {
    const user = await createUser("sales_rep");
    const res = await request(app)
      .post("/api/quotes")
      .set(cookie("sales_rep", user._id))
      .send({ clientName: "Owner Test" });
    expect(res.status).toBe(201);
    expect(res.body.data.ownerId.toString()).toBe(user._id.toString());
  });

  it("defaults status to Draft", async () => {
    const user = await createUser();
    const res = await request(app)
      .post("/api/quotes")
      .set(cookie("sales_rep", user._id))
      .send({ clientName: "Draft Test" });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("Draft");
  });
});

// ─── PUT /api/quotes/:id ──────────────────────────────────────────────────────
describe("PUT /api/quotes/:id", () => {
  it("returns 401 when unauthenticated", async () => {
    const user = await createUser();
    const q = await createQuote(user._id);
    const res = await request(app)
      .put(`/api/quotes/${q._id}`)
      .send({ clientName: "Changed" });
    expect(res.status).toBe(401);
  });

  it("returns 422 for invalid Mongo ID", async () => {
    const user = await createUser();
    const res = await request(app)
      .put("/api/quotes/bad-id")
      .set(cookie("sales_rep", user._id))
      .send({ clientName: "x" });
    expect(res.status).toBe(422);
  });

  it("returns 404 when not found", async () => {
    const user = await createUser();
    const res = await request(app)
      .put("/api/quotes/64000000000000000000abcd")
      .set(cookie("sales_rep", user._id))
      .send({ clientName: "x" });
    expect(res.status).toBe(404);
  });

  it("returns 403 when non-owner sales_rep tries to edit", async () => {
    const owner = await createUser("sales_rep");
    const stranger = await createUser("sales_rep");
    const q = await createQuote(owner._id);

    const res = await request(app)
      .put(`/api/quotes/${q._id}`)
      .set(cookie("sales_rep", stranger._id))
      .send({ clientName: "Hijacked" });
    expect(res.status).toBe(403);
  });

  it("returns 400 when non-admin attempts to edit a pending quote", async () => {
    const owner = await createUser("sales_rep");
    const q = await createQuote(owner._id, { status: "Manager Review" });

    const res = await request(app)
      .put(`/api/quotes/${q._id}`)
      .set(cookie("sales_rep", owner._id))
      .send({ clientName: "Changed" });
    expect(res.status).toBe(400);
  });

  it("returns 200 + updated quote for the owner", async () => {
    const owner = await createUser("sales_rep");
    const q = await createQuote(owner._id);

    const res = await request(app)
      .put(`/api/quotes/${q._id}`)
      .set(cookie("sales_rep", owner._id))
      .send({ clientName: "Updated Name" });
    expect(res.status).toBe(200);
    expect(res.body.data.clientName).toBe("Updated Name");
  });

  it("admin can update any quote regardless of status", async () => {
    const owner = await createUser("sales_rep");
    const admin = await createUser("admin");
    const q = await createQuote(owner._id, { status: "Manager Review" });

    const res = await request(app)
      .put(`/api/quotes/${q._id}`)
      .set(cookie("admin", admin._id))
      .send({ clientName: "Admin Override" });
    expect(res.status).toBe(200);
    expect(res.body.data.clientName).toBe("Admin Override");
  });
});

// ─── DELETE /api/quotes/:id ───────────────────────────────────────────────────
describe("DELETE /api/quotes/:id", () => {
  it("returns 401 when unauthenticated", async () => {
    const user = await createUser();
    const q = await createQuote(user._id);
    const res = await request(app).delete(`/api/quotes/${q._id}`);
    expect(res.status).toBe(401);
  });

  it("returns 404 when not found", async () => {
    const user = await createUser();
    const res = await request(app)
      .delete("/api/quotes/64000000000000000000abcd")
      .set(cookie("sales_rep", user._id));
    expect(res.status).toBe(404);
  });

  it("returns 403 when non-owner sales_rep tries to delete", async () => {
    const owner = await createUser("sales_rep");
    const stranger = await createUser("sales_rep");
    const q = await createQuote(owner._id);

    const res = await request(app)
      .delete(`/api/quotes/${q._id}`)
      .set(cookie("sales_rep", stranger._id));
    expect(res.status).toBe(403);
  });

  it("returns 200 for the owner", async () => {
    const owner = await createUser("sales_rep");
    const q = await createQuote(owner._id);

    const res = await request(app)
      .delete(`/api/quotes/${q._id}`)
      .set(cookie("sales_rep", owner._id));
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);

    const gone = await Quote.findById(q._id);
    expect(gone).toBeNull();
  });

  it("admin can delete any quote", async () => {
    const owner = await createUser("sales_rep");
    const admin = await createUser("admin");
    const q = await createQuote(owner._id);

    const res = await request(app)
      .delete(`/api/quotes/${q._id}`)
      .set(cookie("admin", admin._id));
    expect(res.status).toBe(200);
  });
});

// ─── POST /api/quotes/:id/duplicate ──────────────────────────────────────────
describe("POST /api/quotes/:id/duplicate", () => {
  it("returns 401 when unauthenticated", async () => {
    const user = await createUser();
    const q = await createQuote(user._id);
    const res = await request(app).post(`/api/quotes/${q._id}/duplicate`);
    expect(res.status).toBe(401);
  });

  it("returns 404 when not found", async () => {
    const user = await createUser();
    const res = await request(app)
      .post("/api/quotes/64000000000000000000abcd/duplicate")
      .set(cookie("sales_rep", user._id));
    expect(res.status).toBe(404);
  });

  it("returns 403 when sales_rep duplicates another user's quote", async () => {
    const owner = await createUser("sales_rep");
    const stranger = await createUser("sales_rep");
    const q = await createQuote(owner._id);

    const res = await request(app)
      .post(`/api/quotes/${q._id}/duplicate`)
      .set(cookie("sales_rep", stranger._id));
    expect(res.status).toBe(403);
  });

  it("returns 201 + copy with 'Copy of' prefix for the owner", async () => {
    const owner = await createUser("sales_rep");
    const q = await createQuote(owner._id, { clientName: "Original" });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/duplicate`)
      .set(cookie("sales_rep", owner._id));
    expect(res.status).toBe(201);
    expect(res.body.data.clientName).toBe("Copy of Original");
    expect(res.body.data.status).toBe("Draft");
    // New quote should have a new _id
    expect(res.body.data._id).not.toBe(q._id.toString());
  });

  it("admin can duplicate any quote", async () => {
    const owner = await createUser("sales_rep");
    const admin = await createUser("admin");
    const q = await createQuote(owner._id, { clientName: "Alpha" });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/duplicate`)
      .set(cookie("admin", admin._id));
    expect(res.status).toBe(201);
    expect(res.body.data.clientName).toBe("Copy of Alpha");
    expect(res.body.data.ownerId.toString()).toBe(admin._id.toString());
  });
});

// ─── GET /api/quotes — new filters (FR-DASH-4) ───────────────────────────────
describe("GET /api/quotes — date range and product line filters", () => {
  it("returns 422 for invalid dateFrom format", async () => {
    const user = await createUser("admin");
    const res = await request(app)
      .get("/api/quotes?dateFrom=not-a-date")
      .set(cookie("admin", user._id));
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid dateTo format", async () => {
    const user = await createUser("admin");
    const res = await request(app)
      .get("/api/quotes?dateTo=not-a-date")
      .set(cookie("admin", user._id));
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid productLineId", async () => {
    const user = await createUser("admin");
    const res = await request(app)
      .get("/api/quotes?productLineId=bad-id")
      .set(cookie("admin", user._id));
    expect(res.status).toBe(422);
  });

  it("filters by dateFrom — excludes quotes before that date", async () => {
    const admin = await createUser("admin");
    const past = new Date("2020-01-01");
    const recent = new Date("2025-06-01");
    await Quote.create({
      clientName: "Old Quote",
      ownerId: admin._id,
      status: "Draft",
      createdAt: past,
    });
    await Quote.create({
      clientName: "New Quote",
      ownerId: admin._id,
      status: "Draft",
      createdAt: recent,
    });

    const res = await request(app)
      .get("/api/quotes?dateFrom=2024-01-01")
      .set(cookie("admin", admin._id));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].clientName).toBe("New Quote");
  });

  it("filters by dateTo — excludes quotes after that date", async () => {
    const admin = await createUser("admin");
    await Quote.create({
      clientName: "Old",
      ownerId: admin._id,
      status: "Draft",
      createdAt: new Date("2020-06-01"),
    });
    await Quote.create({
      clientName: "New",
      ownerId: admin._id,
      status: "Draft",
      createdAt: new Date("2025-06-01"),
    });

    const res = await request(app)
      .get("/api/quotes?dateTo=2023-12-31")
      .set(cookie("admin", admin._id));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].clientName).toBe("Old");
  });
});

// ─── GET /api/quotes/stats (FR-DASH-3) ───────────────────────────────────────
describe("GET /api/quotes/stats", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/quotes/stats");
    expect(res.status).toBe(401);
  });

  it("returns 200 with zero totals when no quotes exist", async () => {
    const user = await createUser("admin");
    const res = await request(app)
      .get("/api/quotes/stats")
      .set(cookie("admin", user._id));
    expect(res.status).toBe(200);
    expect(res.body.data.totalQuotes).toBe(0);
    expect(res.body.data.totalPipeline).toBe(0);
    expect(res.body.data.byLineCount).toEqual([]);
    expect(res.body.data.byLineTCV).toEqual([]);
  });

  it("returns correct totalQuotes count for admin", async () => {
    const admin = await createUser("admin");
    const rep = await createUser("sales_rep");
    await createQuote(admin._id);
    await createQuote(rep._id);

    const res = await request(app)
      .get("/api/quotes/stats")
      .set(cookie("admin", admin._id));
    expect(res.status).toBe(200);
    expect(res.body.data.totalQuotes).toBe(2);
  });

  it("returns totalPipeline as sum of netTCV", async () => {
    const admin = await createUser("admin");
    await createQuote(admin._id, { netTCV: 50000 });
    await createQuote(admin._id, { netTCV: 30000 });

    const res = await request(app)
      .get("/api/quotes/stats")
      .set(cookie("admin", admin._id));
    expect(res.status).toBe(200);
    expect(res.body.data.totalPipeline).toBe(80000);
  });

  it("sales_rep stats are scoped to own quotes only", async () => {
    const rep = await createUser("sales_rep");
    const admin = await createUser("admin");
    await createQuote(rep._id, { netTCV: 20000 });
    await createQuote(admin._id, { netTCV: 100000 });

    const res = await request(app)
      .get("/api/quotes/stats")
      .set(cookie("sales_rep", rep._id));
    expect(res.status).toBe(200);
    expect(res.body.data.totalQuotes).toBe(1);
    expect(res.body.data.totalPipeline).toBe(20000);
  });
});

// ─── Helpers for discount thresholds ─────────────────────────────────────────
async function seedSettings(overrides = {}) {
  return Settings.create({
    discountThresholds: {
      managerReviewPercent: 10,
      executiveReviewPercent: 25,
      ...overrides,
    },
  });
}

function makeDiscountItem(pct) {
  return {
    productId: new (require("mongoose").Types.ObjectId)(),
    productSnapshot: { name: "Test", pricingModel: "PMPM", basePrice: 10 },
    quantity: 1,
    adjustmentDirection: "discount",
    adjustmentType: "percentage",
    adjustmentValue: pct,
    extendedPrice: 100,
    implementationFee: 0,
    adjustedPrice: 100 * (1 - pct / 100),
  };
}

// ─── POST /api/quotes/:id/submit ──────────────────────────────────────────────
describe("POST /api/quotes/:id/submit", () => {
  beforeEach(async () => seedSettings());

  it("returns 401 when unauthenticated", async () => {
    const owner = await createUser("sales_rep");
    const q = await createQuote(owner._id);
    const res = await request(app).post(`/api/quotes/${q._id}/submit`);
    expect(res.status).toBe(401);
  });

  it("returns 404 when quote does not exist", async () => {
    const user = await createUser("sales_rep");
    const fakeId = new (require("mongoose").Types.ObjectId)();
    const res = await request(app)
      .post(`/api/quotes/${fakeId}/submit`)
      .set(cookie("sales_rep", user._id));
    expect(res.status).toBe(404);
  });

  it("returns 403 when non-owner sales_rep tries to submit", async () => {
    const owner = await createUser("sales_rep");
    const other = await createUser("sales_rep");
    const q = await createQuote(owner._id);

    const res = await request(app)
      .post(`/api/quotes/${q._id}/submit`)
      .set(cookie("sales_rep", other._id));
    expect(res.status).toBe(403);
  });

  it("returns 400 when quote is not Draft", async () => {
    const owner = await createUser("sales_rep");
    const q = await createQuote(owner._id, { status: "Manager Review" });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/submit`)
      .set(cookie("sales_rep", owner._id));
    expect(res.status).toBe(400);
  });

  it("auto-approves when no threshold is exceeded", async () => {
    const owner = await createUser("sales_rep");
    // 5% discount — below 10% manager threshold
    const q = await createQuote(owner._id, {
      selectedItems: [makeDiscountItem(5)],
    });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/submit`)
      .set(cookie("sales_rep", owner._id));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("Approved");
  });

  it("routes to Manager Review when discount exactly at boundary (10% boundary → auto-approve)", async () => {
    const owner = await createUser("sales_rep");
    // exactly 10% = NOT > 10% → auto-approve
    const q = await createQuote(owner._id, {
      selectedItems: [makeDiscountItem(10)],
    });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/submit`)
      .set(cookie("sales_rep", owner._id));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("Approved");
  });

  it("routes to Manager Review when discount exceeds manager threshold", async () => {
    const owner = await createUser("sales_rep");
    // 15% > 10% manager threshold
    const q = await createQuote(owner._id, {
      selectedItems: [makeDiscountItem(15)],
    });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/submit`)
      .set(cookie("sales_rep", owner._id));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("Manager Review");
  });

  it("routes to Executive Review when discount exceeds executive threshold", async () => {
    const owner = await createUser("sales_rep");
    // 30% > 25% executive threshold
    const q = await createQuote(owner._id, {
      selectedItems: [makeDiscountItem(30)],
    });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/submit`)
      .set(cookie("sales_rep", owner._id));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("Executive Review");
  });

  it("admin can submit any quote", async () => {
    const owner = await createUser("sales_rep");
    const admin = await createUser("admin");
    const q = await createQuote(owner._id, {
      selectedItems: [makeDiscountItem(5)],
    });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/submit`)
      .set(cookie("admin", admin._id));
    expect(res.status).toBe(200);
  });
});

// ─── POST /api/quotes/:id/approve ─────────────────────────────────────────────
describe("POST /api/quotes/:id/approve", () => {
  it("returns 401 when unauthenticated", async () => {
    const owner = await createUser("sales_rep");
    const q = await createQuote(owner._id, { status: "Manager Review" });
    const res = await request(app).post(`/api/quotes/${q._id}/approve`);
    expect(res.status).toBe(401);
  });

  it("returns 403 when sales_rep tries to approve", async () => {
    const owner = await createUser("sales_rep");
    const rep2 = await createUser("sales_rep");
    const q = await createQuote(owner._id, { status: "Manager Review" });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/approve`)
      .set(cookie("sales_rep", rep2._id));
    expect(res.status).toBe(403);
  });

  it("returns 404 when quote does not exist", async () => {
    const manager = await createUser("sales_manager");
    const fakeId = new (require("mongoose").Types.ObjectId)();
    const res = await request(app)
      .post(`/api/quotes/${fakeId}/approve`)
      .set(cookie("sales_manager", manager._id));
    expect(res.status).toBe(404);
  });

  it("returns 400 when quote is not pending approval", async () => {
    const owner = await createUser("sales_rep");
    const manager = await createUser("sales_manager");
    const q = await createQuote(owner._id, { status: "Draft" });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/approve`)
      .set(cookie("sales_manager", manager._id));
    expect(res.status).toBe(400);
  });

  it("returns 403 when sales_manager tries to approve an Executive Review quote", async () => {
    const owner = await createUser("sales_rep");
    const manager = await createUser("sales_manager");
    const q = await createQuote(owner._id, { status: "Executive Review" });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/approve`)
      .set(cookie("sales_manager", manager._id));
    expect(res.status).toBe(403);
  });

  it("executive can approve Manager Review quote", async () => {
    const owner = await createUser("sales_rep");
    const exec = await createUser("executive");
    const q = await createQuote(owner._id, { status: "Manager Review" });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/approve`)
      .send({ comment: "Looks good." })
      .set(cookie("executive", exec._id));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("Approved");
    expect(res.body.data.approvalComment).toBe("Looks good.");
    expect(res.body.data.approvedBy.toString()).toBe(exec._id.toString());
  });

  it("sales_manager can approve Manager Review quote", async () => {
    const owner = await createUser("sales_rep");
    const manager = await createUser("sales_manager");
    const q = await createQuote(owner._id, { status: "Manager Review" });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/approve`)
      .set(cookie("sales_manager", manager._id));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("Approved");
  });

  it("prevents double-approval (400 when already Approved)", async () => {
    const owner = await createUser("sales_rep");
    const exec = await createUser("executive");
    const q = await createQuote(owner._id, { status: "Approved" });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/approve`)
      .set(cookie("executive", exec._id));
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/quotes/:id/reject ──────────────────────────────────────────────
describe("POST /api/quotes/:id/reject", () => {
  it("returns 401 when unauthenticated", async () => {
    const owner = await createUser("sales_rep");
    const q = await createQuote(owner._id, { status: "Manager Review" });
    const res = await request(app).post(`/api/quotes/${q._id}/reject`);
    expect(res.status).toBe(401);
  });

  it("returns 403 when sales_rep tries to reject", async () => {
    const owner = await createUser("sales_rep");
    const rep2 = await createUser("sales_rep");
    const q = await createQuote(owner._id, { status: "Manager Review" });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/reject`)
      .set(cookie("sales_rep", rep2._id));
    expect(res.status).toBe(403);
  });

  it("returns 404 when quote does not exist", async () => {
    const exec = await createUser("executive");
    const fakeId = new (require("mongoose").Types.ObjectId)();
    const res = await request(app)
      .post(`/api/quotes/${fakeId}/reject`)
      .set(cookie("executive", exec._id));
    expect(res.status).toBe(404);
  });

  it("returns 400 when quote is not pending approval", async () => {
    const owner = await createUser("sales_rep");
    const exec = await createUser("executive");
    const q = await createQuote(owner._id, { status: "Draft" });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/reject`)
      .set(cookie("executive", exec._id));
    expect(res.status).toBe(400);
  });

  it("rejects with comment and sets approvedBy", async () => {
    const owner = await createUser("sales_rep");
    const exec = await createUser("executive");
    const q = await createQuote(owner._id, { status: "Executive Review" });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/reject`)
      .send({ comment: "Price too high." })
      .set(cookie("executive", exec._id));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("Rejected");
    expect(res.body.data.approvalComment).toBe("Price too high.");
    expect(res.body.data.approvedBy.toString()).toBe(exec._id.toString());
  });

  it("sales_manager cannot reject Executive Review quote", async () => {
    const owner = await createUser("sales_rep");
    const manager = await createUser("sales_manager");
    const q = await createQuote(owner._id, { status: "Executive Review" });

    const res = await request(app)
      .post(`/api/quotes/${q._id}/reject`)
      .set(cookie("sales_manager", manager._id));
    expect(res.status).toBe(403);
  });
});

// ─── GET /api/quotes/approval-queue ───────────────────────────────────────────
describe("GET /api/quotes/approval-queue", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/quotes/approval-queue");
    expect(res.status).toBe(401);
  });

  it("returns 403 when sales_rep requests queue", async () => {
    const rep = await createUser("sales_rep");
    const res = await request(app)
      .get("/api/quotes/approval-queue")
      .set(cookie("sales_rep", rep._id));
    expect(res.status).toBe(403);
  });

  it("returns 200 + empty when no pending quotes", async () => {
    const manager = await createUser("sales_manager");
    const res = await request(app)
      .get("/api/quotes/approval-queue")
      .set(cookie("sales_manager", manager._id));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it("returns pending quotes for sales_manager", async () => {
    const owner = await createUser("sales_rep");
    const manager = await createUser("sales_manager");
    await createQuote(owner._id, {
      status: "Manager Review",
      clientName: "Pending Co",
    });
    await createQuote(owner._id, { status: "Draft", clientName: "Draft Co" });

    const res = await request(app)
      .get("/api/quotes/approval-queue")
      .set(cookie("sales_manager", manager._id));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].clientName).toBe("Pending Co");
  });

  it("returns both Manager Review and Executive Review quotes", async () => {
    const owner = await createUser("sales_rep");
    const exec = await createUser("executive");
    await createQuote(owner._id, { status: "Manager Review" });
    await createQuote(owner._id, { status: "Executive Review" });
    await createQuote(owner._id, { status: "Approved" });

    const res = await request(app)
      .get("/api/quotes/approval-queue")
      .set(cookie("executive", exec._id));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});
