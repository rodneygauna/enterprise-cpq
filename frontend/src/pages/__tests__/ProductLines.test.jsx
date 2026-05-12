/**
 * ProductLines page tests — covers FR-LINE-1 through FR-LINE-3 (frontend).
 *
 * Test coverage:
 *   - Blocks access for non-admin roles (e.g., sales_rep)
 *   - Renders empty-state message when no lines exist
 *   - Renders a table row for each loaded product line
 *   - Add drawer: opens when "+ Add Product Line" is clicked
 *   - Add drawer: shows inline error when name is empty
 *   - Add drawer: shows inline error for invalid hex color
 *   - Add drawer: clears error when user corrects the field
 *   - Add drawer: does not call the API when validation fails
 *   - Add drawer: shows success toast and adds row after successful create
 *   - Add drawer: shows error toast when create fails
 *   - Edit drawer: pre-fills form when Edit button is clicked
 *   - Edit drawer: shows success toast and updates row after successful save
 *   - View drawer: opens when product line name is clicked
 *   - Delete: opens confirmation modal when Delete button is clicked
 *   - Delete: calls deleteProductLine and removes row on confirm
 *   - Delete: shows error toast when delete fails (e.g., IN_USE)
 *   - Reorder: calls reorderProductLine with "up" / "down"
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock("../../api/axios");
vi.mock("../../hooks/useAuth");
vi.mock("../../api/productLines");
vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useAuth } from "../../hooks/useAuth";
import {
  getProductLines,
  createProductLine,
  updateProductLine,
  deleteProductLine,
  reorderProductLine,
} from "../../api/productLines";
import { toast } from "react-toastify";
import ProductLines from "../ProductLines";

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

const SAMPLE_LINES = [
  {
    _id: "line-1",
    name: "Care Management",
    displayColor: "#198754",
    sortOrder: 0,
  },
  {
    _id: "line-2",
    name: "Behavioral Health",
    displayColor: null,
    sortOrder: 1,
  },
];

function renderPage(role = "admin") {
  useAuth.mockReturnValue({
    user: { role, firstName: "Test", lastName: "User" },
    isAuthenticated: true,
  });
  return render(
    <MemoryRouter future={routerFuture}>
      <ProductLines />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getProductLines.mockResolvedValue([...SAMPLE_LINES]);
});

// ─── Access control ───────────────────────────────────────────────────────────
describe("access control", () => {
  it("blocks access for sales_rep", async () => {
    renderPage("sales_rep");
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /product line management/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("renders page for admin role", async () => {
    renderPage("admin");
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /product line management/i }),
      ).toBeInTheDocument();
    });
  });
});

// ─── Rendering ────────────────────────────────────────────────────────────────
describe("rendering", () => {
  it("shows empty-state message when no lines exist", async () => {
    getProductLines.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no product lines yet/i)).toBeInTheDocument();
    });
  });

  it("renders a table row for each loaded product line", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Care Management")).toBeInTheDocument();
      expect(screen.getByText("Behavioral Health")).toBeInTheDocument();
    });
  });
});

// ─── Add drawer ───────────────────────────────────────────────────────────────
describe("add drawer", () => {
  async function openAddDrawer(user) {
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /\+ add product line/i }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: /\+ add product line/i }),
    );
    return screen.getByRole("dialog", { name: /add product line/i });
  }

  it("opens when '+ Add Product Line' is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await openAddDrawer(user);
    expect(dialog).toBeInTheDocument();
  });

  it("shows inline error when name is empty on submit", async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await openAddDrawer(user);
    const form = within(dialog).getByRole("form", {
      name: /add product line/i,
    });
    await user.click(
      within(form).getByRole("button", { name: /create product line/i }),
    );
    expect(within(form).getByText(/name is required/i)).toBeInTheDocument();
  });

  it("shows inline error for invalid hex color", async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await openAddDrawer(user);
    const form = within(dialog).getByRole("form", {
      name: /add product line/i,
    });

    await user.type(within(form).getByLabelText(/^name/i), "New Line");
    const hexInput = within(form).getByRole("textbox", {
      name: /display color hex/i,
    });
    await user.clear(hexInput);
    await user.type(hexInput, "badcolor");
    await user.click(
      within(form).getByRole("button", { name: /create product line/i }),
    );

    expect(within(form).getByText(/valid 6-digit hex/i)).toBeInTheDocument();
  });

  it("clears name error when user starts typing", async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await openAddDrawer(user);
    const form = within(dialog).getByRole("form", {
      name: /add product line/i,
    });

    await user.click(
      within(form).getByRole("button", { name: /create product line/i }),
    );
    expect(within(form).getByText(/name is required/i)).toBeInTheDocument();

    await user.type(within(form).getByLabelText(/^name/i), "F");
    expect(
      within(form).queryByText(/name is required/i),
    ).not.toBeInTheDocument();
  });

  it("does not call createProductLine when validation fails", async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await openAddDrawer(user);
    const form = within(dialog).getByRole("form", {
      name: /add product line/i,
    });
    await user.click(
      within(form).getByRole("button", { name: /create product line/i }),
    );
    expect(createProductLine).not.toHaveBeenCalled();
  });

  it("shows success toast and adds row on successful create", async () => {
    const user = userEvent.setup();
    const newLine = {
      _id: "line-3",
      name: "Mental Health",
      displayColor: null,
      sortOrder: 2,
    };
    createProductLine.mockResolvedValue(newLine);

    renderPage();
    const dialog = await openAddDrawer(user);
    const form = within(dialog).getByRole("form", {
      name: /add product line/i,
    });

    await user.type(within(form).getByLabelText(/^name/i), "Mental Health");
    await user.click(
      within(form).getByRole("button", { name: /create product line/i }),
    );

    await waitFor(() => {
      expect(createProductLine).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Mental Health" }),
      );
      expect(toast.success).toHaveBeenCalledWith("Product line created.");
      expect(screen.getByText("Mental Health")).toBeInTheDocument();
    });
  });

  it("shows error toast when create fails", async () => {
    const user = userEvent.setup();
    createProductLine.mockRejectedValue({
      response: { data: { error: "Name already exists." } },
    });

    renderPage();
    const dialog = await openAddDrawer(user);
    const form = within(dialog).getByRole("form", {
      name: /add product line/i,
    });

    await user.type(within(form).getByLabelText(/^name/i), "Duplicate");
    await user.click(
      within(form).getByRole("button", { name: /create product line/i }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Name already exists.");
    });
  });
});

// ─── Edit drawer ──────────────────────────────────────────────────────────────
describe("edit drawer", () => {
  it("pre-fills form when Edit is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Care Management"));

    await user.click(
      screen.getByRole("button", { name: /view details for care management/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /edit care management/i }),
    );

    const dialog = screen.getByRole("dialog", { name: /edit product line/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^name/i)).toHaveValue(
      "Care Management",
    );
  });

  it("shows success toast and updates row after save", async () => {
    const user = userEvent.setup();
    const updated = { ...SAMPLE_LINES[0], name: "Renamed Line" };
    updateProductLine.mockResolvedValue(updated);

    renderPage();
    await waitFor(() => screen.getByText("Care Management"));

    await user.click(
      screen.getByRole("button", { name: /view details for care management/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /edit care management/i }),
    );

    const dialog = screen.getByRole("dialog", { name: /edit product line/i });
    const nameInput = within(dialog).getByLabelText(/^name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed Line");

    await user.click(
      within(dialog).getByRole("button", { name: /save changes/i }),
    );

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Product line updated.");
      expect(screen.getByText("Renamed Line")).toBeInTheDocument();
    });
  });
});

// ─── View drawer ──────────────────────────────────────────────────────────────
describe("view drawer", () => {
  it("opens when product line name is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Care Management"));

    await user.click(
      screen.getByRole("button", { name: /view details for care management/i }),
    );

    const dialog = screen.getByRole("dialog", { name: /care management/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("#198754")).toBeInTheDocument();
  });
});

// ─── Delete ───────────────────────────────────────────────────────────────────
describe("delete flow", () => {
  it("opens confirmation modal when Delete is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Care Management"));

    await user.click(
      screen.getByRole("button", { name: /view details for care management/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /delete care management/i }),
    );

    expect(
      screen.getByRole("dialog", { name: /delete product line/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });

  it("calls deleteProductLine and removes row on confirm", async () => {
    const user = userEvent.setup();
    deleteProductLine.mockResolvedValue({ _id: "line-1" });

    renderPage();
    await waitFor(() => screen.getByText("Care Management"));

    await user.click(
      screen.getByRole("button", { name: /view details for care management/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /delete care management/i }),
    );
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(deleteProductLine).toHaveBeenCalledWith("line-1");
      expect(toast.success).toHaveBeenCalledWith("Product line deleted.");
      expect(screen.queryByText("Care Management")).not.toBeInTheDocument();
    });
  });

  it("shows error toast when delete fails", async () => {
    const user = userEvent.setup();
    deleteProductLine.mockRejectedValue({
      response: {
        data: { error: "Cannot delete: products are assigned to this line." },
      },
    });

    renderPage();
    await waitFor(() => screen.getByText("Care Management"));

    await user.click(
      screen.getByRole("button", { name: /view details for care management/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /delete care management/i }),
    );
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Cannot delete: products are assigned to this line.",
      );
    });
  });
});

// ─── Reorder ──────────────────────────────────────────────────────────────────
describe("reorder", () => {
  it("calls reorderProductLine with 'down' and refreshes", async () => {
    const user = userEvent.setup();
    reorderProductLine.mockResolvedValue({});
    getProductLines.mockResolvedValue([...SAMPLE_LINES]);

    renderPage();
    await waitFor(() => screen.getByText("Care Management"));

    await user.click(
      screen.getByRole("button", { name: /move care management down/i }),
    );

    await waitFor(() => {
      expect(reorderProductLine).toHaveBeenCalledWith("line-1", "down");
      expect(getProductLines).toHaveBeenCalledTimes(2);
    });
  });

  it("calls reorderProductLine with 'up'", async () => {
    const user = userEvent.setup();
    reorderProductLine.mockResolvedValue({});
    getProductLines.mockResolvedValue([...SAMPLE_LINES]);

    renderPage();
    await waitFor(() => screen.getByText("Behavioral Health"));

    await user.click(
      screen.getByRole("button", { name: /move behavioral health up/i }),
    );

    await waitFor(() => {
      expect(reorderProductLine).toHaveBeenCalledWith("line-2", "up");
    });
  });
});
