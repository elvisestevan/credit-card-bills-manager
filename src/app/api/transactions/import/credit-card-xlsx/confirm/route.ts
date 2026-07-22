import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseItauXlsx } from "@/lib/parsers/itau-xlsx";
import { Prisma } from "@/generated/prisma/client";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const selectedIndicesRaw = formData.get("selectedIndices") as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json({ success: false, error: "File must be an XLSX" }, { status: 400 });
    }

    if (!selectedIndicesRaw) {
      return NextResponse.json({ success: false, error: "No selected indices provided" }, { status: 400 });
    }

    let selectedIndices: number[];
    try {
      selectedIndices = JSON.parse(selectedIndicesRaw);
      if (!Array.isArray(selectedIndices) || selectedIndices.length === 0) {
        throw new Error("Invalid selection");
      }
    } catch {
      return NextResponse.json({ success: false, error: "Invalid selectedIndices format" }, { status: 400 });
    }

    const userDescriptionsRaw = formData.get("userDescriptions") as string | null;
    let userDescriptions: Record<string, string> = {};
    if (userDescriptionsRaw) {
      try {
        userDescriptions = JSON.parse(userDescriptionsRaw);
        if (typeof userDescriptions !== "object" || Array.isArray(userDescriptions)) {
          userDescriptions = {};
        }
      } catch {
        // Invalid JSON, ignore
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { transactions, errors: parseErrors, billMonthYear, cardName } = parseItauXlsx(buffer);

    if (parseErrors.length > 0 && transactions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to parse XLSX", errors: parseErrors },
        { status: 400 }
      );
    }

    const toImport = selectedIndices
      .filter((i) => i >= 0 && i < transactions.length)
      .map((i) => transactions[i]);

    if (toImport.length === 0) {
      return NextResponse.json({ success: false, error: "No valid transactions selected" }, { status: 400 });
    }

    const existingTransactions = await prisma.transaction.findMany({
      where: {
        OR: toImport.map((t) => ({
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

    const newTransactions = toImport.filter((t) => {
      const dateStr = `${t.date.getUTCFullYear()}-${String(t.date.getUTCMonth() + 1).padStart(2, "0")}-${String(t.date.getUTCDate()).padStart(2, "0")}`;
      const key = `${dateStr}|${t.description}|${t.amount}`;
      return !existingKeys.has(key);
    });

    const skipped = toImport.length - newTransactions.length;
    const batchImportId = crypto.randomUUID();

    const bill = await prisma.bill.upsert({
      where: { monthYear: billMonthYear },
      create: { monthYear: billMonthYear },
      update: {},
    });

    await prisma.transaction.createMany({
      data: newTransactions.map((t) => {
        const dateStr = `${t.date.getUTCFullYear()}-${String(t.date.getUTCMonth() + 1).padStart(2, "0")}-${String(t.date.getUTCDate()).padStart(2, "0")}`;
        const key = `${dateStr}|${t.description}|${t.amount}`;
        return {
          date: t.date,
          description: t.description,
          userDescription: userDescriptions[key]?.trim() || null,
          amount: new Prisma.Decimal(t.amount),
          installmentNumber: t.installmentNumber,
          totalInstallments: t.totalInstallments,
          cardName,
          transactionType: "credit_card",
          importId: batchImportId,
          source: "import",
          billId: bill.id,
        };
      }),
    });

    return NextResponse.json({
      success: true,
      added: newTransactions.length,
      ignored: skipped,
      errors: parseErrors,
      importId: batchImportId,
      billId: bill.id,
      billMonthYear,
    });
  } catch (error) {
    console.error("Credit card XLSX import confirm error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
