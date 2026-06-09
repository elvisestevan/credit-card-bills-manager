import { describe, it, expect, beforeEach, vi } from "vitest";

const mockPrisma = {
  budgetGoal: {
    findFirst: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

describe("GET /api/budget", () => {
  let GET: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    GET = (await import("../route")).GET;
  });

  it("should return budget goal when row exists", async () => {
    mockPrisma.budgetGoal.findFirst.mockResolvedValueOnce({
      id: 1,
      amount: { toNumber: () => 15000 },
    });

    const request = new Request("http://localhost:3000/api/budget");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ amount: 15000 });
  });

  it("should auto-create with default when no row exists", async () => {
    mockPrisma.budgetGoal.findFirst.mockResolvedValueOnce(null);
    mockPrisma.budgetGoal.create.mockResolvedValueOnce({
      id: 1,
      amount: { toNumber: () => 10000 },
    });

    const request = new Request("http://localhost:3000/api/budget");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ amount: 10000 });
    expect(mockPrisma.budgetGoal.create).toHaveBeenCalledWith({
      data: { amount: 10000 },
    });
  });

  it("should handle database errors", async () => {
    mockPrisma.budgetGoal.findFirst.mockRejectedValueOnce(
      new Error("DB error")
    );

    const request = new Request("http://localhost:3000/api/budget");
    const response = await GET(request);

    expect(response.status).toBe(500);
  });
});
