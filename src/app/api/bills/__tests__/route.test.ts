import { describe, it, expect, beforeEach, vi } from "vitest";

const mockPrisma = {
  bill: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

describe("GET /api/bills", async () => {
  const { GET } = await import("../route");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty array when no bills", async () => {
    mockPrisma.bill.findMany.mockResolvedValueOnce([]);

    const request = new Request("http://localhost:3000/api/bills");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  it("should return bills with aggregated data", async () => {
    const mockBills = [
      {
        id: "bill1",
        monthYear: "04-2026",
        updatedAt: new Date("2026-04-30T12:00:00.000Z"),
        _count: { transactions: 5 },
        transactions: [
          { amount: { toNumber: () => 100 }, installmentNumber: null, totalInstallments: null },
          { amount: { toNumber: () => 200 }, installmentNumber: 1, totalInstallments: 3 },
          { amount: { toNumber: () => 300 }, installmentNumber: 2, totalInstallments: 3 },
        ],
      },
    ];
    mockPrisma.bill.findMany.mockResolvedValueOnce(mockBills);

    const request = new Request("http://localhost:3000/api/bills");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0]).toEqual({
      id: "bill1",
      monthYear: "04-2026",
      totalTransactions: 5,
      totalAmount: 600,
      totalInstallmentTransactions: 2,
      totalInstallmentAmount: 500,
      lastUpdated: "2026-04-30T12:00:00.000Z",
    });
  });

  it("should order bills by monthYear descending", async () => {
    mockPrisma.bill.findMany.mockResolvedValueOnce([]);

    const request = new Request("http://localhost:3000/api/bills");
    await GET(request);

    expect(mockPrisma.bill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { monthYear: "desc" },
      })
    );
  });
});
