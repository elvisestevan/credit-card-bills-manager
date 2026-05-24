import { describe, it, expect, beforeEach, vi } from "vitest";

const mockPrisma = {
  category: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  transaction: {
    update: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

describe("PATCH /api/transactions/[id]", async () => {
  const { PATCH } = await import("../route");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update transaction category by categoryId", async () => {
    const mockCategory = { id: 5, name: "alimentacao" };
    mockPrisma.category.findUnique.mockResolvedValueOnce(mockCategory);
    mockPrisma.transaction.update.mockResolvedValueOnce({
      id: 1,
      date: new Date("2024-01-15"),
      description: "Mercado",
      amount: { toString: () => "-150" },
      categoryId: 5,
      category: mockCategory,
    });

    const request = new Request("http://localhost:3000/api/transactions/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: 5 }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.categoryId).toBe(5);
    expect(data.categoryName).toBe("alimentacao");
    expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { categoryId: 5 },
      })
    );
  });

  it("should update transaction category by categoryName (upsert)", async () => {
    const mockCategory = { id: 10, name: "transporte" };
    mockPrisma.category.upsert.mockResolvedValueOnce(mockCategory);
    mockPrisma.transaction.update.mockResolvedValueOnce({
      id: 2,
      date: new Date("2024-02-10"),
      description: "Uber",
      amount: { toString: () => "-25" },
      categoryId: 10,
      category: mockCategory,
    });

    const request = new Request("http://localhost:3000/api/transactions/2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryName: "transporte" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "2" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.categoryId).toBe(10);
    expect(data.categoryName).toBe("transporte");
    expect(mockPrisma.category.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: "transporte" },
        create: { name: "transporte" },
      })
    );
  });

  it("should clear category when categoryId is null", async () => {
    mockPrisma.transaction.update.mockResolvedValueOnce({
      id: 3,
      date: new Date("2024-03-05"),
      description: "Old categorized",
      amount: { toString: () => "-100" },
      categoryId: null,
      category: null,
    });

    const request = new Request("http://localhost:3000/api/transactions/3", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: null }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "3" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.categoryId).toBeNull();
    expect(data.categoryName).toBeUndefined();
    expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 3 },
        data: { categoryId: null },
      })
    );
  });

  it("should return 404 if categoryId not found", async () => {
    mockPrisma.category.findUnique.mockResolvedValueOnce(null);

    const request = new Request("http://localhost:3000/api/transactions/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: 999 }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Category not found");
  });

  it("should return 400 if no categoryId or categoryName provided", async () => {
    const request = new Request("http://localhost:3000/api/transactions/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("categoryId or categoryName is required");
  });
});
