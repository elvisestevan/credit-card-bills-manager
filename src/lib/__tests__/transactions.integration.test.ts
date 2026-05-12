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

describe("Transaction filters (installments, last installment, refunds, search)", () => {
  const billId = "test-bill-fltr";

  beforeAll(async () => {
    await prisma.category.create({ data: { id: 99, name: "Test Category" } });

    await prisma.bill.create({
      data: {
        id: billId,
        monthYear: "06-2026",
        transactions: {
          create: [
            { date: new Date("2026-06-01"), description: "Regular Purchase", amount: new Prisma.Decimal(-50), importId: "imp-fltr-1" },
            { date: new Date("2026-06-02"), description: "Monthly Subscription", amount: new Prisma.Decimal(-30), importId: "imp-fltr-1" },
            { date: new Date("2026-06-03"), description: "Phone 1/4", amount: new Prisma.Decimal(-100), importId: "imp-fltr-1", installmentNumber: 1, totalInstallments: 4 },
            { date: new Date("2026-06-04"), description: "Phone 2/4", amount: new Prisma.Decimal(-100), importId: "imp-fltr-1", installmentNumber: 2, totalInstallments: 4 },
            { date: new Date("2026-06-05"), description: "Phone 3/4", amount: new Prisma.Decimal(-100), importId: "imp-fltr-1", installmentNumber: 3, totalInstallments: 4 },
            { date: new Date("2026-06-06"), description: "Phone 4/4", amount: new Prisma.Decimal(-100), importId: "imp-fltr-1", installmentNumber: 4, totalInstallments: 4 },
            { date: new Date("2026-06-07"), description: "Laptop 12/12", amount: new Prisma.Decimal(-500), importId: "imp-fltr-1", installmentNumber: 12, totalInstallments: 12 },
            { date: new Date("2026-06-08"), description: "Cashback", amount: new Prisma.Decimal(25), importId: "imp-fltr-1" },
            { date: new Date("2026-06-09"), description: "Refund Installment Last", amount: new Prisma.Decimal(50), importId: "imp-fltr-1", installmentNumber: 2, totalInstallments: 2 },
            { date: new Date("2026-06-10"), description: "Categorized Purchase", amount: new Prisma.Decimal(-200), importId: "imp-fltr-1", categoryId: 99 },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { billId } });
    await prisma.bill.deleteMany({ where: { id: billId } });
    await prisma.category.deleteMany({ where: { id: 99 } });
  });

  it("should find installment transactions via raw SQL", async () => {
    const rows = await prisma.$queryRaw<{ id: number }[]>(
      Prisma.sql`SELECT id FROM "Transaction" WHERE "billId" = ${billId} AND "installmentNumber" IS NOT NULL`
    );
    expect(rows).toHaveLength(6);
  });

  it("should find last installment transactions via raw SQL", async () => {
    const rows = await prisma.$queryRaw<{ id: number }[]>(
      Prisma.sql`SELECT id FROM "Transaction" WHERE "billId" = ${billId} AND "installmentNumber" IS NOT NULL AND "totalInstallments" IS NOT NULL AND "installmentNumber" = "totalInstallments"`
    );
    expect(rows).toHaveLength(3);
  });

  it("should combine raw SQL IDs with Prisma findMany for installment filter", async () => {
    const rows = await prisma.$queryRaw<{ id: number }[]>(
      Prisma.sql`SELECT id FROM "Transaction" WHERE "billId" = ${billId} AND "installmentNumber" IS NOT NULL`
    );
    const ids = rows.map((r) => r.id);
    const txns = await prisma.transaction.findMany({
      where: { billId, id: { in: ids } },
      orderBy: { date: "asc" },
    });
    expect(txns).toHaveLength(6);
    expect(txns.every((t) => t.installmentNumber !== null)).toBe(true);
  });

  it("should combine installment filter with refund (amount gt 0) filter", async () => {
    const rows = await prisma.$queryRaw<{ id: number }[]>(
      Prisma.sql`SELECT id FROM "Transaction" WHERE "billId" = ${billId} AND "installmentNumber" IS NOT NULL`
    );
    const ids = rows.map((r) => r.id);
    const txns = await prisma.transaction.findMany({
      where: { billId, id: { in: ids }, amount: { gt: 0 } },
    });
    expect(txns).toHaveLength(1);
    expect(txns[0].description).toBe("Refund Installment Last");
  });

  it("should combine last installment filter with refund filter", async () => {
    const rows = await prisma.$queryRaw<{ id: number }[]>(
      Prisma.sql`SELECT id FROM "Transaction" WHERE "billId" = ${billId} AND "installmentNumber" IS NOT NULL AND "totalInstallments" IS NOT NULL AND "installmentNumber" = "totalInstallments"`
    );
    const ids = rows.map((r) => r.id);
    const txns = await prisma.transaction.findMany({
      where: { billId, id: { in: ids }, amount: { gt: 0 } },
    });
    expect(txns).toHaveLength(1);
    expect(txns[0].description).toBe("Refund Installment Last");
  });

  it("should combine search with installment filter", async () => {
    const rows = await prisma.$queryRaw<{ id: number }[]>(
      Prisma.sql`SELECT id FROM "Transaction" WHERE "billId" = ${billId} AND "installmentNumber" IS NOT NULL`
    );
    const ids = rows.map((r) => r.id);
    const txns = await prisma.transaction.findMany({
      where: { billId, id: { in: ids }, description: { contains: "Phone" } },
      orderBy: { date: "asc" },
    });
    expect(txns).toHaveLength(4);
    expect(txns[0].description).toBe("Phone 1/4");
    expect(txns[3].description).toBe("Phone 4/4");
  });

  it("should return correct count when combining raw SQL IDs with Prisma count", async () => {
    const rows = await prisma.$queryRaw<{ id: number }[]>(
      Prisma.sql`SELECT id FROM "Transaction" WHERE "billId" = ${billId} AND "installmentNumber" IS NOT NULL`
    );
    const ids = rows.map((r) => r.id);
    const total = await prisma.transaction.count({
      where: { billId, id: { in: ids } },
    });
    expect(total).toBe(6);
  });

  it("should filter uncategorized transactions", async () => {
    const txns = await prisma.transaction.findMany({
      where: { billId, categoryId: null },
    });
    expect(txns).toHaveLength(9);
    expect(txns.every((t) => t.categoryId === null)).toBe(true);
  });

  it("should combine uncategorized filter with installment filter", async () => {
    const rows = await prisma.$queryRaw<{ id: number }[]>(
      Prisma.sql`SELECT id FROM "Transaction" WHERE "billId" = ${billId} AND "installmentNumber" IS NOT NULL`
    );
    const ids = rows.map((r) => r.id);
    const txns = await prisma.transaction.findMany({
      where: { billId, id: { in: ids }, categoryId: null },
    });
    expect(txns).toHaveLength(6);
    expect(txns.every((t) => t.categoryId === null)).toBe(true);
  });

  it("should combine uncategorized filter with search", async () => {
    const txns = await prisma.transaction.findMany({
      where: { billId, categoryId: null, description: { contains: "Phone" } },
      orderBy: { date: "asc" },
    });
    expect(txns).toHaveLength(4);
    expect(txns.every((t) => t.categoryId === null)).toBe(true);
  });

  it("should search by description", async () => {
    const txns = await prisma.transaction.findMany({
      where: {
        billId,
        OR: [
          { description: { contains: "Regular" } },
          { category: { name: { contains: "Regular" } } },
        ],
      },
    });
    expect(txns).toHaveLength(1);
    expect(txns[0].description).toBe("Regular Purchase");
  });

  it("should search by category name", async () => {
    const txns = await prisma.transaction.findMany({
      where: {
        billId,
        OR: [
          { description: { contains: "Test Category" } },
          { category: { name: { contains: "Test Category" } } },
        ],
      },
    });
    expect(txns).toHaveLength(1);
    expect(txns[0].description).toBe("Categorized Purchase");
  });

  it("should return no results when search text matches neither description nor category", async () => {
    const txns = await prisma.transaction.findMany({
      where: {
        billId,
        OR: [
          { description: { contains: "zzzznotfound" } },
          { category: { name: { contains: "zzzznotfound" } } },
        ],
      },
    });
    expect(txns).toHaveLength(0);
  });

  it("should return empty when raw SQL IDs array is empty", async () => {
    const txns = await prisma.transaction.findMany({
      where: { billId, id: { in: [] } },
    });
    expect(txns).toHaveLength(0);
  });
});
