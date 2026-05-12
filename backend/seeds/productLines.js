/**
 * Seed data for product lines.
 * Generic examples — no real company names or proprietary data.
 */
const productLines = [
  { name: "Health Portals", displayColor: "#fd7e14", sortOrder: 0 },
  { name: "Predictive Analytics", displayColor: "#20c997", sortOrder: 1 },
  { name: "Core Communications", displayColor: "#0dcaf0", sortOrder: 2 },
  { name: "Omnichannel Engagement", displayColor: "#ffc107", sortOrder: 3 },
  { name: "Content Hub", displayColor: "#6610f2", sortOrder: 4 },
  { name: "Acquisition & Payments", displayColor: "#6f42c1", sortOrder: 5 },
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
