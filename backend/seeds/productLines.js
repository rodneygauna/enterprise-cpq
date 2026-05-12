/**
 * Seed data for product lines.
 * Generic examples — no real company names or proprietary data.
 */
const productLines = [
  { name: "Health Portals", displayColor: "#fd7e14", sortOrder: 0 },
];

/**
 * @param {import("mongoose").Model} ProductLine
 */
async function seedProductLines(ProductLine) {
  const count = await ProductLine.countDocuments();
  if (count > 0) {
    console.log(`  Product lines: ${count} already exist — skipping seed.`);
    return;
  }

  await ProductLine.insertMany(productLines);
  console.log(`  Product lines: inserted ${productLines.length} records.`);
}

module.exports = seedProductLines;
