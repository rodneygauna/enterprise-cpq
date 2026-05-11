/**
 * productService.js — business logic for the Product Catalog (§7.4).
 *
 * Exported functions:
 *   listProducts(filters)          FR-PROD-1, FR-PROD-3
 *   getProduct(id)                 FR-PROD-1
 *   createProduct(fields, userId)  FR-PROD-1
 *   updateProduct(id, fields)      FR-PROD-1
 *   deleteProduct(id)              FR-PROD-1
 *   duplicateProduct(id, userId)   FR-PROD-7
 *   exportCatalogXlsx()            FR-PROD-4
 *   importCatalogXlsx(buffer)      FR-PROD-5
 *   resetCatalog(seedProducts)     FR-PROD-8
 */

const mongoose = require("mongoose");
const XLSX = require("xlsx");

const Product = require("../models/Product");
const ProductLine = require("../models/ProductLine");

// ── List ────────────────────────────────────────────────────────────────────

/**
 * Returns products with optional filtering.
 * @param {{ productLineId?: string, search?: string }} filters
 */
async function listProducts(filters = {}) {
  const query = {};
  if (filters.productLineId) {
    query.productLineId = new mongoose.Types.ObjectId(filters.productLineId);
  }
  if (filters.search) {
    const re = new RegExp(
      filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    query.$or = [{ name: re }, { sku: re }];
  }
  return Product.find(query)
    .populate("productLineId", "name displayColor")
    .sort({ name: 1 });
}

// ── Get one ─────────────────────────────────────────────────────────────────

async function getProduct(id) {
  return Product.findById(id)
    .populate("productLineId", "name displayColor")
    .populate("compatibleCoreIds", "name sku")
    .populate("recommendedProductIds", "name sku");
}

// ── Create ──────────────────────────────────────────────────────────────────

async function createProduct(fields, userId) {
  const data = sanitizeFields(fields);
  if (userId) data.createdBy = userId;
  // Unset empty SKU so the sparse unique index allows multiple products without a SKU.
  // MongoDB sparse indexes include null values but skip absent (undefined) fields.
  if (!data.sku) delete data.sku;
  return Product.create(data);
}

// ── Update ──────────────────────────────────────────────────────────────────

async function updateProduct(id, fields) {
  const data = sanitizeFields(fields);
  if ("sku" in data && !data.sku) delete data.sku;
  return Product.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true },
  );
}

// ── Delete ──────────────────────────────────────────────────────────────────

async function deleteProduct(id) {
  const product = await Product.findById(id);
  if (!product) return null;
  await product.deleteOne();
  return product;
}

// ── Duplicate (FR-PROD-7) ────────────────────────────────────────────────────

async function duplicateProduct(id, userId) {
  const source = await Product.findById(id).lean();
  if (!source) return null;

  const { _id, createdAt, updatedAt, __v, ...rest } = source;
  rest.name = `Copy of ${rest.name}`;
  delete rest.sku; // avoid SKU collision — absent field works with sparse unique index
  if (userId) rest.createdBy = userId;

  return Product.create(rest);
}

// ── XLSX Export (FR-PROD-4) ──────────────────────────────────────────────────

