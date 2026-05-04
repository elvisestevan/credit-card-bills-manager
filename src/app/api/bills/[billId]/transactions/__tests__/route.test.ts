import { describe, it, expect, beforeEach, vi } from "vitest";

const mockPrisma = {
  bill: {
    findUnique: vi.fn(),
  },
  transaction: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

describe("GET /api/bills/[billId]/transactions", async () => {
  const { GET } = await import("../route");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 404 if bill not found", async () => {
    mockPrisma.bill.findUnique.mockResolvedValueOnce(null);

    const request = new Request("http://localhost:3000/api/bills/nonexistent/transactions");
    const response = await GET(request, { params: Promise.resolve({ billId: "nonexistent" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Bill not found");
  });

  it("should return bill transactions with pagination", async () => {
    const mockBill = {
      id: "bill1",
      monthYear: "04-2026",
    };
    const mockTransactions = [
      { id: 1, date: new Date("2024-01-02"), description: "Test2", amount: { toString: () => "-100" }, cardName: null, installmentNumber: null, totalInstallments: null },
      { id: 2, date: new Date("2024-01-01"), description: "Test1", amount: { toString: () => "-50" }, cardName: null, installmentNumber: null, totalInstallments: null },
    ];

    mockPrisma.bill.findUnique.mockResolvedValueOnce(mockBill);
    mockPrisma.transaction.findMany.mockResolvedValueOnce(mockTransactions);
    mockPrisma.transaction.count.mockResolvedValueOnce(2);

    const request = new Request("http://localhost:3000/api/bills/bill1/transactions");
    const response = await GET(request, { params: Promise.resolve({ billId: "bill1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.bill).toEqual({ id: "bill1", monthYear: "04-2026" });
    expect(data.data).toHaveLength(2);
    expect(data.pagination).toEqual({ page: 1, limit: 20, total: 2 });
  });

  it("should handle custom page and limit", async () => {
    const mockBill = { id: "bill1", monthYear: "04-2026" };

    mockPrisma.bill.findUnique.mockResolvedValueOnce(mockBill);
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    mockPrisma.transaction.count.mockResolvedValueOnce(0);

    const request = new Request("http://localhost:3000/api/bills/bill1/transactions?page=3&limit=50");
    await GET(request, { params: Promise.resolve({ billId: "bill1" }) });

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { billId: "bill1" },
        skip: 100,
        take: 50,
      })
    );
  });

  it("should sort by date descending by default", async () => {
    const mockBill = { id: "bill1", monthYear: "04-2026" };

    mockPrisma.bill.findUnique.mockResolvedValueOnce(mockBill);
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    mockPrisma.transaction.count.mockResolvedValueOnce(0);

    const request = new Request("http://localhost:3000/api/bills/bill1/transactions");
    await GET(request, { params: Promise.resolve({ billId: "bill1" }) });

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { date: "desc" },
      })
    );
  });

  it("should sort by amount ascending", async () => {
    const mockBill = { id: "bill1", monthYear: "04-2026" };

    mockPrisma.bill.findUnique.mockResolvedValueOnce(mockBill);
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    mockPrisma.transaction.count.mockResolvedValueOnce(0);

    const request = new Request("http://localhost:3000/api/bills/bill1/transactions?sortBy=amount&sortOrder=asc");
    await GET(request, { params: Promise.resolve({ billId: "bill1" }) });

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { amount: "asc" },
      })
    );
  });

  it("should filter transactions by billId", async () => {
    const mockBill = { id: "bill1", monthYear: "04-2026" };

    mockPrisma.bill.findUnique.mockResolvedValueOnce(mockBill);
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    mockPrisma.transaction.count.mockResolvedValueOnce(0);

    const request = new Request("http://localhost:3000/api/bills/bill1/transactions");
    await GET(request, { params: Promise.resolve({ billId: "bill1" }) });

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { billId: "bill1" },
      })
    );
  });
});
