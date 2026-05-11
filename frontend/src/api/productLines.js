import api from "./axios";

export async function getProductLines() {
  const res = await api.get("/product-lines");
  return res.data.data;
}

export async function createProductLine(data) {
  const res = await api.post("/product-lines", data);
  return res.data.data;
}

export async function updateProductLine(id, data) {
  const res = await api.put(`/product-lines/${id}`, data);
  return res.data.data;
}

export async function deleteProductLine(id) {
  const res = await api.delete(`/product-lines/${id}`);
  return res.data.data;
}

export async function reorderProductLine(id, direction) {
  const res = await api.post(`/product-lines/${id}/reorder`, { direction });
  return res.data.data;
}
