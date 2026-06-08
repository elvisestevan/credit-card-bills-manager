import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = {
  bill: {
    upsert: vi.fn(),
  },
  category: {
    upsert: vi.fn(),
  },
  transaction: {
    create: vi.fn(),
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

function createPostRequest(body: Record<string, unknown>) {
  const request = new NextRequest("http://localhost:3000/api/transactions", {
    method: "POST",
  });
  vi.spyOn(request, "json").mockResolvedValue(body);
  return request;
}

describe("POST /api/transactions", async () => {
  const { POST } = await import("../route");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 if date is missing", async () => {
    const request = createPostRequest({ description: "Test", amount: 100 });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("date");
  });

  it("should return 400 if description is missing", async () => {
    const request = createPostRequest({ date: "2025-06-01", amount: 100 });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("description");
  });

  it("should return 400 if amount is missing", async () => {
    const request = createPostRequest({ date: "2025-06-01", description: "Test" });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("amount");
  });

  it("should return 400 if date is invalid", async () => {
    const request = createPostRequest({ date: "not-a-date", description: "Test", amount: 100 });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Invalid date");
  });

  it("should successfully create a transaction with required fields", async () => {
    mockPrisma.bill.upsert.mockResolvedValueOnce({ id: "bill123", monthYear: "06-2025" });
    mockPrisma.transaction.create.mockResolvedValueOnce({
      id: 1,
      date: new Date("2025-06-01"),
      description: "Supermercado",
      amount: { toString: () => "150.50" },
      cardName: null,
      installmentNumber: null,
      totalInstallments: null,
      transactionType: "credit_card",
      categoryId: null,
      category: null,
      billId: "bill123",
      bill: { monthYear: "06-2025" },
    });

    const request = createPostRequest({
      date: "2025-06-01",
      description: "Supermercado",
      amount: 150.50,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.transaction.description).toBe("Supermercado");
    expect(data.transaction.amount).toBe("150.50");
    expect(data.transaction.billMonthYear).toBe("06-2025");
    expect(mockPrisma.bill.upsert).toHaveBeenCalledWith({
      where: { monthYear: "06-2025" },
      create: { monthYear: "06-2025" },
      update: {},
    });
  });

  it("should create category when categoryName is provided", async () => {
    mockPrisma.bill.upsert.mockResolvedValueOnce({ id: "bill123", monthYear: "06-2025" });
    mockPrisma.category.upsert.mockResolvedValueOnce({ id: 10, name: "alimentação" });
    mockPrisma.transaction.create.mockResolvedValueOnce({
      id: 2,
      date: new Date("2025-06-01"),
      description: "Restaurante",
      amount: { toString: () => "89.90" },
      cardName: null,
      installmentNumber: null,
      totalInstallments: null,
      transactionType: "credit_card",
      categoryId: 10,
      category: { name: "alimentação" },
      billId: "bill123",
      bill: { monthYear: "06-2025" },
    });

    const request = createPostRequest({
      date: "2025-06-01",
      description: "Restaurante",
      amount: 89.90,
      categoryName: "Alimentação",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.transaction.categoryName).toBe("alimentação");
    expect(mockPrisma.category.upsert).toHaveBeenCalledWith({
      where: { name: "alimentação" },
      update: {},
      create: { name: "alimentação" },
    });
  });

  it("should include optional fields when provided", async () => {
    mockPrisma.bill.upsert.mockResolvedValueOnce({ id: "bill456", monthYear: "07-2025" });
    mockPrisma.category.upsert.mockResolvedValueOnce({ id: 5, name: "transporte" });
    mockPrisma.transaction.create.mockResolvedValueOnce({
      id: 3,
      date: new Date("2025-07-15"),
      description: "Uber",
      amount: { toString: () => "23.90" },
      cardName: "Nubank",
      installmentNumber: 1,
      totalInstallments: 3,
      transactionType: "credit_card",
      categoryId: 5,
      category: { name: "transporte" },
      billId: "bill456",
      bill: { monthYear: "07-2025" },
    });

    const request = createPostRequest({
      date: "2025-07-15",
      description: "Uber",
      amount: 23.90,
      cardName: "Nubank",
      categoryName: "Transporte",
      installmentNumber: 1,
      totalInstallments: 3,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.transaction.cardName).toBe("Nubank");
    expect(data.transaction.installmentNumber).toBe(1);
    expect(data.transaction.totalInstallments).toBe(3);
    expect(data.transaction.categoryName).toBe("transporte");
    expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cardName: "Nubank",
          installmentNumber: 1,
          totalInstallments: 3,
          categoryId: 5,
        }),
      })
    );
  });
});
