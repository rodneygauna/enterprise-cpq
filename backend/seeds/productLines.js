/**
 * Seed data for product lines.
 * Generic examples — no real company names or proprietary data.
 */
const productLines = [
  { name: "Care Management", displayColor: "#0d6efd", sortOrder: 0 },
  { name: "Behavioral Health", displayColor: "#198754", sortOrder: 1 },
  { name: "Pharmacy Benefits", displayColor: "#dc3545", sortOrder: 2 },
  { name: "Dental & Vision", displayColor: "#fd7e14", sortOrder: 3 },
  { name: "Wellness Programs", displayColor: "#6f42c1", sortOrder: 4 },
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
