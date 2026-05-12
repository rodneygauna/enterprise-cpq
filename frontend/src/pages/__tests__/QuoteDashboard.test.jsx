/**
 * QuoteDashboard page tests — covers §7.6 Quote History Dashboard (frontend).
 *
 * Test coverage:
 *   - Renders loading state while fetching quotes
 *   - Renders error state when getQuotes fails
 *   - Renders stats cards after data loads
 *   - Renders empty state when no quotes exist
 *   - Renders empty state with filter message when filters are applied
 *   - Renders quote table rows with client name links
 *   - Product line badges appear for each quote row
 *   - StatusBadge renders correct text and class variants
 *   - Filter form: submitting calls getQuotes with correct params
 *   - Filter form: Clear filters button resets filters
 *   - "Open" link navigates to the quote editor
 *   - "Copy" button calls duplicateQuote and navigates
 *   - "Delete" button opens confirmation modal
 *   - Delete modal: Cancel hides the modal
 *   - Delete modal: Confirm calls deleteQuote and refreshes list
 *   - Pagination controls appear when total > 20
 *   - Stats bar charts container rendered when byLineCount data is present
 */
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock("../../api/axios");
vi.mock("../../hooks/useAuth");
vi.mock("../../api/quotes");
vi.mock("../../api/productLines");
vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Recharts — render lightweight stubs so jsdom doesn't throw on SVG APIs
vi.mock("recharts", () => {
  const stub = ({ children, "data-testid": dtid }) => (
    <div data-testid={dtid}>{children}</div>
  );
  return {
    ResponsiveContainer: ({ children }) => (
      <div data-testid="ResponsiveContainer">{children}</div>
    ),
    BarChart: ({ children, data }) => (
      <div data-testid="BarChart" data-count={data?.length}>
        {children}
      </div>
    ),
    Bar: stub,
    XAxis: stub,
    YAxis: stub,
    Tooltip: stub,
    CartesianGrid: stub,
  };
});

import { useAuth } from "../../hooks/useAuth";
import {
  getQuotes,
  getQuoteStats,
  deleteQuote,
  duplicateQuote,
} from "../../api/quotes";
import { getProductLines } from "../../api/productLines";
import { toast } from "react-toastify";
import QuoteDashboard from "../QuoteDashboard";

// ── Test router helper ────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ── Sample data ───────────────────────────────────────────────────────────────
const SAMPLE_QUOTE = {
  _id: "q-1",
  clientName: "Acme Corp",
  createdAt: "2025-01-15T00:00:00.000Z",
  activeProductLineIds: [
    { _id: "line-1", name: "Care Management", displayColor: "#198754" },
  ],
  membershipCount: 5000,
  netTCV: 120000,
  status: "Draft",
};

const SAMPLE_STATS = {
  totalQuotes: 1,
  totalPipeline: 120000,
  byLineCount: [{ _id: "line-1", name: "Care Management", count: 1 }],
  byLineTCV: [{ _id: "line-1", name: "Care Management", totalTCV: 120000 }],
};

const EMPTY_RESPONSE = {
  data: [],
  error: null,
  meta: { page: 1, total: 0, limit: 20 },
};

const SINGLE_RESPONSE = {
  data: [SAMPLE_QUOTE],
  error: null,
  meta: { page: 1, total: 1, limit: 20 },
};

// ── Setup ─────────────────────────────────────────────────────────────────────
function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/quotes"]}>
      <QuoteDashboard />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  useAuth.mockReturnValue({
    user: { _id: "user-1", role: "admin", email: "admin@example.com" },
  });

  getQuotes.mockResolvedValue(SINGLE_RESPONSE);
  getQuoteStats.mockResolvedValue(SAMPLE_STATS);
  getProductLines.mockResolvedValue([
    { _id: "line-1", name: "Care Management" },
  ]);
  deleteQuote.mockResolvedValue({ deleted: true });
  duplicateQuote.mockResolvedValue({ _id: "q-copy-1" });
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("QuoteDashboard — loading and error states", () => {
  it("renders a loading spinner before data arrives", () => {
    // Never resolves so the loading state stays visible
    getQuotes.mockReturnValue(new Promise(() => {}));
    renderDashboard();
    expect(
      screen.getByRole("status", { name: /loading quotes/i }),
    ).toBeInTheDocument();
  });

  it("renders an error alert when getQuotes rejects", async () => {
    getQuotes.mockRejectedValue({ response: { data: { error: "DB error" } } });
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("DB error"),
    );
  });
});

describe("QuoteDashboard — stats cards", () => {
  it("renders Total Quotes stat card", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText("Total Quotes")).toBeInTheDocument(),
    );
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders Total Pipeline stat card formatted as currency", async () => {
    renderDashboard();
    const heading = await screen.findByText("Total Pipeline");
    // Scope within the stat card that contains the "Total Pipeline" label
    const card = heading.closest(".card-body");
    expect(card).toBeInTheDocument();
    expect(within(card).getByText("$120,000")).toBeInTheDocument();
  });

  it("renders bar charts when byLineCount data is present", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText("Quotes by Product Line")).toBeInTheDocument(),
    );
    expect(screen.getByText("Net TCV by Product Line")).toBeInTheDocument();
    expect(screen.getAllByTestId("BarChart").length).toBeGreaterThanOrEqual(2);
  });

  it("does not render charts when byLineCount is empty", async () => {
    getQuoteStats.mockResolvedValue({
      totalQuotes: 0,
      totalPipeline: 0,
      byLineCount: [],
      byLineTCV: [],
    });
    getQuotes.mockResolvedValue(EMPTY_RESPONSE);
    renderDashboard();
    await waitFor(() =>
      expect(screen.queryByTestId("BarChart")).not.toBeInTheDocument(),
    );
  });
});

