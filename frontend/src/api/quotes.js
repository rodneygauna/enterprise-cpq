import api from "./axios";

export const getQuotes = (params) =>
  api.get("/quotes", { params }).then((r) => r.data);

export const getQuoteStats = () =>
  api.get("/quotes/stats").then((r) => r.data.data);

export const getApprovalQueue = (params) =>
  api.get("/quotes/approval-queue", { params }).then((r) => r.data);

export const getQuote = (id) =>
  api.get(`/quotes/${id}`).then((r) => r.data.data);

export const createQuote = (data) =>
  api.post("/quotes", data).then((r) => r.data.data);

export const updateQuote = (id, data) =>
  api.put(`/quotes/${id}`, data).then((r) => r.data.data);

export const deleteQuote = (id) =>
  api.delete(`/quotes/${id}`).then((r) => r.data.data);

export const duplicateQuote = (id) =>
  api.post(`/quotes/${id}/duplicate`).then((r) => r.data.data);

export const submitQuote = (id) =>
  api.post(`/quotes/${id}/submit`).then((r) => r.data.data);

export const approveQuote = (id, comment = "") =>
  api.post(`/quotes/${id}/approve`, { comment }).then((r) => r.data.data);

export const rejectQuote = (id, comment = "") =>
  api.post(`/quotes/${id}/reject`, { comment }).then((r) => r.data.data);
