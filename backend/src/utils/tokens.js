const jwt = require("jsonwebtoken");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
};

/**
 * Signs and sets access_token (15 min) and refresh_token (7 days) as
 * httpOnly cookies on the response.
 */
function issueTokens(res, userId, role) {
  const accessToken = jwt.sign(
    { sub: String(userId), role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );

  const refreshToken = jwt.sign(
    { sub: String(userId) },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" },
  );

  res.cookie("access_token", accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000, // 15 minutes in ms
  });

  res.cookie("refresh_token", refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
}

/**
 * Clears both auth cookies from the response.
 */
function clearTokens(res) {
  const clearOpts = { httpOnly: true, path: "/" };
  res.clearCookie("access_token", clearOpts);
  res.clearCookie("refresh_token", clearOpts);
}

module.exports = { issueTokens, clearTokens };
