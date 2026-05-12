const bcrypt = require("bcrypt");

const BCRYPT_ROUNDS = 12;

/**
 * Seeds generic example user accounts.
 * No real company names, emails, or passwords.
 * Skips if accounts already exist.
 */
async function seedUsers(User) {
  const accounts = [
    {
      email: "superadmin@example.com",
      password: "Admin1234!",
      firstName: "Super",
      lastName: "Admin",
      role: "super_admin",
    },
    {
      email: "admin@example.com",
      password: "Admin1234!",
      firstName: "App",
      lastName: "Admin",
      role: "admin",
    },
    {
      email: "executive@example.com",
      password: "Exec1234!",
      firstName: "Example",
      lastName: "Executive",
      role: "executive",
    },
    {
      email: "salesmanager@example.com",
      password: "Manager1234!",
      firstName: "Sales",
      lastName: "Manager",
      role: "sales_manager",
    },
    {
      email: "salesrep@example.com",
      password: "SalesRep1234!",
      firstName: "Sales",
      lastName: "Representative",
      role: "sales_rep",
    },
  ];

  for (const account of accounts) {
    const exists = await User.findOne({ email: account.email });
    if (exists) continue;

    const passwordHash = await bcrypt.hash(account.password, BCRYPT_ROUNDS);
    await User.create({
      email: account.email,
      passwordHash,
      firstName: account.firstName,
      lastName: account.lastName,
      role: account.role,
      isActive: true,
    });
    console.log(`  Seeded: ${account.email} (${account.role})`);
  }
}

module.exports = seedUsers;
