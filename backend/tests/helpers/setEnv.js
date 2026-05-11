/**
 * Sets required environment variables for the test environment.
 * Runs before every test file via jest.config setupFiles.
 * Do NOT import dotenv here — tests should not depend on a .env file.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_jwt_secret_minimum_32_characters_long!!";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret_minimum_32_characters!!";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.SMTP_HOST = "localhost";
process.env.SMTP_PORT = "1025";
process.env.SMTP_USER = "test";
process.env.SMTP_PASS = "test";
process.env.SMTP_FROM = "noreply@test.local";
