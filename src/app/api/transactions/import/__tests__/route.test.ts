import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

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
    Decimal: vi.fn().mockImplementation((value: string | number) => ({
      value,
      toString: () => String(value),
    })),
  },
}));

function createMockRequest(csvContent: string, filename: string) {
  const url = "http://localhost:3000/api/transactions/import";
  
  // Create a mock NextRequest with mocked formData method
  const request = new NextRequest(url, { method: "POST" });
  
  // Create a File with text() method polyfilled
  const file = new File([csvContent], filename, { type: "text/csv" });
  if (!file.text) {
    (file as any).text = () => Promise.resolve(csvContent);
  }
  
  const formData = new FormData();
  formData.append("file", file);
  
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
    expect(data.error).toBe("File must be a CSV");
  });

  it("should successfully import valid CSV", async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    mockPrisma.transaction.createMany.mockResolvedValueOnce({ count: 2 });

    const csvContent = "data,lançamento,valor\n2024-01-01,Purchase1,-100\n2024-01-02,Purchase2,-200";
    const request = createMockRequest(csvContent, "test.csv");

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

    const csvContent = "data,lançamento,valor\n2024-01-01,Purchase1,-100\n2024-01-02,Purchase2,-200";
    const request = createMockRequest(csvContent, "test.csv");

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imported).toBe(1);
    expect(data.skipped).toBe(1);
  });

  it("should return 400 for CSV with only headers", async () => {
    const csvContent = "data,lançamento,valor";
    const request = createMockRequest(csvContent, "test.csv");

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Failed to parse CSV");
  });
});
