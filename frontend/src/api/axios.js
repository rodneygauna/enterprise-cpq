import axios from "axios";

/**
 * Axios instance pre-configured for the CPQ API.
 * All requests go to /api (proxied to the Express backend by Vite in dev,
 * or handled directly by Caddy in production).
 * withCredentials ensures httpOnly cookies are sent on every request.
 */
const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

/**
 * Response interceptor — silent JWT refresh.
 * On a 401 response the interceptor:
 *   1. Calls POST /api/auth/refresh (sets a new access_token cookie)
 *   2. Retries the original request exactly once
 *   3. If refresh also fails the original rejection propagates to the caller
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/auth/refresh" &&
      originalRequest.url !== "/auth/login"
    ) {
      originalRequest._retry = true;
      try {
        await axios.post("/api/auth/refresh", {}, { withCredentials: true });
        return api(originalRequest);
      } catch {
        // Refresh failed — let the 401 propagate
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
