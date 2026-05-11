const mongoose = require("mongoose");

async function connectDB() {
  const { MONGO_HOST, MONGO_USER, MONGO_PASS, MONGO_DATABASE } = process.env;
  if (!MONGO_HOST || !MONGO_USER || !MONGO_PASS || !MONGO_DATABASE) {
    throw new Error(
      "MongoDB environment variables (MONGO_HOST, MONGO_USER, MONGO_PASS, MONGO_DATABASE) are required",
    );
  }

  const uri = `mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_HOST}/${MONGO_DATABASE}?authSource=admin`;
  await mongoose.connect(uri);
  console.log("MongoDB connected");
}

module.exports = { connectDB };
