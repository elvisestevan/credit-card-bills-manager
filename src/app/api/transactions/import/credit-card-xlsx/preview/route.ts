import { NextRequest, NextResponse } from "next/server";
import { parseItauXlsx } from "@/lib/parsers/itau-xlsx";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json({ success: false, error: "File must be an XLSX" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { transactions, errors: parseErrors, billMonthYear, cardName } = parseItauXlsx(buffer);

    if (parseErrors.length > 0 && transactions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to parse XLSX", errors: parseErrors },
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
        date: true,
        description: true,
        amount: true,
      },
    });

    const existingKeys = new Set(
      existingTransactions.map(
        (t) => `${t.date.toISOString().split("T")[0]}|${t.description}|${t.amount.toString()}`
      )
    );

    const items = transactions.map((t, index) => {
      const dateStr = `${t.date.getUTCFullYear()}-${String(t.date.getUTCMonth() + 1).padStart(2, "0")}-${String(t.date.getUTCDate()).padStart(2, "0")}`;
      const key = `${dateStr}|${t.description}|${t.amount}`;
      const exists = existingKeys.has(key);
      return {
        index,
        date: dateStr,
        description: t.description,
        amount: t.amount,
        installmentNumber: t.installmentNumber,
        totalInstallments: t.totalInstallments,
        billMonthYear,
        selected: t.amount > 0 && !exists,
        exists,
      };
    });

    return NextResponse.json({
      success: true,
      billMonthYear,
      cardName,
      items,
      errors: parseErrors,
    });
  } catch (error) {
    console.error("Credit card XLSX preview error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
