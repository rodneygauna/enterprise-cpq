---
applyTo: ["backend/**/*.test.js", "backend/tests/**"]
description: "Use when writing backend tests. Covers Jest + Supertest setup, mongodb-memory-server integration, test file structure, naming conventions, and what to test for every route."
---

# Backend Testing Conventions

## Tools

| Tool                    | Purpose                                    |
| ----------------------- | ------------------------------------------ |
| `jest`                  | Test runner and assertion library          |
| `supertest`             | HTTP assertions against Express app        |
| `mongodb-memory-server` | In-process MongoDB — no external DB needed |

Install: `npm install --save-dev jest supertest mongodb-memory-server`

---

## Test File Location

Co-locate tests with the source they test:

```
backend/src/
├── routes/
│   └── __tests__/
│       ├── auth.test.js
│       ├── products.test.js
│       └── quotes.test.js
└── utils/
    └── __tests__/
        └── pricing.test.js
```

Shared setup utilities live in `backend/tests/helpers/`:

```
backend/tests/helpers/
├── db.js         # connect/disconnect mongodb-memory-server
└── auth.js       # generate test JWTs for each role
```

---

## DB Helper

```js
// tests/helpers/db.js
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;

module.exports.connect = async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
};

module.exports.closeDatabase = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
};

module.exports.clearDatabase = async () => {
  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }
};
```

---

## Auth Helper

```js
// tests/helpers/auth.js
const jwt = require("jsonwebtoken");

const ROLES = [
  "super_admin",
  "admin",
  "executive",
  "sales_manager",
  "sales_rep",
];

module.exports.tokenFor = (
  role = "sales_rep",
  userId = "000000000000000000000001",
) => {
  return jwt.sign(
    { sub: userId, role },
    process.env.JWT_SECRET ?? "test_secret",
    { expiresIn: "1h" },
  );
};
```

---

## Test File Structure

```js
const request = require("supertest");
const app = require("../../app");
const {
  connect,
  closeDatabase,
  clearDatabase,
} = require("../../../tests/helpers/db");
const { tokenFor } = require("../../../tests/helpers/auth");

beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe("POST /api/products", () => {
  it("creates a product when caller is admin", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Cookie", `access_token=${tokenFor("admin")}`)
      .send({
        name: "Test Product",
        pricingModel: "PMPM",
        pricingStrategy: "Standard",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Test Product");
    expect(res.body.error).toBeNull();
  });

  it("returns 403 when caller is sales_rep", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Cookie", `access_token=${tokenFor("sales_rep")}`)
      .send({ name: "Test Product" });

    expect(res.status).toBe(403);
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app)
      .post("/api/products")
      .send({ name: "Test Product" });
    expect(res.status).toBe(401);
  });

  it("returns 422 when name is missing", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Cookie", `access_token=${tokenFor("admin")}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });
});
```

---

## What to Test for Every Route

For each Express route, write tests covering:

| Scenario                             | Expected status       |
| ------------------------------------ | --------------------- |
| Happy path (authorized, valid input) | `200` / `201` / `204` |
| Unauthenticated (no token)           | `401`                 |
| Wrong role                           | `403`                 |
| Missing required fields              | `422`                 |
| Invalid enum value                   | `422`                 |
| Resource not found                   | `404`                 |
| Duplicate unique field               | `409` or `422`        |

For pure utility functions (`pricing.js`, formatters):

- Test each pricing model formula independently
- Test edge cases: 0 membership, max tier, missing band, 0 price
- No HTTP layer needed — import and call directly

---

## Naming Convention

```
describe('<METHOD> /api/<resource>')
  it('<expected behavior when condition>')
```

Examples:

- `it('returns a list of all products sorted by name')`
- `it('returns 403 when caller is not admin')`
- `it('calculates PMPM × membership × term correctly')`

---

## Jest Configuration (`backend/package.json`)

```json
{
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/__tests__/**/*.test.js", "**/tests/**/*.test.js"],
    "setupFiles": ["./tests/helpers/setEnv.js"]
  }
}
```

`tests/helpers/setEnv.js` sets `process.env.JWT_SECRET = 'test_secret'` before tests run.

---

## Critical Rules

- **Never use the real `MONGO_URI`** in tests — always use `mongodb-memory-server`
- **Never share state between tests** — `clearDatabase()` runs after each test
- **Never use `console.log` to assert** — use `expect()` assertions
- Tests must be runnable with `npm test` from the `backend/` directory with no external services
