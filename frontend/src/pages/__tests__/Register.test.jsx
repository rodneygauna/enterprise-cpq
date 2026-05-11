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
import Register from "../Register";

const mockLogin = vi.fn();

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

function renderRegister() {
  useAuth.mockReturnValue({
    login: mockLogin,
    user: null,
    isAuthenticated: false,
  });
  return render(
    <MemoryRouter future={routerFuture}>
      <Register />
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
describe("Register page", () => {
  it("renders all required fields with accessible labels", () => {
    renderRegister();

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
  });

  it("calls API and navigates to / on successful registration", async () => {
    const user = userEvent.setup();
    const mockUser = { _id: "1", email: "new@example.com", role: "sales_rep" };
    api.post.mockResolvedValueOnce({ data: { data: mockUser } });

    renderRegister();

    await user.type(screen.getByLabelText(/first name/i), "Jane");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    await user.type(screen.getByLabelText(/email address/i), "new@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(mockUser);
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("shows field-level errors returned from the API (422)", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce({
      response: {
        status: 422,
        data: {
          errors: [{ path: "email", msg: "Valid email is required" }],
        },
      },
    });

    renderRegister();

    await user.type(screen.getByLabelText(/first name/i), "Jane");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    await user.type(screen.getByLabelText(/email address/i), "not-an-email");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/valid email is required/i),
    ).toBeInTheDocument();
    // Field should be marked invalid for screen readers
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("shows top-level error alert when email is already registered (409)", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { error: "An account with this email already exists" },
      },
    });

    renderRegister();

    await user.type(screen.getByLabelText(/first name/i), "Jane");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    await user.type(
      screen.getByLabelText(/email address/i),
      "taken@example.com",
    );
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/already exists/i);
  });

  it("shows loading state and disables the button while submitting", async () => {
    const user = userEvent.setup();
    api.post.mockReturnValueOnce(new Promise(() => {}));

    renderRegister();

    await user.type(screen.getByLabelText(/first name/i), "Jane");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    await user.type(screen.getByLabelText(/email address/i), "new@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    const btn = screen.getByRole("button", { name: /creating account/i });
    expect(btn).toBeDisabled();
  });

  it("renders password hint text", () => {
    renderRegister();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it("renders a link to the sign-in page", () => {
    renderRegister();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });
});
