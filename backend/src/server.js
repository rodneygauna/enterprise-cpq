require("dotenv").config();
const app = require("./app");
const { connectDB } = require("./config/database");

const PORT = process.env.PORT || 3001;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `API server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`,
      );
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
