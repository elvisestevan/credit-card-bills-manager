import { describe, it, expect, beforeEach, vi } from "bun:test";

const mockPrisma = {
  transaction: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/generated/prisma/client", () => ({
  Prisma: {
    Decimal: class Decimal {
      constructor(value: string | number) {
        this.value = value;
      }
      toString() {
        return String(this.value);
      }
    },
  },
}));

describe("POST /api/transactions/import", async () => {
  const { POST } = await import("../route");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 if no file provided", async () => {
    const formData = new FormData();
    
    const request = new Request("http://localhost:3000/api/transactions/import", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("No file provided");
  });

  it("should return 400 if file is not CSV", async () => {
    const formData = new FormData();
    const file = new Blob(["content"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    formData.append("file", file, "test.xlsx");

    const request = new Request("http://localhost:3000/api/transactions/import", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("File must be a CSV");
  });

  it("should successfully import valid CSV", async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    mockPrisma.transaction.createMany.mockResolvedValueOnce({ count: 2 });

    const formData = new FormData();
    const csvContent = "data,lançamento,valor\n2024-01-01,Purchase1,-100\n2024-01-02,Purchase2,-200";
    const file = new Blob([csvContent], { type: "text/csv" });
    formData.append("file", file, "test.csv");

    const request = new Request("http://localhost:3000/api/transactions/import", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imported).toBe(2);
    expect(data.skipped).toBe(0);
    expect(data.importId).toBeDefined();
  });

  it("should skip duplicate transactions", async () => {
    const existingTx = {
      date: new Date("2024-01-01"),
      description: "Purchase1",
      amount: { toString: () => "-100" },
    };
    mockPrisma.transaction.findMany.mockResolvedValueOnce([existingTx]);
    mockPrisma.transaction.createMany.mockResolvedValueOnce({ count: 1 });

    const formData = new FormData();
    const csvContent = "data,lançamento,valor\n2024-01-01,Purchase1,-100\n2024-01-02,Purchase2,-200";
    const file = new Blob([csvContent], { type: "text/csv" });
    formData.append("file", file, "test.csv");

    const request = new Request("http://localhost:3000/api/transactions/import", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imported).toBe(1);
    expect(data.skipped).toBe(1);
  });

  it("should return 400 for CSV with only headers", async () => {
    const formData = new FormData();
    const csvContent = "data,lançamento,valor";
    const file = new Blob([csvContent], { type: "text/csv" });
    formData.append("file", file, "test.csv");

    const request = new Request("http://localhost:3000/api/transactions/import", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Failed to parse CSV");
  });
});