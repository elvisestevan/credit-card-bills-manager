import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { prisma } from "./helpers/integration";
import { Prisma } from "@/generated/prisma/client";

function makeKey(date: Date, description: string, amount: string, instNum: number | null, totalInst: number | null): string {
  return `${date.toISOString().split("T")[0]}|${description}|${amount}|${instNum ?? "null"}|${totalInst ?? "null"}`;
}

// Build the same type of Map used by the import route handler
async function findExistingTransactions(transactions: Array<{ date: Date; description: string; amount: string; installmentNumber: number | null; totalInstallments: number | null }>, billMonthYear: string) {
  const existing = await prisma.transaction.findMany({
    where: {
      OR: transactions.map((t) => ({
        date: t.date,
        description: t.description,
        amount: new Prisma.Decimal(t.amount),
      })),
    },
    select: {
      id: true,
      date: true,
      description: true,
      amount: true,
      installmentNumber: true,
      totalInstallments: true,
      billId: true,
      bill: { select: { monthYear: true } },
    },
  });

  const existingKeys = new Map(
    existing.map((t) => [
      `${t.date.toISOString().split("T")[0]}|${t.description}|${t.amount.toString()}|${t.installmentNumber ?? "null"}|${t.totalInstallments ?? "null"}`,
      t,
    ])
  );

  const conflicts: Array<{ transaction: string; existingBill: string }> = [];

  for (const t of transactions) {
    const key = makeKey(t.date, t.description, t.amount, t.installmentNumber, t.totalInstallments);
    const found = existingKeys.get(key);
    if (found && found.bill.monthYear !== billMonthYear) {
      const installmentInfo = t.installmentNumber && t.totalInstallments
        ? ` (${t.installmentNumber}/${t.totalInstallments})` : "";
      conflicts.push({
        transaction: `${t.description}${installmentInfo} - ${t.date.toISOString().split("T")[0]} - $${t.amount}`,
        existingBill: found.bill.monthYear,
      });
    }
  }

  const newTransactions = transactions.filter((t) => {
    const key = makeKey(t.date, t.description, t.amount, t.installmentNumber, t.totalInstallments);
    return !existingKeys.has(key);
  });

  return { existing, existingKeys, conflicts, newTransactions, skipped: transactions.length - newTransactions.length };
}

describe("Import database operations", () => {
  const billId = "test-bill-import";
  const otherBillId = "test-bill-import-other";

  beforeAll(async () => {
    await prisma.bill.create({
      data: {
        id: billId,
        monthYear: "07-2026",
      },
    });

    await prisma.bill.create({
      data: {
        id: otherBillId,
        monthYear: "06-2026",
      },
    });

    await prisma.transaction.create({
      data: {
        date: new Date("2026-07-01"),
        description: "Existing tx",
        amount: new Prisma.Decimal(-100),
        importId: "imp-import-1",
        billId,
      },
    });

    await prisma.transaction.create({
      data: {
        date: new Date("2026-06-15"),
        description: "Conflict tx",
        amount: new Prisma.Decimal(-200),
        importId: "imp-import-2",
        billId: otherBillId,
      },
    });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { billId: { in: [billId, otherBillId] } } });
    await prisma.bill.deleteMany({ where: { id: { in: [billId, otherBillId] } } });
  });

  it("should detect duplicates within the same bill", async () => {
    const newTx = { date: new Date("2026-07-01"), description: "Existing tx", amount: "-100", installmentNumber: null, totalInstallments: null };
    const result = await findExistingTransactions([newTx], "07-2026");

    expect(result.existing).toHaveLength(1);
    expect(result.conflicts).toHaveLength(0);
    expect(result.newTransactions).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });

  it("should detect conflicts when transaction exists in a different bill", async () => {
    const conflictingTx = { date: new Date("2026-06-15"), description: "Conflict tx", amount: "-200", installmentNumber: null, totalInstallments: null };
    const result = await findExistingTransactions([conflictingTx], "07-2026");

    expect(result.existing).toHaveLength(1);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].existingBill).toBe("06-2026");
    expect(result.newTransactions).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });

  it("should allow new transactions when no existing match", async () => {
    const newTx = { date: new Date("2026-07-10"), description: "Brand new", amount: "-50", installmentNumber: null, totalInstallments: null };
    const result = await findExistingTransactions([newTx], "07-2026");

    expect(result.existing).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
    expect(result.newTransactions).toHaveLength(1);
    expect(result.skipped).toBe(0);
  });

  it("should handle mixed batch: new + duplicate + conflict", async () => {
    const batch = [
      { date: new Date("2026-07-01"), description: "Existing tx", amount: "-100", installmentNumber: null, totalInstallments: null },
      { date: new Date("2026-06-15"), description: "Conflict tx", amount: "-200", installmentNumber: null, totalInstallments: null },
      { date: new Date("2026-07-20"), description: "New item", amount: "-300", installmentNumber: null, totalInstallments: null },
    ];

    const result = await findExistingTransactions(batch, "07-2026");
    expect(result.existing).toHaveLength(2);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].transaction).toContain("Conflict tx");
    expect(result.newTransactions).toHaveLength(1);
    expect(result.newTransactions[0].description).toBe("New item");
    expect(result.skipped).toBe(2);
  });

  it("should upsert a bill by monthYear", async () => {
    const upserted = await prisma.bill.upsert({
      where: { monthYear: "07-2026" },
      create: { monthYear: "07-2026" },
      update: {},
    });

    expect(upserted.monthYear).toBe("07-2026");
    expect(upserted.id).toBe(billId);
  });

  it("should create a new bill via upsert if not exists", async () => {
    const newBill = await prisma.bill.upsert({
      where: { monthYear: "99-9999" },
      create: { monthYear: "99-9999" },
      update: {},
    });

    expect(newBill.monthYear).toBe("99-9999");
    expect(newBill.id).toBeDefined();

    await prisma.bill.delete({ where: { id: newBill.id } });
  });

  it("should use createMany to insert multiple transactions", async () => {
    const tempBill = await prisma.bill.create({ data: { monthYear: "08-2026" } });

    const result = await prisma.transaction.createMany({
      data: [
        { date: new Date("2026-08-01"), description: "Bulk 1", amount: new Prisma.Decimal(-10), importId: "imp-bulk-1", billId: tempBill.id },
        { date: new Date("2026-08-02"), description: "Bulk 2", amount: new Prisma.Decimal(-20), importId: "imp-bulk-1", billId: tempBill.id },
      ],
    });

    expect(result.count).toBe(2);

    await prisma.transaction.deleteMany({ where: { billId: tempBill.id } });
    await prisma.bill.delete({ where: { id: tempBill.id } });
  });

  it("should detect duplicates with installment info", async () => {
    const installmentTx = {
      date: new Date("2026-07-01"),
      description: "Installment purchase",
      amount: "-150",
      installmentNumber: 1,
      totalInstallments: 3,
    };

    await prisma.transaction.create({
      data: {
        date: installmentTx.date,
        description: installmentTx.description,
        amount: new Prisma.Decimal(installmentTx.amount),
        importId: "imp-inst-1",
        billId,
        installmentNumber: 1,
        totalInstallments: 3,
      },
    });

    const result = await findExistingTransactions([installmentTx], "07-2026");
    expect(result.existing).toHaveLength(1);
    expect(result.skipped).toBe(1);

    // Cleanup the installment transaction we just created
    await prisma.transaction.deleteMany({ where: { importId: "imp-inst-1" } });
  });
});
