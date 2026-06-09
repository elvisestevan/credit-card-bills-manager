import { describe, it, expect, beforeEach, vi } from "vitest";

const mockPrisma = {
  transaction: {
    groupBy: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

describe("GET /api/transactions/user-description-suggestions", async () => {
  const { GET } = await import("../route");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return most common userDescription for a description", async () => {
    mockPrisma.transaction.groupBy.mockResolvedValueOnce([
      { userDescription: "Netflix", _count: { id: 5 } },
      { userDescription: "Streaming", _count: { id: 2 } },
    ]);

    const request = new Request("http://localhost:3000/api/transactions/user-description-suggestions?description=NETFLIX");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ userDescription: "Netflix", count: 5 });
  });

  it("should return null when no suggestions exist", async () => {
    mockPrisma.transaction.groupBy.mockResolvedValueOnce([]);

    const request = new Request("http://localhost:3000/api/transactions/user-description-suggestions?description=UNKNOWN");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ userDescription: null, count: 0 });
  });

  it("should return 400 when description param is missing", async () => {
    const request = new Request("http://localhost:3000/api/transactions/user-description-suggestions");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("description query parameter is required");
  });
});
