import api from "./axios";

export const getProducts = (params) =>
  api.get("/products", { params }).then((r) => r.data.data);

export const getProduct = (id) =>
  api.get(`/products/${id}`).then((r) => r.data.data);

export const createProduct = (data) =>
  api.post("/products", data).then((r) => r.data.data);

export const updateProduct = (id, data) =>
  api.put(`/products/${id}`, data).then((r) => r.data.data);

export const deleteProduct = (id) =>
  api.delete(`/products/${id}`).then((r) => r.data.data);

export const duplicateProduct = (id) =>
  api.post(`/products/${id}/duplicate`).then((r) => r.data.data);

export const exportCatalog = () =>
  api.get("/products/export", { responseType: "blob" });

export const importCatalog = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/products/import", fd);
};

export const resetCatalog = () =>
  api.post("/products/reset").then((r) => r.data.data);