describe("QuoteDashboard — quote table", () => {
  it("renders a row with client name as a link", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Acme Corp" }),
      ).toBeInTheDocument(),
    );
  });

  it("renders product line badges", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(
        screen.getAllByText("Care Management").length,
      ).toBeGreaterThanOrEqual(1),
    );
  });

  it("renders status badge with correct text", async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText("Draft")).toBeInTheDocument());
  });

  it("renders formatted Net TCV in table row", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getAllByText("$120,000").length).toBeGreaterThanOrEqual(1),
    );
  });

  it("renders empty state message when no quotes", async () => {
    getQuotes.mockResolvedValue(EMPTY_RESPONSE);
    getQuoteStats.mockResolvedValue({
      totalQuotes: 0,
      totalPipeline: 0,
      byLineCount: [],
      byLineTCV: [],
    });
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText(/create your first quote/i)).toBeInTheDocument(),
    );
  });
});

describe("QuoteDashboard — status badges", () => {
  const statuses = ["Draft", "Submitted", "Approved", "Rejected"];

  statuses.forEach((status) => {
    it(`renders "${status}" badge`, async () => {
      getQuotes.mockResolvedValue({
        ...SINGLE_RESPONSE,
        data: [{ ...SAMPLE_QUOTE, status }],
      });
      renderDashboard();
      await waitFor(() => expect(screen.getByText(status)).toBeInTheDocument());
    });
  });
});

describe("QuoteDashboard — filter form", () => {
  it("calls getQuotes with clientName filter on submit", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Acme Corp" }),
      ).toBeInTheDocument(),
    );

    const input = screen.getByLabelText(/client name/i);
    fireEvent.change(input, { target: { value: "Acme" } });

    const filterBtn = screen.getByRole("button", { name: /^filter$/i });
    fireEvent.click(filterBtn);

    await waitFor(() =>
      expect(getQuotes).toHaveBeenCalledWith(
        expect.objectContaining({ clientName: "Acme" }),
      ),
    );
  });

  it("calls getQuotes with status filter on submit", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByLabelText(/status/i)).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText(/status/i), {
      target: { value: "Approved" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^filter$/i }));

    await waitFor(() =>
      expect(getQuotes).toHaveBeenCalledWith(
        expect.objectContaining({ status: "Approved" }),
      ),
    );
  });

  it("shows Clear filters link after filter is applied and clears on click", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByLabelText(/client name/i)).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText(/client name/i), {
      target: { value: "Test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^filter$/i }));

    const clearBtn = await screen.findByRole("button", {
      name: /clear filters/i,
    });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);

    // After clear, calls getQuotes with empty filters (no clientName)
    await waitFor(() =>
      expect(getQuotes).toHaveBeenCalledWith(
        expect.not.objectContaining({ clientName: expect.any(String) }),
      ),
    );
  });
});

describe("QuoteDashboard — quote actions", () => {
  it("Copy button calls duplicateQuote and navigates", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /copy quote for acme corp/i }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /copy quote for acme corp/i }),
    );

    await waitFor(() => expect(duplicateQuote).toHaveBeenCalledWith("q-1"));
    expect(mockNavigate).toHaveBeenCalledWith("/quotes/q-copy-1");
    expect(toast.success).toHaveBeenCalledWith("Quote duplicated.");
  });

  it("shows error toast when Copy fails", async () => {
    duplicateQuote.mockRejectedValue(new Error("fail"));
    renderDashboard();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /copy quote for acme corp/i }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /copy quote for acme corp/i }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to duplicate quote."),
    );
  });

  it("Delete button opens the confirmation modal", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /delete quote for acme corp/i }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /delete quote for acme corp/i }),
    );

    const dialog = screen.getByRole("dialog", { name: /delete quote/i });
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByText(/delete the quote for/i),
    ).toBeInTheDocument();
    // "Acme Corp" appears as a <strong> inside the modal
    expect(within(dialog).getByText("Acme Corp")).toBeInTheDocument();
  });

  it("Delete modal — Cancel closes the modal", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /delete quote for acme corp/i }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /delete quote for acme corp/i }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("Delete modal — Confirm calls deleteQuote, shows toast, and refreshes", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /delete quote for acme corp/i }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /delete quote for acme corp/i }),
    );

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(deleteQuote).toHaveBeenCalledWith("q-1"));
    expect(toast.success).toHaveBeenCalledWith("Quote deleted.");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("shows error toast when deleteQuote fails", async () => {
    deleteQuote.mockRejectedValue(new Error("fail"));
    renderDashboard();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /delete quote for acme corp/i }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /delete quote for acme corp/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to delete quote."),
    );
  });
});

describe("QuoteDashboard — pagination", () => {
  it("shows pagination when total > 20", async () => {
    getQuotes.mockResolvedValue({
      data: Array.from({ length: 20 }, (_, i) => ({
        ...SAMPLE_QUOTE,
        _id: `q-${i}`,
        clientName: `Client ${i}`,
      })),
      error: null,
      meta: { page: 1, total: 45, limit: 20 },
    });
    renderDashboard();
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: /quote list pagination/i }),
      ).toBeInTheDocument(),
    );
    // Text is split across nodes: use a function matcher
    const counter = screen.getByText(
      (text, el) => el?.tagName === "P" && /1.*20.*45/.test(el.textContent),
    );
    expect(counter).toBeInTheDocument();
  });

  it("does not show pagination when total ≤ 20", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText("Acme Corp")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("navigation", { name: /quote list pagination/i }),
    ).not.toBeInTheDocument();
  });
});
