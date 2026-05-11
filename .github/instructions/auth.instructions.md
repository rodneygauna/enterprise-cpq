---
description: "Use when implementing authentication, authorization, JWT handling, Passport.js strategies, Salesforce OAuth, or password reset flows. Covers both backend strategy setup and frontend session management."
---

# Authentication & Authorization

Reference: PRD sections FR-AUTH-1 through FR-AUTH-6.

---

## JWT Token Strategy

Two-token pattern — both stored as `httpOnly` cookies:

| Token         | Expiry     | Cookie name     |
| ------------- | ---------- | --------------- |
| Access token  | 15 minutes | `access_token`  |
| Refresh token | 7 days     | `refresh_token` |

```js
// Cookie options
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
};

// Issue access token (15 min)
res.cookie(
  "access_token",
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "15m" }),
  {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000,
  },
);

// Issue refresh token (7 days)
res.cookie(
  "refresh_token",
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" }),
  {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
);
```

**Never** store tokens in `localStorage` or `sessionStorage`. **Never** return tokens in response bodies.

---

## Passport.js — Local Strategy

```js
// src/config/passport.js
passport.use(
  new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      const user = await User.findOne({
        email: email.toLowerCase(),
        isActive: true,
      });
      if (!user || !user.passwordHash) return done(null, false);
      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) return done(null, false);
      return done(null, user);
    },
  ),
);
```

Password hashing: always use `bcrypt.hash(password, 12)` — cost factor must be **at least 12**.

---

## Passport.js — JWT Strategy

```js
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: (req) => req?.cookies?.access_token ?? null,
      secretOrKey: process.env.JWT_SECRET,
    },
    async (payload, done) => {
      const user = await User.findById(payload.sub).select("-passwordHash");
      if (!user || !user.isActive) return done(null, false);
      return done(null, user);
    },
  ),
);
```

---

## `authenticate` Middleware

```js
// src/middleware/authenticate.js
const passport = require("passport");

module.exports.authenticate = (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user) => {
    if (err || !user)
      return res
        .status(401)
        .json({ data: null, error: "Unauthorized", meta: null });
    req.user = user;
    next();
  })(req, res, next);
};
```

---

## `requireRole` Middleware

```js
// src/middleware/requireRole.js
module.exports.requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ data: null, error: "Forbidden", meta: null });
  }
  next();
};
```

---

## Refresh Token Endpoint

```
POST /api/auth/refresh
```

- Read `refresh_token` cookie; verify with `JWT_REFRESH_SECRET`
- Look up user; confirm `isActive: true`
- Issue new `access_token` cookie (do not rotate the refresh token on every call — only on explicit re-login)
- Return `204 No Content`

---

## Salesforce OAuth 2.0 (Phase 3)

Use `passport-oauth2` configured for Salesforce's OAuth endpoints.

On first login via Salesforce:

1. Check if a user with `salesforceId` already exists → update `lastLogin` and return
2. If not found, create a new user with `role: 'sales_rep'` and `isActive: true`
3. A Super Admin must manually elevate the role via the User Management page

```js
passport.use('salesforce', new OAuth2Strategy({
  authorizationURL: `${process.env.SF_INSTANCE_URL}/services/oauth2/authorize`,
  tokenURL:         `${process.env.SF_INSTANCE_URL}/services/oauth2/token`,
  clientID:         process.env.SF_CONSUMER_KEY,
  clientSecret:     process.env.SF_CONSUMER_SECRET,
  callbackURL:      process.env.SF_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  // profile.id is the Salesforce user ID
  let user = await User.findOne({ salesforceId: profile.id });
  if (!user) {
    user = await User.create({ salesforceId: profile.id, role: 'sales_rep', isActive: true, ... });
  }
  user.lastLogin = new Date();
  await user.save();
  done(null, user);
}));
```

---

## Password Reset Flow (FR-AUTH-5)

1. `POST /api/auth/forgot-password` — generate a cryptographically random token via `crypto.randomBytes(32)`, hash it with `SHA-256`, store the **hash** in `user.passwordResetToken` with `passwordResetExpires = Date.now() + 3600000` (1 hour)
2. Send email with the **unhashed** token as a URL parameter (`/reset-password?token=<raw>`)
3. `POST /api/auth/reset-password` — hash the incoming token, find a user where `passwordResetToken` matches and `passwordResetExpires > Date.now()`; update password, clear token fields

---

## Account Deactivation (FR-AUTH-6)

- Set `user.isActive = false` — **never delete the user record**
- Deactivated users are rejected at the JWT strategy level (isActive check)
- Their historical quotes remain intact and visible to admins

---

## Required Environment Variables

```
JWT_SECRET              # Access token signing key (min 32 chars, random)
JWT_REFRESH_SECRET      # Refresh token signing key (different from JWT_SECRET)
SF_CONSUMER_KEY         # Salesforce OAuth consumer key
SF_CONSUMER_SECRET      # Salesforce OAuth consumer secret
SF_INSTANCE_URL         # e.g. https://login.salesforce.com
SF_CALLBACK_URL         # e.g. https://yourapp.com/api/auth/salesforce/callback
SMTP_HOST               # SMTP server hostname
SMTP_PORT               # SMTP server port
SMTP_USER               # SMTP username
SMTP_PASS               # SMTP password
SMTP_FROM               # From address for password reset emails
```
