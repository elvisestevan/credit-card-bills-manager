import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionsTable } from "../TransactionsTable";

const mockTransactionsResponse = {
  data: [
    {
      id: 1,
      date: "2024-01-02",
      description: "Shopping",
      amount: "-200.00",
      cardName: "Itau",
      installmentNumber: null,
      totalInstallments: null,
    },
    {
      id: 2,
      date: "2024-01-01",
      description: "Food",
      amount: "-50.00",
      cardName: null,
      installmentNumber: null,
      totalInstallments: null,
    },
  ],
  pagination: { page: 1, limit: 20, total: 2 },
};

const mockTransactionsWithInstallments = {
  data: [
    {
      id: 1,
      date: "2024-01-01",
      description: "Store",
      amount: "-100.00",
      cardName: "Itau",
      installmentNumber: 1,
      totalInstallments: 3,
    },
  ],
  pagination: { page: 1, limit: 20, total: 1 },
};

const mockPositiveAmount = {
  data: [
    {
      id: 1,
      date: "2024-01-01",
      description: "Salary",
      amount: "500.00",
      cardName: null,
      installmentNumber: null,
      totalInstallments: null,
    },
  ],
  pagination: { page: 1, limit: 20, total: 1 },
};

describe("TransactionsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows loading state initially", () => {
    (global.fetch as any).mockImplementationOnce(() => new Promise(() => {}));

    render(<TransactionsTable refreshKey={0} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows empty state when no data", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [], pagination: { page: 1, limit: 20, total: 0 } }),
    });

    render(<TransactionsTable refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("No transactions yet. Import a CSV file to get started.")).toBeInTheDocument();
    });
  });

  it("renders transactions correctly", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTransactionsResponse),
    });

    render(<TransactionsTable refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Shopping")).toBeInTheDocument();
      expect(screen.getByText("Food")).toBeInTheDocument();
      expect(screen.getByText("2024-01-02")).toBeInTheDocument();
      expect(screen.getByText("2024-01-01")).toBeInTheDocument();
    });
  });

  it("formats negative amounts in green", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTransactionsResponse),
    });

    render(<TransactionsTable refreshKey={0} />);

    await waitFor(() => {
      const amountElements = document.querySelectorAll("td.text-green-400");
      expect(amountElements.length).toBeGreaterThan(0);
    });
  });

  it("formats positive amounts in red", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPositiveAmount),
    });

    render(<TransactionsTable refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Salary")).toBeInTheDocument();
      const amountElements = document.querySelectorAll("td.text-red-400");
      expect(amountElements.length).toBeGreaterThan(0);
    });
  });

  it("displays installments correctly", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTransactionsWithInstallments),
    });

    render(<TransactionsTable refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("1/3")).toBeInTheDocument();
    });
  });

  it("sorts by date when date header clicked", async () => {
    const user = userEvent.setup();

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTransactionsResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTransactionsResponse),
      });

    render(<TransactionsTable refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Shopping")).toBeInTheDocument();
    });

    const table = document.querySelector("table");
    const dateHeader = table?.querySelector("th:nth-child(1)");
    await user.click(dateHeader as HTMLElement);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining("sortBy=date")
      );
    });
  });

  it("sorts by description when description header clicked", async () => {
    const user = userEvent.setup();

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTransactionsResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTransactionsResponse),
      });

    render(<TransactionsTable refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Shopping")).toBeInTheDocument();
    });

    const table = document.querySelector("table");
    const descHeader = table?.querySelector("th:nth-child(2)");
    await user.click(descHeader as HTMLElement);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining("sortBy=description")
      );
    });
  });

  it("sorts by amount when amount header clicked", async () => {
    const user = userEvent.setup();

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTransactionsResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTransactionsResponse),
      });

    render(<TransactionsTable refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Shopping")).toBeInTheDocument();
    });

    const table = document.querySelector("table");
    const amountHeader = table?.querySelector("th:nth-child(3)");
    await user.click(amountHeader as HTMLElement);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining("sortBy=amount")
      );
    });
  });

  it("shows pagination when multiple pages", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: mockTransactionsResponse.data,
          pagination: { page: 1, limit: 20, total: 50 },
        }),
    });

    render(<TransactionsTable refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 3 (50 total)")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });
  });

  it("navigates to next page", async () => {
    const user = userEvent.setup();

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: mockTransactionsResponse.data,
            pagination: { page: 1, limit: 20, total: 50 },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: mockTransactionsResponse.data,
            pagination: { page: 2, limit: 20, total: 50 },
          }),
      });

    render(<TransactionsTable refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining("page=2")
      );
    });
  });

  it("disables previous button on first page", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: mockTransactionsResponse.data,
          pagination: { page: 1, limit: 20, total: 50 },
        }),
    });

    render(<TransactionsTable refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    });
  });

  it("disables next button on last page", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: mockTransactionsResponse.data,
          pagination: { page: 3, limit: 20, total: 50 },
        }),
    });

    render(<TransactionsTable refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });
  });

  it("refreshes data when refreshKey changes", async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTransactionsResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTransactionsResponse),
      });

    const { rerender } = render(<TransactionsTable refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Shopping")).toBeInTheDocument();
    });

    rerender(<TransactionsTable refreshKey={1} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it("handles fetch error gracefully", async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

    render(<TransactionsTable refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("No transactions yet. Import a CSV file to get started.")).toBeInTheDocument();
    });
  });
});
