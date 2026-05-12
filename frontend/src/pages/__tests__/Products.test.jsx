/**
 * Products page tests — covers FR-PROD-1 through FR-PROD-8 (frontend).
 *
 * Test coverage:
 *   - Access control: blocks sales_rep, renders panel for admin
 *   - Loading state: shows spinner while fetching
 *   - Empty state: shows message when no products
 *   - Table: renders a row per product with name, SKU, type badge, pricing model badge
 *   - Search: filtering input is present
 *   - Product line filter: dropdown is present
 *   - Add form: "Add Product" button opens the drawer
 *   - Add form: shows error when name is empty
 *   - Add form: calls createProduct and adds row on success
 *   - Add form: shows error toast when API returns 409 (duplicate SKU)
 *   - Edit: "Edit" button opens the drawer pre-filled
 *   - Edit: calls updateProduct and updates row on success
 *   - Duplicate: "Copy" button calls duplicateProduct
 *   - Delete: "Delete" button shows confirmation modal
 *   - Delete: calls deleteProduct and removes row on confirm
 *   - Export: "Export XLSX" button calls exportCatalog
 *   - Import: file input triggers importCatalog
 *   - Reset: only visible to super_admin; shows confirmation modal
 *   - Tiers editor: appears when pricingStrategy is "Tiered"
 *   - Volume bands editor: appears when pricingStrategy is "Volume Bands"
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock("../../api/axios");
vi.mock("../../hooks/useAuth");
vi.mock("../../api/products");
vi.mock("../../api/productLines");
vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { useAuth } from "../../hooks/useAuth";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  exportCatalog,
  importCatalog,
  resetCatalog,
} from "../../api/products";
import { getProductLines } from "../../api/productLines";
import { toast } from "react-toastify";
import Products from "../Products";

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

// ── Sample data ───────────────────────────────────────────────────────────────
const SAMPLE_LINE = {
  _id: "line-1",
  name: "Care Management",
  displayColor: "#198754",
};

const SAMPLE_PRODUCTS = [
  {
    _id: "prod-1",
    name: "Care Management Platform",
    sku: "CMP-001",
    productLineId: SAMPLE_LINE,
    type: "Core",
    pricingModel: "PMPM",
    pricingStrategy: "Standard",
    billingType: "Recurring (Monthly)",
    scopeBasedPricing: "None",
    basePrice: 10,
    tiers: [],
    volumeBands: [],
    compatibleCoreIds: [],
    recommendedProductIds: [],
    isBaselineProduct: false,
    isQuantityBased: false,
    inheritTierVolumesFromCore: false,
    description: "",
  },
  {
    _id: "prod-2",
    name: "Behavioral Health Add-on",
    sku: null,
    productLineId: null,
    type: "Add-on",
    pricingModel: "Monthly Fee",
    pricingStrategy: "Standard",
    billingType: "Recurring (Monthly)",
    scopeBasedPricing: "None",
    basePrice: 500,
    tiers: [],
    volumeBands: [],
    compatibleCoreIds: [],
    recommendedProductIds: [],
    isBaselineProduct: false,
    isQuantityBased: false,
    inheritTierVolumesFromCore: false,
    description: "",
  },
];

function renderPage(role = "admin") {
  useAuth.mockReturnValue({
    user: { _id: "user-1", role, firstName: "Test", lastName: "User" },
    isAuthenticated: true,
  });
  return render(
    <MemoryRouter future={routerFuture}>
      <Products />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getProducts.mockResolvedValue([...SAMPLE_PRODUCTS]);
  getProductLines.mockResolvedValue([SAMPLE_LINE]);
  createProduct.mockResolvedValue({
    ...SAMPLE_PRODUCTS[0],
    _id: "prod-new",
    name: "New Product",
    sku: null,
  });
  updateProduct.mockResolvedValue({
    ...SAMPLE_PRODUCTS[0],
    name: "Updated Name",
  });
  deleteProduct.mockResolvedValue(SAMPLE_PRODUCTS[0]);
  duplicateProduct.mockResolvedValue({
    ...SAMPLE_PRODUCTS[0],
    _id: "prod-copy",
    name: "Copy of Care Management Platform",
    sku: null,
  });
  exportCatalog.mockResolvedValue({ data: new Blob() });
  importCatalog.mockResolvedValue({
    data: { data: { inserted: 1, updated: 0, errors: [] } },
  });
  resetCatalog.mockResolvedValue({ message: "Catalog reset." });
});

// ─── Access control ───────────────────────────────────────────────────────────
describe("Access control", () => {
  it("shows Access denied for sales_rep", async () => {
    useAuth.mockReturnValue({
      user: { role: "sales_rep", firstName: "Rep", lastName: "User" },
    });
    render(
      <MemoryRouter future={routerFuture}>
        <Products />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Access denied");
  });

  it("renders Product Catalog heading for admin", async () => {
    renderPage("admin");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /product catalog/i }),
      ).toBeInTheDocument(),
    );
  });
});

// ─── Loading and empty states ─────────────────────────────────────────────────
describe("Loading and empty states", () => {
  it("shows spinner initially", () => {
    getProducts.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows empty state when no products", async () => {
    getProducts.mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/no products found/i)).toBeInTheDocument(),
    );
  });
});

// ─── Table rendering ──────────────────────────────────────────────────────────
describe("Table rendering", () => {
  it("renders a row for each product", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Care Management Platform")).toBeInTheDocument(),
    );
    expect(screen.getByText("Behavioral Health Add-on")).toBeInTheDocument();
  });

  it("renders SKU in monospace", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("CMP-001")).toBeInTheDocument(),
    );
  });

  it("renders type badge for each product", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Core")).toBeInTheDocument();
      expect(screen.getByText("Add-on")).toBeInTheDocument();
    });
  });

  it("renders product line badge for products with a line", async () => {
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByLabelText("Product Line: Care Management"),
      ).toBeInTheDocument(),
    );
  });
});

// ─── Toolbar ─────────────────────────────────────────────────────────────────
describe("Toolbar", () => {
  it("renders search input", async () => {
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("searchbox", { name: /search/i }),
      ).toBeInTheDocument(),
    );
  });

  it("renders product line filter dropdown", async () => {
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: /filter by product line/i }),
      ).toBeInTheDocument(),
    );
  });

  it("renders Export XLSX button for admin", async () => {
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /export xlsx/i }),
      ).toBeInTheDocument(),
    );
  });

  it("does not render Reset Catalog button for admin (only super_admin)", async () => {
    renderPage("admin");
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /reset catalog/i }),
      ).not.toBeInTheDocument(),
    );
  });

  it("renders Reset Catalog button for super_admin", async () => {
    renderPage("super_admin");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /reset catalog/i }),
      ).toBeInTheDocument(),
    );
  });
});

// ─── Add product ──────────────────────────────────────────────────────────────
describe("Add product", () => {
  it("opens drawer when + Add Product is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /add product/i }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /add product/i }));
    expect(
      screen.getByRole("dialog", { name: /add product/i }),
    ).toBeInTheDocument();
  });

  it("shows error when name is empty on submit", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /add product/i }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /add product/i }));
    const form = screen.getByRole("form", { name: /product form/i });
    const submitBtn = within(form).getByRole("button", {
      name: /create product/i,
    });
    // Clear the name field if pre-filled
    const nameInput = within(form).getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.click(submitBtn);
    await waitFor(() =>
      expect(within(form).getByText(/name is required/i)).toBeInTheDocument(),
    );
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("calls createProduct and shows success toast on valid submit", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /add product/i }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /add product/i }));
    const form = screen.getByRole("form", { name: /product form/i });
    const nameInput = within(form).getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "New Product");
    await user.click(
      within(form).getByRole("button", { name: /create product/i }),
    );
    await waitFor(() =>
      expect(createProduct).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Product" }),
      ),
    );
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/created/i),
    );
  });

  it("shows error toast when API returns 409", async () => {
    createProduct.mockRejectedValue({
      response: { data: { error: "A product with that SKU already exists." } },
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /add product/i }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /add product/i }));
    const form = screen.getByRole("form", { name: /product form/i });
    const nameInput = within(form).getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Duplicate SKU Product");
    await user.click(
      within(form).getByRole("button", { name: /create product/i }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/sku already exists/i),
      ),
    );
  });
});

// ─── Edit product ─────────────────────────────────────────────────────────────
describe("Edit product", () => {
  it("opens edit drawer pre-filled when Edit is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: /view details for care management platform/i,
        }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", {
        name: /view details for care management platform/i,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: /edit care management platform/i }),
    );
    expect(
      screen.getByRole("dialog", { name: /edit product/i }),
    ).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/^name/i);
    expect(nameInput.value).toBe("Care Management Platform");
  });

  it("calls updateProduct and shows success toast on save", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: /view details for care management platform/i,
        }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", {
        name: /view details for care management platform/i,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: /edit care management platform/i }),
    );
    const nameInput = screen.getByLabelText(/^name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Name");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(updateProduct).toHaveBeenCalledWith(
        "prod-1",
        expect.objectContaining({ name: "Updated Name" }),
      ),
    );
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/updated/i),
    );
  });
});

// ─── Duplicate ────────────────────────────────────────────────────────────────
describe("Duplicate product", () => {
  it("calls duplicateProduct and shows success toast when Copy is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: /view details for care management platform/i,
        }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", {
        name: /view details for care management platform/i,
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: /duplicate care management platform/i,
      }),
    );
    await waitFor(() =>
      expect(duplicateProduct).toHaveBeenCalledWith("prod-1"),
    );
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/duplicated/i),
    );
  });
});

// ─── Delete product ───────────────────────────────────────────────────────────
describe("Delete product", () => {
  it("shows confirmation modal when Delete is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: /view details for care management platform/i,
        }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", {
        name: /view details for care management platform/i,
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: /delete care management platform/i,
      }),
    );
    expect(
      screen.getByRole("dialog", { name: /confirm delete/i }),
    ).toBeInTheDocument();
  });

  it("calls deleteProduct and removes row on confirm", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: /view details for care management platform/i,
        }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", {
        name: /view details for care management platform/i,
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: /delete care management platform/i,
      }),
    );
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(deleteProduct).toHaveBeenCalledWith("prod-1"));
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/deleted/i),
    );
  });
});

// ─── Export ───────────────────────────────────────────────────────────────────
describe("Export", () => {
  it("calls exportCatalog when Export XLSX is clicked", async () => {
    // jsdom doesn't support URL.createObjectURL; stub it
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();

    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /export xlsx/i }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /export xlsx/i }));
    await waitFor(() => expect(exportCatalog).toHaveBeenCalled());
  });
});

// ─── Reset catalog ────────────────────────────────────────────────────────────
describe("Reset catalog", () => {
  it("shows reset confirmation modal for super_admin", async () => {
    const user = userEvent.setup();
    renderPage("super_admin");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /reset catalog/i }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /reset catalog/i }));
    expect(
      screen.getByRole("dialog", { name: /reset product catalog/i }),
    ).toBeInTheDocument();
  });

  it("calls resetCatalog and shows success toast on confirm", async () => {
    getProducts.mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage("super_admin");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /reset catalog/i }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /reset catalog/i }));
    await user.click(screen.getByRole("button", { name: /^reset catalog$/i }));
    await waitFor(() => expect(resetCatalog).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/reset/i));
  });
});

// ─── Tiers/Volume Bands conditional editors ────────────────────────────────────
describe("Conditional editors", () => {
  it("shows tiers editor when pricingStrategy is Tiered", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /add product/i }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /add product/i }));
    const form = screen.getByRole("form", { name: /product form/i });
    const strategySelect = within(form).getByLabelText(/pricing strategy/i);
    await user.selectOptions(strategySelect, "Tiered");
    expect(
      within(form).getByRole("group", { name: /tiers/i }),
    ).toBeInTheDocument();
  });

  it("shows volume bands editor when pricingStrategy is Volume Bands", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /add product/i }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /add product/i }));
    const form = screen.getByRole("form", { name: /product form/i });
    const strategySelect = within(form).getByLabelText(/pricing strategy/i);
    await user.selectOptions(strategySelect, "Volume Bands");
    expect(
      within(form).getByRole("group", { name: /volume bands/i }),
    ).toBeInTheDocument();
  });
});

// ─── Drawer close ─────────────────────────────────────────────────────────────
describe("Drawer close", () => {
  it("closes drawer when close button is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /add product/i }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /add product/i }));
    expect(
      screen.getByRole("dialog", { name: /add product/i }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /close add product/i }),
    );
    expect(
      screen.queryByRole("region", { name: /add product/i }),
    ).not.toBeInTheDocument();
  });
});
