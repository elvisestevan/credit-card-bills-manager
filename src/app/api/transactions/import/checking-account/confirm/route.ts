import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseCheckingAccountCsv } from "@/lib/parsers/checking-account";
import { Prisma } from "@/generated/prisma/client";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const selectedIndicesRaw = formData.get("selectedIndices") as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json({ success: false, error: "File must be a CSV" }, { status: 400 });
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

    const userCategoriesRaw = formData.get("userCategories") as string | null;
    let userCategories: Record<string, { categoryId: number | null; categoryName?: string }> = {};
    if (userCategoriesRaw) {
      try {
        userCategories = JSON.parse(userCategoriesRaw);
        if (typeof userCategories !== "object" || Array.isArray(userCategories)) {
          userCategories = {};
        }
      } catch {
        // Invalid JSON, ignore
      }
    }

    const content = await file.text();
    const { transactions, errors: parseErrors } = parseCheckingAccountCsv(content);

    if (parseErrors.length > 0 && transactions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to parse CSV", errors: parseErrors },
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
        id: true,
        date: true,
        description: true,
        amount: true,
        billId: true,
      },
    });

    const existingKeys = new Set(
      existingTransactions.map(
        (t) => `${t.date.toISOString().split("T")[0]}|${t.description}|${t.amount.toString()}`
      )
    );

    const newTransactions = toImport.filter((t) => {
      const key = `${t.date.toISOString().split("T")[0]}|${t.description}|${t.amount}`;
      return !existingKeys.has(key);
    });

    const skipped = toImport.length - newTransactions.length;

    const batchImportId = crypto.randomUUID();
    const billCache = new Map<string, string>();

    async function getOrCreateBill(monthYear: string): Promise<string> {
      const cached = billCache.get(monthYear);
      if (cached) return cached;
      const bill = await prisma.bill.upsert({
        where: { monthYear },
        create: { monthYear },
        update: {},
      });
      billCache.set(monthYear, bill.id);
      return bill.id;
    }

    const billMonthYears = [...new Set(newTransactions.map((t) => {
      const m = String(t.date.getMonth() + 1).padStart(2, "0");
      return `${m}-${t.date.getFullYear()}`;
    }))];

    const resolvedCategoryIds = new Map<string, number | null>();
    for (const [key, catSelection] of Object.entries(userCategories)) {
      if (catSelection.categoryName) {
        const normalizedName = catSelection.categoryName.trim().toLowerCase();
        const cat = await prisma.category.upsert({
          where: { name: normalizedName },
          update: {},
          create: { name: normalizedName },
        });
        resolvedCategoryIds.set(key, cat.id);
      } else if (catSelection.categoryId !== undefined) {
        resolvedCategoryIds.set(key, catSelection.categoryId);
      }
    }

    const groupedByBill = new Map<string, typeof newTransactions>();
    for (const t of newTransactions) {
      const m = String(t.date.getMonth() + 1).padStart(2, "0");
      const my = `${m}-${t.date.getFullYear()}`;
      const group = groupedByBill.get(my) || [];
      group.push(t);
      groupedByBill.set(my, group);
    }

    let totalAdded = 0;
    const createdBillIds: string[] = [];

    for (const [monthYear, txns] of groupedByBill) {
      const billId = await getOrCreateBill(monthYear);
      createdBillIds.push(billId);
      await prisma.transaction.createMany({
        data: txns.map((t) => {
          const key = `${t.date.toISOString().split("T")[0]}|${t.description}|${t.amount}`;
          return {
            date: t.date,
            description: t.description,
            userDescription: userDescriptions[key]?.trim() || null,
            categoryId: resolvedCategoryIds.get(key) ?? null,
            amount: new Prisma.Decimal(t.amount),
            transactionType: "checking_account",
            importId: batchImportId,
            billId,
          };
        }),
      });
      totalAdded += txns.length;
    }

    return NextResponse.json({
      success: true,
      added: totalAdded,
      ignored: skipped,
      errors: parseErrors,
      importId: batchImportId,
      billIds: createdBillIds,
      billMonthYears,
    });
  } catch (error) {
    console.error("Checking account import confirm error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
