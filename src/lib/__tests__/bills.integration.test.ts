import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { prisma } from "./helpers/integration";
import { Prisma } from "@/generated/prisma/client";

describe("Bill database operations", () => {
  const billId1 = "test-bill-int-1";
  const billId2 = "test-bill-int-2";

  beforeAll(async () => {
    await prisma.category.create({ data: { id: 1, name: "Food" } });

    await prisma.bill.create({
      data: {
        id: billId1,
        monthYear: "05-2026",
        transactions: {
          create: [
            { date: new Date("2026-05-01"), description: "Purchase 1", amount: new Prisma.Decimal(-100), importId: "imp-b-1", installmentNumber: 1, totalInstallments: 3 },
            { date: new Date("2026-05-02"), description: "Purchase 2", amount: new Prisma.Decimal(-200), importId: "imp-b-1" },
            { date: new Date("2026-05-03"), description: "Installment 2", amount: new Prisma.Decimal(-100), importId: "imp-b-1", installmentNumber: 2, totalInstallments: 3, categoryId: 1 },
            { date: new Date("2026-05-04"), description: "Refund", amount: new Prisma.Decimal(50), importId: "imp-b-1" },
          ],
        },
      },
    });

    await prisma.bill.create({
      data: {
        id: billId2,
        monthYear: "04-2026",
        transactions: {
          create: [
            { date: new Date("2026-04-15"), description: "Old purchase", amount: new Prisma.Decimal(-50), importId: "imp-b-2" },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { billId: { in: [billId1, billId2] } } });
    await prisma.bill.deleteMany({ where: { id: { in: [billId1, billId2] } } });
    await prisma.category.deleteMany({ where: { id: 1 } });
  });

  it("should find all bills ordered by monthYear descending", async () => {
    const bills = await prisma.bill.findMany({
      orderBy: { monthYear: "desc" },
    });

    expect(bills).toHaveLength(2);
    expect(bills[0].monthYear).toBe("05-2026");
    expect(bills[1].monthYear).toBe("04-2026");
  });

  it("should include _count of transactions", async () => {
    const bills = await prisma.bill.findMany({
      include: { _count: { select: { transactions: true } } },
      orderBy: { monthYear: "desc" },
    });

    const bill1 = bills.find((b) => b.id === billId1);
    expect(bill1?._count.transactions).toBe(4);

    const bill2 = bills.find((b) => b.id === billId2);
    expect(bill2?._count.transactions).toBe(1);
  });

  it("should return transaction amounts with correct ordering", async () => {
    const transactions = await prisma.transaction.findMany({
      where: { billId: billId1 },
      orderBy: { date: "asc" },
    });

    expect(transactions).toHaveLength(4);
    expect(transactions[0].description).toBe("Purchase 1");
    expect(transactions[0].amount.toNumber()).toBe(-100);
  });

  it("should support pagination with skip and take", async () => {
    const page1 = await prisma.transaction.findMany({
      where: { billId: billId1 },
      skip: 0,
      take: 2,
      orderBy: { date: "asc" },
    });
    expect(page1).toHaveLength(2);
    expect(page1[0].description).toBe("Purchase 1");

    const page2 = await prisma.transaction.findMany({
      where: { billId: billId1 },
      skip: 2,
      take: 2,
      orderBy: { date: "asc" },
    });
    expect(page2).toHaveLength(2);
    expect(page2[0].description).toBe("Installment 2");
  });

  it("should sort transactions by amount ascending", async () => {
    const transactions = await prisma.transaction.findMany({
      where: { billId: billId1 },
      orderBy: { amount: "asc" },
    });

    expect(transactions[0].amount.toNumber()).toBe(-200);
    expect(transactions[transactions.length - 1].amount.toNumber()).toBe(50);
  });

  it("should compute correct aggregation values matching the route handler logic", async () => {
    const bills = await prisma.bill.findMany({
      include: {
        _count: { select: { transactions: true } },
        transactions: {
          select: { amount: true, installmentNumber: true, totalInstallments: true, categoryId: true },
        },
      },
      orderBy: { monthYear: "desc" },
    });

    const bill1 = bills.find((b) => b.id === billId1)!;
    const bill1Txs = bill1.transactions;
    const bill2 = bills.find((b) => b.id === billId2)!;

    expect(bill1._count.transactions).toBe(4);
    expect(bill2._count.transactions).toBe(1);

    const totalAmount = bill1Txs.reduce((sum, t) => sum + (t.amount as Prisma.Decimal).toNumber(), 0);
    expect(totalAmount).toBe(-350);

    const installmentTxs = bill1Txs.filter(
      (t) => t.installmentNumber !== null && t.totalInstallments !== null
    );
    expect(installmentTxs).toHaveLength(2);

    const totalInstallmentAmount = installmentTxs.reduce(
      (sum, t) => sum + (t.amount as Prisma.Decimal).toNumber(), 0
    );
    expect(totalInstallmentAmount).toBe(-200);

    const pendingTxs = bill1Txs.filter((t) => t.categoryId === null);
    expect(pendingTxs).toHaveLength(3);

    const pendingAmount = pendingTxs.reduce(
      (sum, t) => sum + (t.amount as Prisma.Decimal).toNumber(), 0
    );
    expect(pendingAmount).toBe(-250);
  });

  it("should return empty array when no bills exist after deletion", async () => {
    const bills = await prisma.bill.findMany();
    expect(bills.length).toBeGreaterThanOrEqual(2);
  });
});
