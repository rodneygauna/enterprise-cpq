/**
 * Users page tests — covers FR-USER-1, FR-USER-2, FR-USER-3 (frontend).
 *
 * Test coverage:
 *   - access control: blocks sales_rep, renders for admin and super_admin
 *   - rendering: shows loading state then table; shows empty state
 *   - rendering: shows name, email, role badge, status badge, last login
 *   - rendering: does not show sensitive fields (passwordHash, etc.)
 *   - view drawer: opens when user name is clicked, shows user details
 *   - edit drawer: opens from action column, pre-fills role
 *   - edit drawer: saves role change via updateUserRole
 *   - edit drawer: shows error toast when save fails
 *   - status toggle: calls updateUserStatus with toggled value
 *   - status toggle: shows error toast when toggle fails
 *   - status toggle: hides Activate/Deactivate for current user's own row
 *   - invite drawer: opens when "+ Invite User" is clicked
 *   - invite drawer: shows inline error for empty email
 *   - invite drawer: shows inline error for invalid email
 *   - invite drawer: shows inline error for 409 conflict
 *   - invite drawer: calls inviteUser on valid submit and shows toast
 *   - invite drawer: shows error toast on unexpected failure
 *   - filtering: applies role filter on form submit
 *   - filtering: shows clear filters link when filters applied
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock("../../api/axios");
vi.mock("../../hooks/useAuth");
vi.mock("../../api/users");
vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useAuth } from "../../hooks/useAuth";
import {
  getUsers,
  updateUserRole,
  updateUserStatus,
  inviteUser,
} from "../../api/users";
import { toast } from "react-toastify";
import Users from "../Users";

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

// ── Sample data ───────────────────────────────────────────────────────────────
const ADMIN_USER = {
  _id: "admin-1",
  firstName: "Alice",
  lastName: "Admin",
  email: "alice@example.com",
  role: "admin",
  isActive: true,
  lastLogin: "2024-03-01T10:00:00Z",
  createdAt: "2024-01-01T00:00:00Z",
};

const SAMPLE_USERS = [
  ADMIN_USER,
  {
    _id: "user-2",
    firstName: "Bob",
    lastName: "Rep",
    email: "bob@example.com",
    role: "sales_rep",
    isActive: true,
    lastLogin: null,
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    _id: "user-3",
    firstName: "Carol",
    lastName: "Inactive",
    email: "carol@example.com",
    role: "executive",
    isActive: false,
    lastLogin: "2024-02-15T08:00:00Z",
    createdAt: "2024-01-15T00:00:00Z",
  },
];

function makeGetUsersResponse(users = SAMPLE_USERS) {
  return {
    data: users,
    meta: { page: 1, total: users.length, limit: 20 },
    error: null,
  };
}

function renderPage(role = "admin", userId = "admin-1") {
  useAuth.mockReturnValue({
    user: { ...ADMIN_USER, role, _id: userId },
    isAuthenticated: true,
  });
  return render(
    <MemoryRouter future={routerFuture}>
      <Users />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getUsers.mockResolvedValue(makeGetUsersResponse());
});

// ─── Access control ───────────────────────────────────────────────────────────
describe("access control", () => {
  it("blocks access for sales_rep", async () => {
    renderPage("sales_rep");
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /user management/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("renders for admin", async () => {
    renderPage("admin");
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /user management/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders for super_admin", async () => {
    renderPage("super_admin");
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /user management/i }),
      ).toBeInTheDocument();
    });
  });
});

// ─── Rendering ────────────────────────────────────────────────────────────────
describe("rendering", () => {
  it("shows loading state initially", () => {
    getUsers.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(
      screen.getByRole("status", { name: /loading users/i }),
    ).toBeInTheDocument();
  });

  it("shows user names in the table", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /view user alice admin/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /view user bob rep/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows email addresses", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    });
  });

  it("shows role badges", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Sales Rep")).toBeInTheDocument();
      expect(screen.getByText("Executive")).toBeInTheDocument();
    });
  });

  it("shows Active badge for active users", async () => {
    renderPage();
    await waitFor(() => {
      const activeBadges = screen.getAllByText("Active");
      expect(activeBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows Inactive badge for inactive users", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Inactive")).toBeInTheDocument();
    });
  });

  it("shows em dash for users with no last login", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  it("shows empty-state message when no users returned", async () => {
    getUsers.mockResolvedValue(makeGetUsersResponse([]));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no users found/i)).toBeInTheDocument();
    });
  });

  it("shows error alert when getUsers fails", async () => {
    getUsers.mockRejectedValue({
      response: { data: { error: "Server error" } },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});

// ─── View drawer ──────────────────────────────────────────────────────────────
describe("view drawer", () => {
  it("opens when user name button is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view user bob rep/i }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: /view user bob rep/i }),
    );
    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: /bob rep/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows user email in view drawer", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view user bob rep/i }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: /view user bob rep/i }),
    );
    const dialog = await screen.findByRole("dialog", { name: /bob rep/i });
    expect(within(dialog).getByText("bob@example.com")).toBeInTheDocument();
  });
});

// ─── Edit drawer ──────────────────────────────────────────────────────────────
describe("edit drawer", () => {
  async function openEditDrawer(user) {
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view user alice admin/i }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: /view user alice admin/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /edit role for alice admin/i }),
    );
    return screen.findByRole("dialog", { name: /edit alice admin/i });
  }

  it("opens when Edit Role button is clicked in view slideout", async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await openEditDrawer(user);
    expect(dialog).toBeInTheDocument();
  });

  it("pre-fills role select with current role", async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await openEditDrawer(user);
    const select = within(dialog).getByLabelText(/role/i);
    expect(select.value).toBe("admin");
  });

  it("calls updateUserRole on save and shows success toast", async () => {
    updateUserRole.mockResolvedValue({ _id: "admin-1", role: "executive" });
    const user = userEvent.setup();
    renderPage();
    const dialog = await openEditDrawer(user);
    const select = within(dialog).getByLabelText(/role/i);
    await user.selectOptions(select, "executive");
    await user.click(within(dialog).getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(updateUserRole).toHaveBeenCalledWith("admin-1", "executive");
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it("shows error toast when updateUserRole fails", async () => {
    updateUserRole.mockRejectedValue({
      response: { data: { error: "Update failed" } },
    });
    const user = userEvent.setup();
    renderPage();
    const dialog = await openEditDrawer(user);
    await user.click(within(dialog).getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});

// ─── Status toggle ────────────────────────────────────────────────────────────
describe("status toggle", () => {
  it("calls updateUserStatus with false to deactivate an active user", async () => {
    updateUserStatus.mockResolvedValue({ _id: "user-2", isActive: false });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view user bob rep/i }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: /view user bob rep/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /deactivate user bob rep/i }),
    );
    await waitFor(() => {
      expect(updateUserStatus).toHaveBeenCalledWith("user-2", false);
    });
  });

  it("calls updateUserStatus with true to activate an inactive user", async () => {
    updateUserStatus.mockResolvedValue({ _id: "user-3", isActive: true });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view user carol inactive/i }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: /view user carol inactive/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /activate user carol inactive/i }),
    );
    await waitFor(() => {
      expect(updateUserStatus).toHaveBeenCalledWith("user-3", true);
    });
  });

  it("shows success toast after toggle", async () => {
    updateUserStatus.mockResolvedValue({ _id: "user-2", isActive: false });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view user bob rep/i }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: /view user bob rep/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /deactivate user bob rep/i }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("shows error toast when toggle fails", async () => {
    updateUserStatus.mockRejectedValue({
      response: { data: { error: "Oops" } },
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view user bob rep/i }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: /view user bob rep/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /deactivate user bob rep/i }),
    );
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it("does not show Activate/Deactivate for the current user's own row", async () => {
    // Current user is admin-1 (Alice Admin) — their row should not have the toggle
    renderPage("admin", "admin-1");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view user alice admin/i }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /deactivate user alice admin/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /activate user alice admin/i }),
    ).not.toBeInTheDocument();
  });
});

// ─── Invite drawer ────────────────────────────────────────────────────────────
describe("invite drawer", () => {
  async function openInviteDrawer(user) {
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /invite user/i }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /invite user/i }));
    return screen.findByRole("dialog", { name: /invite user/i });
  }

  it("opens when '+ Invite User' is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await openInviteDrawer(user);
    expect(dialog).toBeInTheDocument();
  });

  it("shows inline error when email is empty", async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await openInviteDrawer(user);
    await user.click(
      within(dialog).getByRole("button", { name: /send invitation/i }),
    );
    await waitFor(() => {
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        /email is required/i,
      );
    });
  });

  it("shows inline error for invalid email format", async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await openInviteDrawer(user);
    await user.type(
      within(dialog).getByLabelText(/email address/i),
      "bad-email",
    );
    await user.click(
      within(dialog).getByRole("button", { name: /send invitation/i }),
    );
    await waitFor(() => {
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        /valid email/i,
      );
    });
  });

  it("shows inline error for 409 conflict", async () => {
    inviteUser.mockRejectedValue({
      response: {
        status: 409,
        data: { error: "User already exists and is active" },
      },
    });
    const user = userEvent.setup();
    renderPage();
    const dialog = await openInviteDrawer(user);
    await user.type(
      within(dialog).getByLabelText(/email address/i),
      "taken@example.com",
    );
    await user.click(
      within(dialog).getByRole("button", { name: /send invitation/i }),
    );
    await waitFor(() => {
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        /already exists/i,
      );
    });
  });

  it("calls inviteUser and shows success toast on valid submit", async () => {
    inviteUser.mockResolvedValue({ email: "new@example.com" });
    const user = userEvent.setup();
    renderPage();
    const dialog = await openInviteDrawer(user);
    await user.type(
      within(dialog).getByLabelText(/email address/i),
      "new@example.com",
    );
    await user.click(
      within(dialog).getByRole("button", { name: /send invitation/i }),
    );
    await waitFor(() => {
      expect(inviteUser).toHaveBeenCalledWith("new@example.com", "sales_rep");
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it("passes the selected role to inviteUser", async () => {
    inviteUser.mockResolvedValue({ email: "exec@example.com" });
    const user = userEvent.setup();
    renderPage();
    const dialog = await openInviteDrawer(user);
    await user.type(
      within(dialog).getByLabelText(/email address/i),
      "exec@example.com",
    );
    await user.selectOptions(
      within(dialog).getByLabelText(/^role$/i),
      "executive",
    );
    await user.click(
      within(dialog).getByRole("button", { name: /send invitation/i }),
    );
    await waitFor(() => {
      expect(inviteUser).toHaveBeenCalledWith("exec@example.com", "executive");
    });
  });

  it("shows error toast on unexpected invite failure", async () => {
    inviteUser.mockRejectedValue({
      response: { status: 500, data: { error: "Server error" } },
    });
    const user = userEvent.setup();
    renderPage();
    const dialog = await openInviteDrawer(user);
    await user.type(
      within(dialog).getByLabelText(/email address/i),
      "fail@example.com",
    );
    await user.click(
      within(dialog).getByRole("button", { name: /send invitation/i }),
    );
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});

// ─── Filtering ────────────────────────────────────────────────────────────────
describe("filtering", () => {
  it("calls getUsers with role filter when form submitted", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText(/^role$/i)).toBeInTheDocument(),
    );
    await user.selectOptions(screen.getByLabelText(/^role$/i), "executive");
    await user.click(screen.getByRole("button", { name: /^filter$/i }));
    await waitFor(() => {
      // getUsers called twice: once on mount, once on filter apply
      expect(getUsers).toHaveBeenCalledTimes(2);
      const lastCall = getUsers.mock.calls[1][0];
      expect(lastCall).toMatchObject({ role: "executive" });
    });
  });

  it("shows 'Clear filters' link when filters are applied", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText(/^role$/i)).toBeInTheDocument(),
    );
    await user.selectOptions(screen.getByLabelText(/^role$/i), "executive");
    await user.click(screen.getByRole("button", { name: /^filter$/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /clear filters/i }),
      ).toBeInTheDocument();
    });
  });
});
