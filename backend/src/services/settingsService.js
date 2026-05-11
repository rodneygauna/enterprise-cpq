const Settings = require("../models/Settings");

const DEFAULTS = {
  companyName: "Enterprise CPQ",
  primaryColor: "#0d6efd",
  accentColor: "#6c757d",
};

/**
 * Returns the settings document.
 * Creates it with defaults on first call (singleton pattern).
 *
 * @returns {Promise<import('mongoose').Document>}
 */
async function getSettings() {
  let settings = await Settings.findOne({});
  if (!settings) {
    settings = await Settings.create(DEFAULTS);
  }
  return settings;
}

/**
 * Upserts the singleton settings document with the given fields.
 *
 * @param {object} fields - Partial settings to apply
 * @returns {Promise<import('mongoose').Document>}
 */
async function updateSettings(fields) {
  const settings = await Settings.findOneAndUpdate(
    {},
    { $set: fields },
    { new: true, upsert: true, runValidators: true },
  );
  return settings;
}

module.exports = { getSettings, updateSettings };
