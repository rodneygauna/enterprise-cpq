/**
 * Quote route tests — covers FR-QUOTE-15 (save/load) and FR-QUOTE-16 (duplicate).
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
 */
const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../../app");
const Quote = require("../../models/Quote");
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

  it("returns 400 when non-admin attempts to edit a Submitted quote", async () => {
    const owner = await createUser("sales_rep");
    const q = await createQuote(owner._id, { status: "Submitted" });

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
    const q = await createQuote(owner._id, { status: "Submitted" });

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
