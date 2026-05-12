import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { BrandingProvider } from "./context/BrandingContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Settings from "./pages/Settings";
import ProductLines from "./pages/ProductLines";
import Products from "./pages/Products";
import QuoteBuilder from "./pages/QuoteBuilder";
import QuoteDashboard from "./pages/QuoteDashboard";
import Users from "./pages/Users";

import "bootstrap/dist/css/bootstrap.min.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const router = createBrowserRouter(
  [
    { path: "/login", element: <Login /> },
    { path: "/register", element: <Register /> },
    { path: "/forgot-password", element: <ForgotPassword /> },
    { path: "/reset-password", element: <ResetPassword /> },
    {
      path: "/",
      element: (
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      ),
      children: [
        {
          index: true,
          element: (
            <div className="container-fluid py-4">
              <h1>Welcome to Enterprise CPQ</h1>
              <p className="text-muted">
                Additional features are being implemented. Check back soon.
              </p>
            </div>
          ),
        },
        { path: "settings", element: <Settings /> },
        { path: "admin/product-lines", element: <ProductLines /> },
        { path: "admin/products", element: <Products /> },
        { path: "quotes", element: <QuoteDashboard /> },
        { path: "quotes/new", element: <QuoteBuilder /> },
        { path: "quotes/:id", element: <QuoteBuilder /> },
        { path: "admin/users", element: <Users /> },
      ],
    },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  },
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrandingProvider>
        <RouterProvider router={router} />
        <ToastContainer position="bottom-right" autoClose={4000} />
      </BrandingProvider>
    </AuthProvider>
  </React.StrictMode>,
);
