import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = {
  transaction: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
  bill: {
    upsert: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/generated/prisma/client", () => ({
  Prisma: {
    Decimal: vi.fn().mockImplementation((value: string | number) => ({
      value,
      toString: () => String(value),
    })),
  },
}));

function createMockRequest(csvContent: string, filename: string, billMonthYear: string) {
  const url = "http://localhost:3000/api/transactions/import";
  
  const request = new NextRequest(url, { method: "POST" });
  
  const file = new File([csvContent], filename, { type: "text/csv" });
  if (!file.text) {
    (file as any).text = () => Promise.resolve(csvContent);
  }
  
  const formData = new FormData();
  formData.append("file", file);
  formData.append("billMonthYear", billMonthYear);
  
  vi.spyOn(request, "formData").mockResolvedValue(formData as any);
  
  return request;
}

describe("POST /api/transactions/import", async () => {
  const { POST } = await import("../route");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 if no file provided", async () => {
    const request = new NextRequest("http://localhost:3000/api/transactions/import", {
      method: "POST",
    });
    const formData = new FormData();
    vi.spyOn(request, "formData").mockResolvedValue(formData as any);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("No file provided");
  });

  it("should return 400 if file is not CSV", async () => {
    const request = new NextRequest("http://localhost:3000/api/transactions/import", {
      method: "POST",
    });
    const file = new File(["content"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const formData = new FormData();
    formData.append("file", file);
    vi.spyOn(request, "formData").mockResolvedValue(formData as any);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("File must be a CSV");
  });

  it("should return 400 if billMonthYear is invalid", async () => {
    const csvContent = "data,lançamento,valor\n2024-01-01,Purchase1,-100";
    const request = createMockRequest(csvContent, "test.csv", "April 2026");

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Invalid bill ID format");
  });

  it("should successfully import valid CSV with billMonthYear", async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    mockPrisma.bill.upsert.mockResolvedValueOnce({ id: "bill123", monthYear: "04-2026" });
    mockPrisma.transaction.createMany.mockResolvedValueOnce({ count: 2 });

    const csvContent = "data,lançamento,valor\n2024-01-01,Purchase1,-100\n2024-01-02,Purchase2,-200";
    const request = createMockRequest(csvContent, "test.csv", "04-2026");

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.added).toBe(2);
    expect(data.ignored).toBe(0);
  });

  it("should skip duplicate transactions for the same bill", async () => {
    const existingTx = {
      date: new Date("2024-01-01"),
      description: "Purchase1",
      amount: { toString: () => "-100" },
      billId: "bill123",
      bill: { monthYear: "04-2026" },
    };
    mockPrisma.transaction.findMany.mockResolvedValueOnce([existingTx]);
    mockPrisma.bill.upsert.mockResolvedValueOnce({ id: "bill123", monthYear: "04-2026" });
    mockPrisma.transaction.createMany.mockResolvedValueOnce({ count: 1 });

    const csvContent = "data,lançamento,valor\n2024-01-01,Purchase1,-100\n2024-01-02,Purchase2,-200";
    const request = createMockRequest(csvContent, "test.csv", "04-2026");

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.added).toBe(1);
    expect(data.ignored).toBe(1);
  });

  it("should refuse import if transaction exists in different bill", async () => {
    const existingTx = {
      date: new Date("2024-01-01"),
      description: "Purchase1",
      amount: { toString: () => "-100" },
      billId: "bill456",
      bill: { monthYear: "03-2026" },
    };
    mockPrisma.transaction.findMany.mockResolvedValueOnce([existingTx]);

    const csvContent = "data,lançamento,valor\n2024-01-01,Purchase1,-100";
    const request = createMockRequest(csvContent, "test.csv", "04-2026");

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Conflicting transactions found in other bills");
    expect(data.conflicts).toHaveLength(1);
    expect(data.conflicts[0].existingBill).toBe("03-2026");
  });

  it("should return 400 for CSV with only headers", async () => {
    const csvContent = "data,lançamento,valor";
    const request = createMockRequest(csvContent, "test.csv", "04-2026");

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Failed to parse CSV");
  });
});
