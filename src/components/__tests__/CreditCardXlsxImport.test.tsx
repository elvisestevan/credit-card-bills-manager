import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { CreditCardXlsxImport } from "../CreditCardXlsxImport";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("CreditCardXlsxImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders upload zone correctly", () => {
    render(<CreditCardXlsxImport />);
    expect(screen.getByText("Drop your XLSX file here")).toBeInTheDocument();
    expect(screen.getByText("or click to browse")).toBeInTheDocument();
  });

  it("rejects non-XLSX file", async () => {
    render(<CreditCardXlsxImport />);
    const file = new File(["content"], "test.csv", { type: "text/csv" });
    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Please select an XLSX file")).toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows loading state during upload", async () => {
    (global.fetch as any).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ items: [], billMonthYear: "08-2026", cardName: "Test" }),
      }), 100))
    );

    render(<CreditCardXlsxImport />);
    const file = new File(["content"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Parsing file...")).toBeInTheDocument();
    });
  });

  it("shows preview table after successful upload", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        billMonthYear: "08-2026",
        cardName: "Itau - final 6283",
        items: [
          { index: 0, date: "2026-07-06", description: "Store A", amount: 100, installmentNumber: null, totalInstallments: null, billMonthYear: "08-2026", selected: true, exists: false },
          { index: 1, date: "2026-07-07", description: "Store B", amount: 50, installmentNumber: 2, totalInstallments: 3, billMonthYear: "08-2026", selected: true, exists: false },
        ],
        errors: [],
      }),
    });

    render(<CreditCardXlsxImport />);
    const file = new File(["content"], "fatura.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Preview (2 transactions)")).toBeInTheDocument();
      expect(screen.getByText("Store A")).toBeInTheDocument();
      expect(screen.getByText("Store B")).toBeInTheDocument();
      expect(screen.getByText("2/3")).toBeInTheDocument();
    });
  });

  it("toggles item selection", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        billMonthYear: "08-2026",
        cardName: "Test",
        items: [
          { index: 0, date: "2026-07-06", description: "Store A", amount: 100, installmentNumber: null, totalInstallments: null, billMonthYear: "08-2026", selected: true, exists: false },
        ],
        errors: [],
      }),
    });

    render(<CreditCardXlsxImport />);
    const file = new File(["content"], "fatura.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Store A")).toBeInTheDocument();
    });

    const checkbox = screen.getAllByRole("checkbox")[1];
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByText("Import Selected (0)")).toBeInTheDocument();
    });
  });

  it("calls confirm API on import", async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          billMonthYear: "08-2026",
          cardName: "Test",
          items: [
            { index: 0, date: "2026-07-06", description: "Store A", amount: 100, installmentNumber: null, totalInstallments: null, billMonthYear: "08-2026", selected: true, exists: false },
          ],
          errors: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, added: 1, ignored: 0 }),
      });

    render(<CreditCardXlsxImport />);
    const file = new File(["content"], "fatura.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Store A")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Import Selected (1)"));

    await waitFor(() => {
      expect(screen.getByText("Imported 1 transactions (0 duplicates skipped)")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/transactions/import/credit-card-xlsx/confirm",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows error on preview failure", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Failed to parse XLSX" }),
    });

    render(<CreditCardXlsxImport />);
    const file = new File(["content"], "bad.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Failed to parse XLSX")).toBeInTheDocument();
    });
  });

  it("shows network error", async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

    render(<CreditCardXlsxImport />);
    const file = new File(["content"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Network error. Please try again.")).toBeInTheDocument();
    });
  });

  it("resets state on Start Over", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        billMonthYear: "08-2026",
        cardName: "Test",
        items: [
          { index: 0, date: "2026-07-06", description: "Store A", amount: 100, installmentNumber: null, totalInstallments: null, billMonthYear: "08-2026", selected: true, exists: false },
        ],
        errors: [],
      }),
    });

    render(<CreditCardXlsxImport />);
    const file = new File(["content"], "fatura.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Store A")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Start Over"));

    await waitFor(() => {
      expect(screen.getByText("Drop your XLSX file here")).toBeInTheDocument();
    });
  });
});
