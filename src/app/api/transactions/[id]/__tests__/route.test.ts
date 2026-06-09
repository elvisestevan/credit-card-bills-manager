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
      userDescription: null,
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
      userDescription: null,
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
      userDescription: null,
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

  it("should return 200 with empty body (no changes)", async () => {
    mockPrisma.transaction.update.mockResolvedValueOnce({
      id: 1,
      date: new Date("2024-01-15"),
      description: "Mercado",
      userDescription: null,
      amount: { toString: () => "-150" },
      categoryId: null,
      category: null,
    });

    const request = new Request("http://localhost:3000/api/transactions/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: {},
      })
    );
  });

  it("should update userDescription", async () => {
    mockPrisma.transaction.update.mockResolvedValueOnce({
      id: 4,
      date: new Date("2024-04-01"),
      description: "NETFLIX",
      userDescription: "My Netflix",
      amount: { toString: () => "-39.90" },
      categoryId: null,
      category: null,
    });

    const request = new Request("http://localhost:3000/api/transactions/4", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userDescription: "My Netflix" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "4" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.userDescription).toBe("My Netflix");
    expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 4 },
        data: { userDescription: "My Netflix" },
      })
    );
  });

  it("should clear userDescription when set to null", async () => {
    mockPrisma.transaction.update.mockResolvedValueOnce({
      id: 5,
      date: new Date("2024-05-01"),
      description: "Uber",
      userDescription: null,
      amount: { toString: () => "-25" },
      categoryId: null,
      category: null,
    });

    const request = new Request("http://localhost:3000/api/transactions/5", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userDescription: null }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "5" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.userDescription).toBeNull();
  });
});
