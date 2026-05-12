import { renderHook, act } from "@testing-library/react";
import { vi, beforeEach, afterEach, describe, it, expect } from "vitest";

// ── localStorage mock ─────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, val) => {
      store[key] = val;
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    _getStore: () => store,
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// ── Imports under test ────────────────────────────────────────────────────────
import { useDarkMode } from "../useDarkMode";

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  // Reset data-bs-theme attribute
  document.documentElement.removeAttribute("data-bs-theme");
});

afterEach(() => {
  document.documentElement.removeAttribute("data-bs-theme");
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("useDarkMode", () => {
  it("defaults to light mode when localStorage has no entry", () => {
    localStorageMock.getItem.mockReturnValueOnce(null);

    const { result } = renderHook(() => useDarkMode());

    expect(result.current.isDark).toBe(false);
  });

  it("initialises to dark mode when localStorage stores 'dark'", () => {
    localStorageMock.getItem.mockReturnValueOnce("dark");

    const { result } = renderHook(() => useDarkMode());

    expect(result.current.isDark).toBe(true);
  });

  it("sets data-bs-theme attribute to 'light' on mount in light mode", () => {
    localStorageMock.getItem.mockReturnValueOnce(null);

    renderHook(() => useDarkMode());

    expect(document.documentElement.getAttribute("data-bs-theme")).toBe(
      "light",
    );
  });

  it("sets data-bs-theme attribute to 'dark' on mount in dark mode", () => {
    localStorageMock.getItem.mockReturnValueOnce("dark");

    renderHook(() => useDarkMode());

    expect(document.documentElement.getAttribute("data-bs-theme")).toBe("dark");
  });

  it("toggle switches from light to dark", () => {
    localStorageMock.getItem.mockReturnValueOnce(null);

    const { result } = renderHook(() => useDarkMode());

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isDark).toBe(true);
  });

  it("toggle switches from dark to light", () => {
    localStorageMock.getItem.mockReturnValueOnce("dark");

    const { result } = renderHook(() => useDarkMode());

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isDark).toBe(false);
  });

  it("persists theme to localStorage after toggle", () => {
    localStorageMock.getItem.mockReturnValueOnce(null);

    const { result } = renderHook(() => useDarkMode());

    act(() => {
      result.current.toggle();
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith("cpq-theme", "dark");
  });

  it("updates data-bs-theme attribute after toggle", () => {
    localStorageMock.getItem.mockReturnValueOnce(null);

    const { result } = renderHook(() => useDarkMode());

    act(() => {
      result.current.toggle();
    });

    expect(document.documentElement.getAttribute("data-bs-theme")).toBe("dark");
  });
});
