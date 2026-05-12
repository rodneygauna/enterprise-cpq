/**
 * Seed data for the settings collection (§7.2, §7.8, §7.9).
 *
 * Creates one Settings document with default branding, discount thresholds,
 * and margin targets so the system has an explicit configuration after a reset.
 *
 * Skips if a settings document already exists.
 */

async function seedSettings(Settings) {
  const count = await Settings.countDocuments();
  if (count > 0) {
    console.log("  Settings: already configured — skipping seed.");
    return;
  }

  await Settings.create({
    companyName: "Enterprise CPQ",

    discountThresholds: {
      managerReviewPercent: 10,
      executiveReviewPercent: 25,
    },

    marginTargets: {
      global: { green: 50, yellow: 30 },
      productLines: {},
    },

    volumeDiscountRules: [],
  });

  console.log("  Settings: inserted default configuration.");
}

module.exports = seedSettings;
