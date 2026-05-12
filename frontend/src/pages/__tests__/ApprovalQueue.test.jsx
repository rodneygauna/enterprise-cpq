/**
 * ApprovalQueue page tests — §7.8 FR-DISC-4 (frontend).
 *
 * Test coverage:
 *   - Blocks access for sales_rep (RequireRole renders null / fallback)
 *   - Shows loading state while fetching
 *   - Shows error alert when getApprovalQueue fails
 *   - Shows empty state when no pending quotes
 *   - Renders table of pending quotes
 *   - Approve button calls approveQuote and shows success toast
 *   - Reject button calls rejectQuote and shows success toast
 *   - Shows error toast when approve fails
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

vi.mock("../../api/axios");
vi.mock("../../hooks/useAuth");
vi.mock("../../api/quotes");
vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useAuth } from "../../hooks/useAuth";
import { getApprovalQueue, approveQuote, rejectQuote } from "../../api/quotes";
import { toast } from "react-toastify";
import ApprovalQueue from "../ApprovalQueue";

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

function renderQueue(role = "sales_manager") {
  useAuth.mockReturnValue({
    user: { _id: "user-1", role, firstName: "Test", lastName: "User" },
  });
  return render(
    <MemoryRouter future={routerFuture}>
      <ApprovalQueue />
    </MemoryRouter>,
  );
}

const PENDING_QUOTE = {
  _id: "q-pending",
  clientName: "Health Corp",
  membershipCount: 50000,
  netTCV: 250000,
  status: "Manager Review",
  updatedAt: "2025-06-01T00:00:00.000Z",
  ownerId: { firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
};

const EMPTY_RESPONSE = {
  data: [],
  error: null,
  meta: { page: 1, total: 0, limit: 20 },
};

const SINGLE_RESPONSE = {
  data: [PENDING_QUOTE],
  error: null,
  meta: { page: 1, total: 1, limit: 20 },
};

beforeEach(() => {
  vi.clearAllMocks();
  getApprovalQueue.mockResolvedValue(SINGLE_RESPONSE);
  approveQuote.mockResolvedValue({ ...PENDING_QUOTE, status: "Approved" });
  rejectQuote.mockResolvedValue({ ...PENDING_QUOTE, status: "Rejected" });
});

describe("ApprovalQueue — access control", () => {
  it("renders nothing for sales_rep (RequireRole blocks)", () => {
    renderQueue("sales_rep");
    expect(screen.queryByText(/approval queue/i)).not.toBeInTheDocument();
  });
});

describe("ApprovalQueue — loading and error states", () => {
  it("shows loading state while fetching", () => {
    getApprovalQueue.mockReturnValue(new Promise(() => {}));
    renderQueue("sales_manager");
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows error alert when getApprovalQueue fails", async () => {
    getApprovalQueue.mockRejectedValue({
      response: { data: { error: "Queue fetch failed" } },
    });
    renderQueue("sales_manager");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Queue fetch failed"),
    );
  });

  it("shows empty state when no pending quotes", async () => {
    getApprovalQueue.mockResolvedValue(EMPTY_RESPONSE);
    renderQueue("executive");
    await waitFor(() =>
      expect(
        screen.getByText(/no quotes are currently pending/i),
      ).toBeInTheDocument(),
    );
  });
});

describe("ApprovalQueue — table rendering", () => {
  it("renders table with pending quote", async () => {
    renderQueue("sales_manager");
    await waitFor(() =>
      expect(screen.getByText("Health Corp")).toBeInTheDocument(),
    );
    expect(screen.getByText("Manager Review")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("renders Approve and Reject buttons for each pending quote", async () => {
    renderQueue("executive");
    await screen.findByText("Health Corp");
    expect(
      screen.getByRole("button", { name: /approve quote for health corp/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reject quote for health corp/i }),
    ).toBeInTheDocument();
  });
});

describe("ApprovalQueue — approve action", () => {
  it("calls approveQuote and shows success toast after confirming", async () => {
    const user = userEvent.setup();
    renderQueue("executive");
    await screen.findByText("Health Corp");

    // Click Approve
    await user.click(
      screen.getByRole("button", { name: /approve quote for health corp/i }),
    );

    // Modal should appear
    expect(
      screen.getByRole("dialog", { name: /approve quote/i }),
    ).toBeInTheDocument();

    // Confirm
    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() =>
      expect(approveQuote).toHaveBeenCalledWith("q-pending", ""),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("approved"),
      ),
    );
  });

  it("shows error toast when approveQuote fails", async () => {
    approveQuote.mockRejectedValue({
      response: { data: { error: "Approve error" } },
    });
    const user = userEvent.setup();
    renderQueue("executive");
    await screen.findByText("Health Corp");

    await user.click(
      screen.getByRole("button", { name: /approve quote for health corp/i }),
    );
    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Approve error"),
    );
  });
});

describe("ApprovalQueue — reject action", () => {
  it("calls rejectQuote with comment and shows success toast", async () => {
    const user = userEvent.setup();
    renderQueue("executive");
    await screen.findByText("Health Corp");

    await user.click(
      screen.getByRole("button", { name: /reject quote for health corp/i }),
    );

    // Type a comment
    const commentInput = screen.getByLabelText(/approval comment/i);
    await user.type(commentInput, "Price is too high.");

    await user.click(screen.getByRole("button", { name: /^reject$/i }));

    await waitFor(() =>
      expect(rejectQuote).toHaveBeenCalledWith(
        "q-pending",
        "Price is too high.",
      ),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("rejected"),
      ),
    );
  });
});
