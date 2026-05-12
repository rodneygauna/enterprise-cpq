import api from "./axios";

export const getUsers = (params) =>
  api.get("/users", { params }).then((r) => r.data);

export const getUser = (id) => api.get(`/users/${id}`).then((r) => r.data.data);

export const updateUserRole = (id, role) =>
  api.patch(`/users/${id}/role`, { role }).then((r) => r.data.data);

export const updateUserStatus = (id, isActive) =>
  api.patch(`/users/${id}/status`, { isActive }).then((r) => r.data.data);

export const inviteUser = (email, role) =>
  api.post("/users/invite", { email, role }).then((r) => r.data.data);
