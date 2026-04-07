import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseItauCsv } from "@/lib/parsers/itau";
import { Prisma } from "@/generated/prisma/client";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "File must be a CSV" },
        { status: 400 }
      );
    }

    const content = await file.text();
    const { transactions, errors: parseErrors } = parseItauCsv(content);

    if (parseErrors.length > 0 && transactions.length === 0) {
      return NextResponse.json(
        { error: "Failed to parse CSV", errors: parseErrors },
        { status: 400 }
      );
    }

    const importId = crypto.randomUUID();

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
      existingTransactions.map((t) =>
        `${t.date.toISOString().split("T")[0]}|${t.description}|${t.amount.toString()}`
      )
    );

    const newTransactions = transactions.filter((t) => {
      const key = `${t.date.toISOString().split("T")[0]}|${t.description}|${t.amount}`;
      return !existingKeys.has(key);
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
          importId,
        })),
      });
    }

    return NextResponse.json({
      importId,
      imported: newTransactions.length,
      skipped,
      errors: parseErrors,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
