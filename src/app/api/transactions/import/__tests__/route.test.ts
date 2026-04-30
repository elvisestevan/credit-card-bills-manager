import { describe, it, expect, beforeEach, vi } from "vitest";

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
});
