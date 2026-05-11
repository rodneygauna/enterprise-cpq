---
description: "Scaffold a new Express API route file with authenticate + requireRole middleware, input validation, Mongoose query, and standard response shape."
argument-hint: "Domain name and HTTP methods (e.g. 'quotes — GET list, POST create, PUT update')"
agent: "agent"
---

Scaffold a new Express API route file for Enterprise CPQ.

Follow all conventions in [backend.instructions.md](../instructions/backend.instructions.md).

## What to Generate

Based on the domain and methods provided, generate a route file at `backend/src/routes/<domain>.js` with the following structure for each endpoint:

```js
const router = require("express").Router();
const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const { body, param, query } = require("express-validator");
const Model = require("../models/<Model>");

/**
 * GET /api/<domain>
 * Returns paginated list. Any authenticated user.
 */
router.get("/", authenticate, async (req, res, next) => {
  try {
    const items = await Model.find().sort({ createdAt: -1 });
    res.json({ data: items, error: null, meta: { total: items.length } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/<domain>
 * Creates a new record. Admin only.
 */
router.post(
  "/",
  authenticate,
  requireRole(["admin", "super_admin"]),
  [
    body("name").notEmpty().withMessage("name is required").trim(),
    // add additional validation rules here
  ],
  validate,
  async (req, res, next) => {
    try {
      const item = await Model.create({ ...req.body, createdBy: req.user._id });
      res.status(201).json({ data: item, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
```

## Rules to Follow

1. Apply the middleware chain in order: `authenticate → requireRole → validation rules → validate → handler`
2. Wrap every handler body in `try/catch`; call `next(err)` in the catch block
3. Always return the standard response shape: `{ data, error, meta }`
4. Use `express-validator` for all input validation — never validate manually inside the handler
5. For enum fields, import the enum array from the model file and use `.isIn(ENUM_ARRAY)`
6. For `:id` params, validate with `param('id').isMongoId()`
7. For list endpoints, support optional `?page` and `?limit` query params; include totals in `meta`
8. Register the new router in `backend/src/app.js` under `/api/<domain>`

## After Generating

- Add the route registration line to `backend/src/app.js`
- Confirm the Mongoose model exists in `backend/src/models/`; create it if not (see [mongoose-models.instructions.md](../instructions/mongoose-models.instructions.md))
