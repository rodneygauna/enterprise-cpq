import api from "./axios";

export const getQuotes = (params) =>
  api.get("/quotes", { params }).then((r) => r.data);

export const getQuoteStats = () =>
  api.get("/quotes/stats").then((r) => r.data.data);

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
