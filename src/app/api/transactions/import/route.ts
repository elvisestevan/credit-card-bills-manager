import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseItauCsv } from "@/lib/parsers/itau";
import { Prisma } from "@/generated/prisma/client";

const BILL_MONTH_YEAR_REGEX = /^(0[1-9]|1[0-2])-\d{4}$/;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const billMonthYear = formData.get("billMonthYear") as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { success: false, error: "File must be a CSV" },
        { status: 400 }
      );
    }

    if (!billMonthYear || !BILL_MONTH_YEAR_REGEX.test(billMonthYear)) {
      return NextResponse.json(
        { success: false, error: "Invalid bill ID format. Expected MM-YYYY (e.g., 04-2026)." },
        { status: 400 }
      );
    }

    const content = await file.text();
    const { transactions, errors: parseErrors } = parseItauCsv(content);

    if (parseErrors.length > 0 && transactions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to parse CSV", errors: parseErrors },
        { status: 400 }
      );
    }

    const existingTransactions = await prisma.transaction.findMany({
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
        bill: {
          select: {
            monthYear: true,
          },
        },
      },
    });

    const existingKeys = new Map(
      existingTransactions.map((t) => [
        `${t.date.toISOString().split("T")[0]}|${t.description}|${t.amount.toString()}|${t.installmentNumber ?? "null"}|${t.totalInstallments ?? "null"}`,
        t,
      ])
    );

    const conflicts: Array<{ transaction: string; existingBill: string }> = [];

    for (const t of transactions) {
      const key = `${t.date.toISOString().split("T")[0]}|${t.description}|${t.amount}|${t.installmentNumber ?? "null"}|${t.totalInstallments ?? "null"}`;
      const existing = existingKeys.get(key);
      if (existing && existing.bill.monthYear !== billMonthYear) {
        const installmentInfo = t.installmentNumber && t.totalInstallments
          ? ` (${t.installmentNumber}/${t.totalInstallments})`
          : "";
        conflicts.push({
          transaction: `${t.description}${installmentInfo} - ${t.date.toISOString().split("T")[0]} - $${t.amount}`,
          existingBill: existing.bill.monthYear,
        });
      }
    }

    if (conflicts.length > 0) {
      return NextResponse.json(
        { success: false, error: "Conflicting transactions found in other bills", conflicts },
        { status: 400 }
      );
    }

    const bill = await prisma.bill.upsert({
      where: { monthYear: billMonthYear },
      create: { monthYear: billMonthYear },
      update: {},
    });

    const newTransactions = transactions.filter((t) => {
      const key = `${t.date.toISOString().split("T")[0]}|${t.description}|${t.amount}|${t.installmentNumber ?? "null"}|${t.totalInstallments ?? "null"}`;
      const existing = existingKeys.get(key);
      return !existing;
    });

    const skipped = transactions.length - newTransactions.length;

    if (newTransactions.length > 0) {
      await prisma.transaction.createMany({
        data: newTransactions.map((t) => ({
          date: t.date,
          description: t.description,
          amount: new Prisma.Decimal(t.amount),
          installmentNumber: t.installmentNumber,
          totalInstallments: t.totalInstallments,
          importId: crypto.randomUUID(),
          billId: bill.id,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      added: newTransactions.length,
      ignored: skipped,
      errors: parseErrors,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
