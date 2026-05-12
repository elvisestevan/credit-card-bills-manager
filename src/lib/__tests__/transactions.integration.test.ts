import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { prisma } from "./helpers/integration";
import { Prisma } from "@/generated/prisma/client";

describe("Transaction database operations", () => {
  const billId = "test-bill-tx";

  beforeAll(async () => {
    await prisma.bill.create({
      data: {
        id: billId,
        monthYear: "03-2026",
        transactions: {
          create: [
            { date: new Date("2026-03-01"), description: "Apple", amount: new Prisma.Decimal(-100), importId: "imp-tx-1" },
            { date: new Date("2026-03-02"), description: "Banana", amount: new Prisma.Decimal(-200), importId: "imp-tx-1" },
            { date: new Date("2026-03-03"), description: "Cherry", amount: new Prisma.Decimal(-300), importId: "imp-tx-1" },
            { date: new Date("2026-03-04"), description: "Date", amount: new Prisma.Decimal(-50), importId: "imp-tx-1", cardName: "Itau" },
            { date: new Date("2026-03-05"), description: "Elderberry", amount: new Prisma.Decimal(100), importId: "imp-tx-1" },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { billId } });
    await prisma.bill.deleteMany({ where: { id: billId } });
  });

  it("should count transactions with where clause", async () => {
    const total = await prisma.transaction.count({ where: { billId } });
    expect(total).toBe(5);
  });

  it("should filter transactions by amount (negative values = purchases)", async () => {
    const purchases = await prisma.transaction.findMany({
      where: { billId, amount: { lt: 0 } },
    });
    expect(purchases).toHaveLength(4);
  });

  it("should filter transactions by amount (positive = refunds)", async () => {
    const refunds = await prisma.transaction.findMany({
      where: { billId, amount: { gt: 0 } },
    });
    expect(refunds).toHaveLength(1);
    expect(refunds[0].description).toBe("Elderberry");
  });

  it("should sort by date ascending", async () => {
    const txns = await prisma.transaction.findMany({
      where: { billId },
      orderBy: { date: "asc" },
    });

    expect(txns[0].description).toBe("Apple");
    expect(txns[txns.length - 1].description).toBe("Elderberry");
  });

  it("should sort by date descending", async () => {
    const txns = await prisma.transaction.findMany({
      where: { billId },
      orderBy: { date: "desc" },
    });

    expect(txns[0].description).toBe("Elderberry");
    expect(txns[txns.length - 1].description).toBe("Apple");
  });

  it("should sort by amount ascending", async () => {
    const txns = await prisma.transaction.findMany({
      where: { billId },
      orderBy: { amount: "asc" },
    });

    expect(txns[0].amount.toNumber()).toBe(-300);
    expect(txns[txns.length - 1].amount.toNumber()).toBe(100);
  });

  it("should sort by amount descending", async () => {
    const txns = await prisma.transaction.findMany({
      where: { billId },
      orderBy: { amount: "desc" },
    });

    expect(txns[0].amount.toNumber()).toBe(100);
    expect(txns[txns.length - 1].amount.toNumber()).toBe(-300);
  });

  it("should sort by description alphabetically", async () => {
    const txns = await prisma.transaction.findMany({
      where: { billId },
      orderBy: { description: "asc" },
    });

    expect(txns[0].description).toBe("Apple");
    expect(txns[1].description).toBe("Banana");
    expect(txns[2].description).toBe("Cherry");
    expect(txns[3].description).toBe("Date");
    expect(txns[4].description).toBe("Elderberry");
  });

  it("should paginate with skip and take", async () => {
    const page1 = await prisma.transaction.findMany({
      where: { billId },
      skip: 0,
      take: 2,
      orderBy: { date: "asc" },
    });
    expect(page1).toHaveLength(2);
    expect(page1[0].description).toBe("Apple");

    const page2 = await prisma.transaction.findMany({
      where: { billId },
      skip: 2,
      take: 2,
      orderBy: { date: "asc" },
    });
    expect(page2).toHaveLength(2);
    expect(page2[0].description).toBe("Cherry");

    const page3 = await prisma.transaction.findMany({
      where: { billId },
      skip: 4,
      take: 2,
      orderBy: { date: "asc" },
    });
    expect(page3).toHaveLength(1);
    expect(page3[0].description).toBe("Elderberry");
  });

  it("should filter by cardName", async () => {
    const txns = await prisma.transaction.findMany({
      where: { billId, cardName: "Itau" },
    });
    expect(txns).toHaveLength(1);
    expect(txns[0].description).toBe("Date");
  });

  it("should search description with contains", async () => {
    const txns = await prisma.transaction.findMany({
      where: { billId, description: { contains: "lderberry" } },
    });
    expect(txns).toHaveLength(1);
    expect(txns[0].description).toBe("Elderberry");
  });

  it("should return correct amount types (Decimal with toString and toNumber)", async () => {
    const txns = await prisma.transaction.findMany({
      where: { billId },
      take: 1,
    });

    const t = txns[0];
    expect(typeof t.amount.toString()).toBe("string");
    expect(typeof t.amount.toNumber()).toBe("number");
    expect(t.amount.toString()).toBe(String(t.amount.toNumber()));
  });

  it("should handle date as Date object", async () => {
    const txns = await prisma.transaction.findMany({
      where: { billId },
      orderBy: { date: "asc" },
      take: 1,
    });

    expect(txns[0].date).toBeInstanceOf(Date);
    expect(txns[0].date.toISOString().split("T")[0]).toBe("2026-03-01");
  });
});
