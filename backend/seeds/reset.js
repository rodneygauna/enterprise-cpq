/**
 * Resets all collections to seed data.
 * Called by `make reset` — only intended for development/demo environments.
 * Never run against a production database.
 */
require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../src/models/User");
const ProductLine = require("../src/models/ProductLine");
const Product = require("../src/models/Product");
const Quote = require("../src/models/Quote");
const seedUsers = require("./users");
const seedProductLines = require("./productLines");
const { seedProductCatalog } = require("./productCatalog");
const seedQuotes = require("./quotes");

async function reset() {
  const { MONGO_HOST, MONGO_USER, MONGO_PASS, MONGO_DATABASE } = process.env;
  if (!MONGO_HOST || !MONGO_USER || !MONGO_PASS || !MONGO_DATABASE) {
    console.error(
      "MONGO_HOST, MONGO_USER, MONGO_PASS, and MONGO_DATABASE must all be set. Aborting reset.",
    );
    process.exit(1);
  }
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_HOST}/${MONGO_DATABASE}?authSource=admin`;

  if (process.env.NODE_ENV === "production") {
    console.error("ERROR: reset script refuses to run in NODE_ENV=production.");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);

  console.log("Dropping all collections...");
  await User.deleteMany({});
  await ProductLine.deleteMany({});
  await Product.deleteMany({});
  await Quote.deleteMany({});

  console.log("Re-seeding...");
  await seedUsers(User);
  await seedProductLines(ProductLine);
  await seedProductCatalog(Product, ProductLine);
  await seedQuotes(Quote, User, Product, ProductLine);

  console.log("\nReset complete.");
  await mongoose.disconnect();
}

reset().catch((err) => {
  console.error("Reset script failed:", err.message);
  process.exit(1);
});
