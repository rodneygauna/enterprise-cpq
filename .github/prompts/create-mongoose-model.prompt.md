---
description: "Scaffold a new Mongoose model from a PRD field list with the correct schema types, enums, indexes, timestamps, and export pattern."
argument-hint: "Collection name and field list (e.g. 'Quote — clientName, termLength, status')"
agent: "agent"
---

Scaffold a new Mongoose model for Enterprise CPQ.

Follow all conventions in [mongoose-models.instructions.md](../instructions/mongoose-models.instructions.md).

## What to Generate

Create the file at `backend/src/models/<ModelName>.js`.

### Template

```js
const mongoose = require('mongoose');

// Export enums so routes can import them for validation
const STATUS_VALUES = ['Draft', 'Submitted', 'Approved', 'Rejected'];

const <ModelName>Schema = new mongoose.Schema(
  {
    // Fields from PRD — map each to the correct Mongoose type
    // String fields: add trim: true
    // Required fields: add required: true
    // Enum fields: add enum: ENUM_ARRAY
    // ObjectId references: add ref: 'ModelName'
    // Optional unique fields: add index: true, sparse: true
  },
  { timestamps: true }   // adds createdAt and updatedAt automatically
);

// Indexes
<ModelName>Schema.index({ createdAt: -1 });
// Add additional indexes for frequently queried fields

module.exports = mongoose.model('<ModelName>', <ModelName>Schema);
module.exports.STATUS_VALUES = STATUS_VALUES;
// Export other enum arrays used by this model
```

## Rules to Follow

1. Always use `{ timestamps: true }` — never add `createdAt`/`updatedAt` manually
2. All string fields must have `trim: true`
3. Required fields must have `required: true` with a clear error message
4. Enum values must exactly match the PRD — check [mongoose-models.instructions.md](../instructions/mongoose-models.instructions.md) for the canonical enum arrays
5. ObjectId references must use `ref: 'ModelName'` matching the registered model name
6. Never use `{ strict: false }` — always define all fields explicitly
7. Soft-delete pattern: add `isActive: { type: Boolean, default: true }` instead of relying on deletion
8. Export enum arrays alongside the model so routes can import them for `express-validator` `.isIn()` calls
9. For embedded sub-documents (arrays of objects), define them as separate sub-schemas before the main schema

## After Generating

- Import the model in any route files that need it
- Add a corresponding entry to `backend/seeds/` for seed data if this model needs default records
