require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../src/models/User");
const ProductLine = require("../src/models/ProductLine");
const Product = require("../src/models/Product");
const seedUsers = require("./users");
const seedProductLines = require("./productLines");
const { seedProductCatalog } = require("./productCatalog");

async function seed() {
  const { MONGO_HOST, MONGO_USER, MONGO_PASS, MONGO_DATABASE } = process.env;
  if (!MONGO_HOST || !MONGO_USER || !MONGO_PASS || !MONGO_DATABASE) {
    console.error(
      "MONGO_HOST, MONGO_USER, MONGO_PASS, and MONGO_DATABASE must all be set. Aborting seed.",
    );
    process.exit(1);
  }
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_HOST}/${MONGO_DATABASE}?authSource=admin`;

  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("Connected. Running seeds...\n");

  await seedUsers(User);
  await seedProductLines(ProductLine);
  await seedProductCatalog(Product, ProductLine);

  console.log("\nSeeding complete.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed script failed:", err.message);
  process.exit(1);
});