async function exportCatalogXlsx() {
  const products = await Product.find({})
    .populate("productLineId", "name")
    .populate("compatibleCoreIds", "name sku")
    .populate("recommendedProductIds", "name sku")
    .lean();

  const rows = products.map((p) => ({
    Name: p.name,
    SKU: p.sku ?? "",
    "Product Line": p.productLineId?.name ?? "",
    Type: p.type,
    "Pricing Model": p.pricingModel,
    "Pricing Strategy": p.pricingStrategy,
    "Billing Type": p.billingType,
    "Base Price": p.basePrice,
    "Unit Cost": p.unitCost,
    "Implementation Fee": p.implementationFee,
    "Overage Price": p.overagePrice,
    "Is Baseline Product": p.isBaselineProduct ? "Yes" : "No",
    "Is Quantity Based": p.isQuantityBased ? "Yes" : "No",
    "Inherit Tier Volumes From Core": p.inheritTierVolumesFromCore
      ? "Yes"
      : "No",
    "Scope-Based Pricing": p.scopeBasedPricing,
    Tiers: tiersToString(p.tiers),
    "Volume Bands": bandsToString(p.volumeBands),
    "Compatible Core IDs": (p.compatibleCoreIds ?? [])
      .map((c) => c.sku || c.name)
      .join("; "),
    "Recommended Product IDs": (p.recommendedProductIds ?? [])
      .map((r) => r.sku || r.name)
      .join("; "),
    Description: p.description ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Products");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

// ── XLSX Import (FR-PROD-5) ──────────────────────────────────────────────────

async function importCatalogXlsx(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  // Build lookup maps for resolving names → IDs
  const allLines = await ProductLine.find({}).lean();
  const lineMap = Object.fromEntries(
    allLines.map((l) => [l.name.toLowerCase(), l._id]),
  );

  // Two-pass: first resolve product names → IDs for cross-refs
  const allProducts = await Product.find({}).lean();
  const productByName = Object.fromEntries(
    allProducts.map((p) => [p.name.toLowerCase(), p._id]),
  );
  const productBySku = Object.fromEntries(
    allProducts.filter((p) => p.sku).map((p) => [p.sku.toLowerCase(), p._id]),
  );

  const resolveProductRef = (nameOrSku) => {
    if (!nameOrSku) return undefined;
    const key = nameOrSku.trim().toLowerCase();
    return productBySku[key] ?? productByName[key] ?? undefined;
  };

  const results = { inserted: 0, updated: 0, errors: [] };

  for (const [i, row] of rows.entries()) {
    try {
      const productLineId = row["Product Line"]
        ? (lineMap[row["Product Line"].toLowerCase()] ?? null)
        : null;

      const compatibleCoreIds = (row["Compatible Core IDs"] ?? "")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .map(resolveProductRef)
        .filter(Boolean);

      const recommendedProductIds = (row["Recommended Product IDs"] ?? "")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .map(resolveProductRef)
        .filter(Boolean);

      const fields = {
        name: String(row["Name"] ?? "").trim(),
        sku: String(row["SKU"] ?? "").trim() || null,
        productLineId,
        type: row["Type"],
        pricingModel: row["Pricing Model"],
        pricingStrategy: row["Pricing Strategy"],
        billingType: row["Billing Type"],
        basePrice: Number(row["Base Price"]) || 0,
        unitCost: Number(row["Unit Cost"]) || 0,
        implementationFee: Number(row["Implementation Fee"]) || 0,
        overagePrice: Number(row["Overage Price"]) || 0,
        isBaselineProduct: row["Is Baseline Product"] === "Yes",
        isQuantityBased: row["Is Quantity Based"] === "Yes",
        inheritTierVolumesFromCore:
          row["Inherit Tier Volumes From Core"] === "Yes",
        scopeBasedPricing: row["Scope-Based Pricing"] ?? "None",
        tiers: parseTiersString(row["Tiers"] ?? ""),
        volumeBands: parseBandsString(row["Volume Bands"] ?? ""),
        compatibleCoreIds,
        recommendedProductIds,
        description: String(row["Description"] ?? "").trim(),
      };

      if (!fields.name) {
        results.errors.push({ row: i + 2, error: "Name is required" });
        continue;
      }

      // Upsert by SKU, then by name
      const filter = fields.sku
        ? { sku: { $regex: new RegExp(`^${fields.sku}$`, "i") } }
        : { name: { $regex: new RegExp(`^${fields.name}$`, "i") } };

      const existing = await Product.findOne(filter);
      if (existing) {
        await Product.findByIdAndUpdate(
          existing._id,
          { $set: fields },
          { runValidators: true },
        );
        results.updated++;
      } else {
        await Product.create(fields);
        results.inserted++;
      }
    } catch (err) {
      results.errors.push({ row: i + 2, error: err.message });
    }
  }

  return results;
}

// ── Reset Catalog (FR-PROD-8) ─────────────────────────────────────────────────

async function resetCatalog(seedProducts) {
  await Product.deleteMany({});
  if (!seedProducts || seedProducts.length === 0) return;

  // Resolve productLineName → productLineId if the seed uses name-based references
  const needsResolution = seedProducts.some((p) => "productLineName" in p);
  if (needsResolution) {
    const ProductLine = require("../models/ProductLine");
    const lines = await ProductLine.find({}, "_id name").lean();
    const lineMap = {};
    for (const line of lines) {
      lineMap[line.name] = line._id;
    }
    const resolved = seedProducts.map(({ productLineName, ...rest }) => ({
      ...rest,
      productLineId: productLineName
        ? (lineMap[productLineName] ?? null)
        : null,
    }));
    await Product.insertMany(resolved);
  } else {
    await Product.insertMany(seedProducts);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ALLOWED_FIELDS = [
  "name",
  "sku",
  "productLineId",
  "type",
  "pricingModel",
  "pricingStrategy",
  "billingType",
  "basePrice",
  "unitCost",
  "implementationFee",
  "overagePrice",
  "isBaselineProduct",
  "isQuantityBased",
  "inheritTierVolumesFromCore",
  "scopeBasedPricing",
  "tiers",
  "volumeBands",
  "compatibleCoreIds",
  "recommendedProductIds",
  "description",
];

function sanitizeFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([k]) => ALLOWED_FIELDS.includes(k)),
  );
}

function tiersToString(tiers = []) {
  if (!tiers.length) return "";
  return tiers.map((t) => `${t.min}:${t.price}`).join("; ");
}

function bandsToString(bands = []) {
  if (!bands.length) return "";
  return bands
    .map((b) => `${b.label}|${b.maxMembers ?? ""}|${b.price}|${b.implPrice}`)
    .join("; ");
}

function parseTiersString(str) {
  if (!str) return [];
  return str
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [min, price] = s.split(":").map(Number);
      return isNaN(min) || isNaN(price) ? null : { min, price };
    })
    .filter(Boolean);
}

function parseBandsString(str) {
  if (!str) return [];
  return str
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [label, maxStr, price, implPrice] = s.split("|");
      return {
        label: label ?? "",
        maxMembers: maxStr ? Number(maxStr) : null,
        price: Number(price) || 0,
        implPrice: Number(implPrice) || 0,
      };
    });
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  exportCatalogXlsx,
  importCatalogXlsx,
  resetCatalog,
};
