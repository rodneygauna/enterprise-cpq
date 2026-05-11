const passport = require("passport");
const { Strategy: LocalStrategy } = require("passport-local");
const { Strategy: JwtStrategy } = require("passport-jwt");
const { Strategy: OAuth2Strategy } = require("passport-oauth2");
const bcrypt = require("bcrypt");

const User = require("../models/User");

// ── Local strategy ────────────────────────────────────────────────────────────
passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await User.findOne({
          email: email.toLowerCase().trim(),
          isActive: true,
        });

        // Return same error for missing user or wrong password (no username enumeration)
        if (!user || !user.passwordHash) {
          return done(null, false, { message: "Invalid email or password" });
        }

        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
          return done(null, false, { message: "Invalid email or password" });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    },
  ),
);

// ── JWT strategy (reads from httpOnly cookie) ─────────────────────────────────
const cookieExtractor = (req) => {
  if (req && req.cookies) return req.cookies.access_token ?? null;
  return null;
};

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: cookieExtractor,
      secretOrKey: process.env.JWT_SECRET || "dev_secret",
    },
    async (payload, done) => {
      try {
        const user = await User.findById(payload.sub);
        if (!user || !user.isActive) return done(null, false);
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    },
  ),
);

// ── Salesforce OAuth2 strategy (only when env vars are present) ───────────────
if (process.env.SF_CONSUMER_KEY && process.env.SF_INSTANCE_URL) {
  const salesforceStrategy = new OAuth2Strategy(
    {
      authorizationURL: `${process.env.SF_INSTANCE_URL}/services/oauth2/authorize`,
      tokenURL: `${process.env.SF_INSTANCE_URL}/services/oauth2/token`,
      clientID: process.env.SF_CONSUMER_KEY,
      clientSecret: process.env.SF_CONSUMER_SECRET,
      callbackURL: process.env.SF_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const sfUserId = profile.user_id || profile.id;
        const sfEmail = profile.email;

        // Look up existing user by Salesforce ID or email
        let user = await User.findOne({
          $or: [{ salesforceId: sfUserId }, { email: sfEmail }],
        });

        if (!user) {
          // First login — create account with sales_rep role (FR-AUTH-3)
          user = await User.create({
            salesforceId: sfUserId,
            email: sfEmail,
            firstName: profile.given_name || profile.first_name || "Salesforce",
            lastName: profile.family_name || profile.last_name || "User",
            role: "sales_rep",
            isActive: true,
          });
        } else if (!user.salesforceId) {
          // Link existing account to Salesforce ID
          user.salesforceId = sfUserId;
        }

        if (!user.isActive) {
          return done(null, false, { message: "Account is deactivated" });
        }

        user.lastLogin = new Date();
        await user.save();
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    },
  );

  // Override userProfile to fetch user info from Salesforce identity endpoint
  salesforceStrategy.userProfile = function (accessToken, done) {
    this._oauth2.get(
      `${process.env.SF_INSTANCE_URL}/services/oauth2/userinfo`,
      accessToken,
      (err, body) => {
        if (err)
          return done(new Error("Failed to fetch Salesforce user profile"));
        try {
          const data = JSON.parse(body);
          done(null, data);
        } catch (parseErr) {
          done(new Error("Failed to parse Salesforce user profile"));
        }
      },
    );
  };

  passport.use("salesforce", salesforceStrategy);
}
