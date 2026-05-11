---
applyTo: "backend/**"
description: "Use when creating or editing Express routes, middleware, services, or utilities in the backend. Covers API conventions, middleware chain, response shapes, and input validation."
---

# Backend Conventions

## Project Layout

```
backend/src/
├── config/       # DB connection (mongoose), passport strategies, env validation
├── middleware/   # authenticate.js, requireRole.js, errorHandler.js, validate.js
├── models/       # One file per Mongoose model
├── routes/       # One router file per domain (auth.js, products.js, quotes.js, users.js, settings.js)
├── services/     # Business logic extracted from route handlers
└── utils/        # Pure helper functions — no Express req/res; fully testable
```

---

## Router Pattern

One file per domain. Register all routers in `src/app.js` under `/api`:

```js
// src/routes/products.js
const router = require('express').Router();
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { body } = require('express-validator');

router.get('/', authenticate, async (req, res, next) => { ... });

router.post(
  '/',
  authenticate,
  requireRole(['admin', 'super_admin']),
  [body('name').notEmpty().trim()],
  validate,
  async (req, res, next) => { ... }
);

module.exports = router;
```

---

## Middleware Chain

Always apply in this order:

```
authenticate  →  requireRole([...])  →  validation rules  →  validate  →  handler
```

- `authenticate` — verifies JWT from `httpOnly` cookie; attaches `req.user`
- `requireRole(roles[])` — returns 403 if `req.user.role` not in the allowed list
- validation rules — `express-validator` `body()` / `param()` / `query()` chains
- `validate` — checks `validationResult`; returns 422 with error array if invalid
- handler — only runs if all above pass; wrap in `try/catch`, call `next(err)` on failure

---

## Standard Response Shape

All successful responses:

```json
{ "data": { ... }, "error": null, "meta": { "page": 1, "total": 42 } }
```

All error responses (handled by `errorHandler` middleware):

```json
{ "data": null, "error": "Human-readable message", "meta": null }
```

HTTP status codes:

- `200` — success (GET, PUT, PATCH)
- `201` — created (POST)
- `204` — no content (DELETE)
- `400` — bad request
- `401` — unauthenticated
- `403` — forbidden (authenticated but wrong role)
- `404` — not found
- `422` — validation error (include `errors` array from express-validator)
- `500` — server error (never expose stack traces in production)

---

## Input Validation

- Use `express-validator` for all route inputs
- Validate at the route layer, not inside service functions
- Always `.trim()` string inputs; `.isMongoId()` for ID params
- For enums, use `.isIn([...values])` with the exact enum array from the Mongoose model
- Never trust `req.body`, `req.params`, or `req.query` without validation

---

## Services Layer

- Extract non-trivial business logic from route handlers into `src/services/`
- Services receive plain data (not `req`/`res`) and return plain data or throw errors
- Route handlers are responsible for HTTP concerns only (parsing, responding, status codes)

---

## Error Handling

- All async route handlers must call `next(err)` on failure — never `res.send()` in catch blocks
- `errorHandler` is the last middleware registered in `app.js`
- Never expose internal error messages or stack traces in production responses
- Use a custom `AppError` class with `statusCode` and `message` for predictable error shaping

---

## Role Hierarchy

```
super_admin > admin > executive > sales_manager > sales_rep
```

Always specify the minimum required role(s) explicitly in `requireRole([...])`.
