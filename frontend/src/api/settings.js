import api from "./axios";

/**
 * Returns current settings (public endpoint — no authentication required).
 * Used to bootstrap brand colors before the user logs in.
 *
 * @returns {Promise<object>} Settings document
 */
export async function getSettings() {
  const res = await api.get("/settings");
  return res.data.data;
}

/**
 * Updates settings (super_admin only).
 *
 * @param {object} data - Fields to update: companyName, logoUrl, primaryColor, accentColor
 * @returns {Promise<object>} Updated settings document
 */
export async function updateSettings(data) {
  const res = await api.put("/settings", data);
  return res.data.data;
}
