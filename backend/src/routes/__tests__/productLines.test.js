/**
 * Product Line route tests — covers FR-LINE-1 through FR-LINE-3.
 * Uses mongodb-memory-server; no real DB connections.
 *
 * Test coverage:
 *   GET /api/product-lines
 *     - returns 401 when unauthenticated
 *     - returns 200 with empty array when no lines exist
 *     - returns all lines sorted by sortOrder for any authenticated user
 *
 *   POST /api/product-lines
 *     - returns 401 when unauthenticated
 *     - returns 403 when role is sales_rep
 *     - returns 422 when name is missing
 *     - returns 422 when displayColor is invalid hex
 *     - returns 201 with created line for admin
 *     - returns 201 with created line for super_admin
 *     - returns 409 when name already exists (case-insensitive)
 *     - assigns incrementing sortOrder to successive creates
 *
 *   PUT /api/product-lines/:id
 *     - returns 401 when unauthenticated
 *     - returns 403 when role is sales_rep
 *     - returns 422 for invalid Mongo ID
 *     - returns 404 when product line not found
 *     - returns 409 on duplicate name
 *     - returns 200 and updates name and displayColor
 *
 *   DELETE /api/product-lines/:id
 *     - returns 401 when unauthenticated
 *     - returns 403 when role is sales_rep
 *     - returns 404 when product line not found
 *     - returns 200 and deletes the line
 *
 *   POST /api/product-lines/:id/reorder
 *     - returns 422 for invalid direction
 *     - returns 200 and swaps sortOrder with the sibling above/below
 *     - is a no-op when already at the top/bottom
 */

const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../../app");
const ProductLine = require("../../models/ProductLine");
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

function cookieHeader(role, userId) {
  return { Cookie: `access_token=${tokenFor(role, userId)}` };
}

async function createLine(
  name = "Primary Care",
  displayColor = "#0d6efd",
  sortOrder = 0,
) {
  return ProductLine.create({ name, displayColor, sortOrder });
}

// ─── GET /api/product-lines ───────────────────────────────────────────────────
describe("GET /api/product-lines", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/product-lines");
    expect(res.status).toBe(401);
  });

  it("returns 200 with empty array when no lines exist", async () => {
    const user = await createUser("sales_rep");
    const res = await request(app)
      .get("/api/product-lines")
      .set(cookieHeader("sales_rep", user._id.toString()));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it("returns lines sorted by sortOrder for any authenticated user", async () => {
    await ProductLine.create([
      { name: "Beta", sortOrder: 1 },
      { name: "Alpha", sortOrder: 0 },
    ]);
    const user = await createUser("sales_rep");
    const res = await request(app)
      .get("/api/product-lines")
      .set(cookieHeader("sales_rep", user._id.toString()));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].name).toBe("Alpha");
    expect(res.body.data[1].name).toBe("Beta");
  });
});

