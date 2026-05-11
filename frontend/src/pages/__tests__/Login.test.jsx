import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock("../../api/axios");
vi.mock("../../hooks/useAuth");

import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Component under test ──────────────────────────────────────────────────────
import Login from "../Login";

const mockLogin = vi.fn();

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

function renderLogin() {
  useAuth.mockReturnValue({
    login: mockLogin,
    user: null,
    isAuthenticated: false,
  });
  return render(
    <MemoryRouter future={routerFuture}>
      <Login />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  useAuth.mockReturnValue({
    login: mockLogin,
    user: null,
    isAuthenticated: false,
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("Login page", () => {
  it("renders email and password fields with accessible labels", () => {
    renderLogin();

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it("calls login() and navigates to / on successful submission", async () => {
    const user = userEvent.setup();
    const mockUser = { _id: "1", email: "test@example.com", role: "sales_rep" };
    api.post.mockResolvedValueOnce({ data: { data: mockUser } });

    renderLogin();

    await user.type(
      screen.getByLabelText(/email address/i),
      "test@example.com",
    );
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/auth/login", {
        email: "test@example.com",
        password: "password123",
      });
      expect(mockLogin).toHaveBeenCalledWith(mockUser);
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("shows an accessible error alert on failed login", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce({
      response: { data: { error: "Invalid email or password" } },
    });

    renderLogin();

    await user.type(
      screen.getByLabelText(/email address/i),
      "test@example.com",
    );
    await user.type(screen.getByLabelText(/password/i), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/invalid email or password/i);
  });

  it("shows a loading state while the request is in flight", async () => {
    const user = userEvent.setup();
    // Never resolves — simulates in-flight request
    api.post.mockReturnValueOnce(new Promise(() => {}));

    renderLogin();

    await user.type(
      screen.getByLabelText(/email address/i),
      "test@example.com",
    );
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const btn = screen.getByRole("button", { name: /signing in/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("renders the Sign in with Salesforce link", () => {
    renderLogin();

    const link = screen.getByRole("link", { name: /sign in with salesforce/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/api/auth/salesforce");
  });

  it("renders a link to the register page", () => {
    renderLogin();
    expect(
      screen.getByRole("link", { name: /create one/i }),
    ).toBeInTheDocument();
  });

  it("renders a link to the forgot password page", () => {
    renderLogin();
    expect(
      screen.getByRole("link", { name: /forgot password/i }),
    ).toBeInTheDocument();
  });
});
