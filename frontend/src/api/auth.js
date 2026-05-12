import api from "./axios";

export const login = (data) => api.post("/auth/login", data);
export const register = (data) => api.post("/auth/register", data);
export const logout = () => api.post("/auth/logout");
export const getMe = () => api.get("/auth/me");
export const forgotPassword = (email) =>
  api.post("/auth/forgot-password", { email });
export const resetPassword = (token, password) =>
  api.post("/auth/reset-password", { token, password });
export const acceptInvite = (token, firstName, lastName, password) =>
  api.post("/auth/accept-invite", { token, firstName, lastName, password });