// ─── POST /api/product-lines ──────────────────────────────────────────────────
describe("POST /api/product-lines", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app)
      .post("/api/product-lines")
      .send({ name: "Care Management" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is sales_rep", async () => {
    const user = await createUser("sales_rep");
    const res = await request(app)
      .post("/api/product-lines")
      .set(cookieHeader("sales_rep", user._id.toString()))
      .send({ name: "Care Management" });
    expect(res.status).toBe(403);
  });

  it("returns 422 when name is missing", async () => {
    const user = await createUser("admin");
    const res = await request(app)
      .post("/api/product-lines")
      .set(cookieHeader("admin", user._id.toString()))
      .send({ displayColor: "#ff0000" });
    expect(res.status).toBe(422);
  });

  it("returns 422 when displayColor is not a valid hex", async () => {
    const user = await createUser("admin");
    const res = await request(app)
      .post("/api/product-lines")
      .set(cookieHeader("admin", user._id.toString()))
      .send({ name: "Care Management", displayColor: "notacolor" });
    expect(res.status).toBe(422);
  });

  it("returns 201 with created line for admin", async () => {
    const user = await createUser("admin");
    const res = await request(app)
      .post("/api/product-lines")
      .set(cookieHeader("admin", user._id.toString()))
      .send({ name: "Care Management", displayColor: "#198754" });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Care Management");
    expect(res.body.data.displayColor).toBe("#198754");
    expect(res.body.data.sortOrder).toBe(0);
  });

  it("returns 201 with created line for super_admin", async () => {
    const user = await createUser("super_admin");
    const res = await request(app)
      .post("/api/product-lines")
      .set(cookieHeader("super_admin", user._id.toString()))
      .send({ name: "Behavioral Health" });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Behavioral Health");
  });

  it("returns 409 when name already exists (case-insensitive)", async () => {
    await createLine("Care Management");
    const user = await createUser("admin");
    const res = await request(app)
      .post("/api/product-lines")
      .set(cookieHeader("admin", user._id.toString()))
      .send({ name: "care management" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it("assigns incrementing sortOrder to successive creates", async () => {
    const user = await createUser("admin");
    const headers = cookieHeader("admin", user._id.toString());

    await request(app)
      .post("/api/product-lines")
      .set(headers)
      .send({ name: "Line A" });
    await request(app)
      .post("/api/product-lines")
      .set(headers)
      .send({ name: "Line B" });
    const res = await request(app)
      .post("/api/product-lines")
      .set(headers)
      .send({ name: "Line C" });

    expect(res.body.data.sortOrder).toBe(2);
  });
});

// ─── PUT /api/product-lines/:id ───────────────────────────────────────────────
describe("PUT /api/product-lines/:id", () => {
  it("returns 401 when unauthenticated", async () => {
    const line = await createLine();
    const res = await request(app)
      .put(`/api/product-lines/${line._id}`)
      .send({ name: "Updated" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is sales_rep", async () => {
    const user = await createUser("sales_rep");
    const line = await createLine();
    const res = await request(app)
      .put(`/api/product-lines/${line._id}`)
      .set(cookieHeader("sales_rep", user._id.toString()))
      .send({ name: "Updated" });
    expect(res.status).toBe(403);
  });

  it("returns 422 for an invalid Mongo ID", async () => {
    const user = await createUser("admin");
    const res = await request(app)
      .put("/api/product-lines/not-an-id")
      .set(cookieHeader("admin", user._id.toString()))
      .send({ name: "Updated" });
    expect(res.status).toBe(422);
  });

  it("returns 404 when the product line does not exist", async () => {
    const user = await createUser("admin");
    const res = await request(app)
      .put("/api/product-lines/000000000000000000000001")
      .set(cookieHeader("admin", user._id.toString()))
      .send({ name: "Updated" });
    expect(res.status).toBe(404);
  });

  it("returns 409 on duplicate name", async () => {
    await createLine("Existing Line");
    const target = await createLine("Target Line", null, 1);
    const user = await createUser("admin");

    const res = await request(app)
      .put(`/api/product-lines/${target._id}`)
      .set(cookieHeader("admin", user._id.toString()))
      .send({ name: "existing line" });

    expect(res.status).toBe(409);
  });

  it("returns 200 and updates name and displayColor", async () => {
    const line = await createLine();
    const user = await createUser("admin");

    const res = await request(app)
      .put(`/api/product-lines/${line._id}`)
      .set(cookieHeader("admin", user._id.toString()))
      .send({ name: "Renamed Line", displayColor: "#dc3545" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Renamed Line");
    expect(res.body.data.displayColor).toBe("#dc3545");
  });
});

// ─── DELETE /api/product-lines/:id ────────────────────────────────────────────
describe("DELETE /api/product-lines/:id", () => {
  it("returns 401 when unauthenticated", async () => {
    const line = await createLine();
    const res = await request(app).delete(`/api/product-lines/${line._id}`);
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is sales_rep", async () => {
    const user = await createUser("sales_rep");
    const line = await createLine();
    const res = await request(app)
      .delete(`/api/product-lines/${line._id}`)
      .set(cookieHeader("sales_rep", user._id.toString()));
    expect(res.status).toBe(403);
  });

  it("returns 404 when the product line does not exist", async () => {
    const user = await createUser("admin");
    const res = await request(app)
      .delete("/api/product-lines/000000000000000000000001")
      .set(cookieHeader("admin", user._id.toString()));
    expect(res.status).toBe(404);
  });

  it("returns 200 and deletes the line", async () => {
    const line = await createLine();
    const user = await createUser("admin");

    const res = await request(app)
      .delete(`/api/product-lines/${line._id}`)
      .set(cookieHeader("admin", user._id.toString()));

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(line._id.toString());
    const gone = await ProductLine.findById(line._id);
    expect(gone).toBeNull();
  });
});

// ─── POST /api/product-lines/:id/reorder ─────────────────────────────────────
describe("POST /api/product-lines/:id/reorder", () => {
  it("returns 422 for an invalid direction", async () => {
    const user = await createUser("admin");
    const line = await createLine();
    const res = await request(app)
      .post(`/api/product-lines/${line._id}/reorder`)
      .set(cookieHeader("admin", user._id.toString()))
      .send({ direction: "sideways" });
    expect(res.status).toBe(422);
  });

  it("swaps sortOrder when moving down", async () => {
    const lineA = await ProductLine.create({ name: "Line A", sortOrder: 0 });
    const lineB = await ProductLine.create({ name: "Line B", sortOrder: 1 });
    const user = await createUser("admin");

    await request(app)
      .post(`/api/product-lines/${lineA._id}/reorder`)
      .set(cookieHeader("admin", user._id.toString()))
      .send({ direction: "down" });

    const updatedA = await ProductLine.findById(lineA._id);
    const updatedB = await ProductLine.findById(lineB._id);
    expect(updatedA.sortOrder).toBe(1);
    expect(updatedB.sortOrder).toBe(0);
  });

  it("swaps sortOrder when moving up", async () => {
    const lineA = await ProductLine.create({ name: "Line A", sortOrder: 0 });
    const lineB = await ProductLine.create({ name: "Line B", sortOrder: 1 });
    const user = await createUser("admin");

    await request(app)
      .post(`/api/product-lines/${lineB._id}/reorder`)
      .set(cookieHeader("admin", user._id.toString()))
      .send({ direction: "up" });

    const updatedA = await ProductLine.findById(lineA._id);
    const updatedB = await ProductLine.findById(lineB._id);
    expect(updatedB.sortOrder).toBe(0);
    expect(updatedA.sortOrder).toBe(1);
  });

  it("is a no-op when the line is already at the top", async () => {
    const line = await ProductLine.create({ name: "Only Line", sortOrder: 0 });
    const user = await createUser("admin");

    const res = await request(app)
      .post(`/api/product-lines/${line._id}/reorder`)
      .set(cookieHeader("admin", user._id.toString()))
      .send({ direction: "up" });

    expect(res.status).toBe(200);
    const unchanged = await ProductLine.findById(line._id);
    expect(unchanged.sortOrder).toBe(0);
  });
});
