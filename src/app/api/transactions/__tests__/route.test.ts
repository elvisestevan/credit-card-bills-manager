import { describe, it, expect, beforeEach, vi } from "bun:test";

const mockPrisma = {
  transaction: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

describe("GET /api/transactions", async () => {
  const { GET } = await import("../route");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return default pagination and sorted by date desc", async () => {
    const mockTransactions = [
      { id: 1, date: new Date("2024-01-02"), description: "Test2", amount: { toString: () => "-100" }, cardName: null, installmentNumber: null, totalInstallments: null },
      { id: 2, date: new Date("2024-01-01"), description: "Test1", amount: { toString: () => "-50" }, cardName: null, installmentNumber: null, totalInstallments: null },
    ];
    mockPrisma.transaction.findMany.mockResolvedValueOnce(mockTransactions);
    mockPrisma.transaction.count.mockResolvedValueOnce(2);

    const request = new Request("http://localhost:3000/api/transactions");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(2);
    expect(data.pagination).toEqual({ page: 1, limit: 20, total: 2 });
    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        orderBy: { date: "desc" },
      })
    );
  });

  it("should handle custom page and limit", async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    mockPrisma.transaction.count.mockResolvedValueOnce(0);

    const request = new Request("http://localhost:3000/api/transactions?page=3&limit=50");
    const response = await GET(request);

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 100,
        take: 50,
      })
    );
  });

  it("should sort by amount ascending", async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    mockPrisma.transaction.count.mockResolvedValueOnce(0);

    const request = new Request("http://localhost:3000/api/transactions?sortBy=amount&sortOrder=asc");
    const response = await GET(request);

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { amount: "asc" },
      })
    );
  });

  it("should fall back to date sort for invalid sort field", async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    mockPrisma.transaction.count.mockResolvedValueOnce(0);

    const request = new Request("http://localhost:3000/api/transactions?sortBy=invalid&sortOrder=asc");
    const response = await GET(request);

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { date: "asc" },
      })
    );
  });

  it("should use defaults for page=1 and limit=20 when not provided", async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    mockPrisma.transaction.count.mockResolvedValueOnce(0);

    const request = new Request("http://localhost:3000/api/transactions");
    const response = await GET(request);

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
      })
    );
  });

  it("should return empty array when no transactions", async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    mockPrisma.transaction.count.mockResolvedValueOnce(0);

    const request = new Request("http://localhost:3000/api/transactions");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(0);
    expect(data.pagination.total).toBe(0);
  });

  it("should transform transactions correctly", async () => {
    const mockTransactions = [
      { id: 1, date: new Date("2024-01-01"), description: "Test", amount: { toString: () => "-100.50" }, cardName: "Itau", installmentNumber: 1, totalInstallments: 3 },
    ];
    mockPrisma.transaction.findMany.mockResolvedValueOnce(mockTransactions);
    mockPrisma.transaction.count.mockResolvedValueOnce(1);

    const request = new Request("http://localhost:3000/api/transactions");
    const response = await GET(request);
    const data = await response.json();

    expect(data.data[0]).toEqual({
      id: 1,
      date: "2024-01-01",
      description: "Test",
      amount: "-100.50",
      cardName: "Itau",
      installmentNumber: 1,
      totalInstallments: 3,
    });
  });

  it("should sort by description", async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    mockPrisma.transaction.count.mockResolvedValueOnce(0);

    const request = new Request("http://localhost:3000/api/transactions?sortBy=description");
    const response = await GET(request);

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { description: "desc" },
      })
    );
  });
});