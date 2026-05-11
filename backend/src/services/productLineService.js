const ProductLine = require("../models/ProductLine");

/**
 * Returns all product lines sorted by sortOrder ascending.
 */
async function listProductLines() {
  return ProductLine.find({}).sort({ sortOrder: 1 });
}

/**
 * Creates a new product line.
 * Assigns sortOrder = current max + 1 so new lines go to the bottom.
 */
async function createProductLine(fields) {
  const last = await ProductLine.findOne({}).sort({ sortOrder: -1 });
  const sortOrder = last ? last.sortOrder + 1 : 0;
  return ProductLine.create({ ...fields, sortOrder });
}

/**
 * Updates name and/or displayColor on an existing product line.
 */
async function updateProductLine(id, fields) {
  return ProductLine.findByIdAndUpdate(
    id,
    { $set: fields },
    { new: true, runValidators: true },
  );
}

/**
 * Deletes a product line.
 * Returns null if not found.
 * Throws an error with code "IN_USE" if products reference this line.
 */
async function deleteProductLine(id) {
  const line = await ProductLine.findById(id);
  if (!line) return null;

  // Guard: block deletion if any products are assigned to this line (FR-LINE-3).
  // Product model may not exist yet; safe-require so this module loads in tests too.
  try {
    const Product = require("../models/Product");
    const count = await Product.countDocuments({ productLineId: id });
    if (count > 0) {
      const err = new Error(
        `Cannot delete: ${count} product(s) are assigned to this product line.`,
      );
      err.code = "IN_USE";
      throw err;
    }
  } catch (err) {
    if (err.code !== "IN_USE" && err.code === "MODULE_NOT_FOUND") {
      // Product model not yet created — no products can exist, allow delete.
    } else {
      throw err;
    }
  }

  await line.deleteOne();
  return line;
}

/**
 * Moves a product line up or down by one position.
 * Swaps sortOrder values with the adjacent item.
 */
async function reorderProductLine(id, direction) {
  const line = await ProductLine.findById(id);
  if (!line) return null;

  const sibling =
    direction === "up"
      ? await ProductLine.findOne({ sortOrder: { $lt: line.sortOrder } }).sort({
          sortOrder: -1,
        })
      : await ProductLine.findOne({ sortOrder: { $gt: line.sortOrder } }).sort({
          sortOrder: 1,
        });

  if (!sibling) return line; // already at top/bottom — no-op

  const temp = line.sortOrder;
  line.sortOrder = sibling.sortOrder;
  sibling.sortOrder = temp;

  await Promise.all([line.save(), sibling.save()]);
  return line;
}

module.exports = {
  listProductLines,
  createProductLine,
  updateProductLine,
  deleteProductLine,
  reorderProductLine,
};
