import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ importId: string }> }
) {
  try {
    const { importId } = await params;

    const transactions = await prisma.transaction.findMany({
      where: { importId },
      select: {
        id: true,
        date: true,
        description: true,
        amount: true,
        installmentNumber: true,
        totalInstallments: true,
        billId: true,
        bill: {
          select: { monthYear: true },
        },
      },
    });

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: "Import not found" },
        { status: 404 }
      );
    }

    const descriptions = [...new Set(transactions.map((t) => t.description))];

    const suggestionGroups = await prisma.transaction.groupBy({
      by: ["description", "categoryId"],
      where: {
        description: { in: descriptions },
        categoryId: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    const topCategories = await Promise.all(
      suggestionGroups
        .filter((g) => g.categoryId !== null)
        .map(async (g) => {
          const category = await prisma.category.findUnique({
            where: { id: g.categoryId! },
          });
          return { description: g.description, categoryId: g.categoryId!, categoryName: category?.name ?? null, count: g._count.id };
        })
    );

    const bestSuggestion = new Map<string, { categoryId: number; categoryName: string }>();
    for (const s of topCategories) {
      if (!bestSuggestion.has(s.description)) {
        bestSuggestion.set(s.description, { categoryId: s.categoryId, categoryName: s.categoryName ?? "" });
      }
    }

    const enriched = transactions.map((t) => {
      const suggestion = bestSuggestion.get(t.description);
      return {
        id: t.id,
        date: t.date.toISOString().split("T")[0],
        description: t.description,
        amount: t.amount.toString(),
        installmentNumber: t.installmentNumber,
        totalInstallments: t.totalInstallments,
        suggestedCategoryId: suggestion?.categoryId ?? null,
        suggestedCategoryName: suggestion?.categoryName ?? null,
      };
    });

    return NextResponse.json({
      importId,
      billId: transactions[0].billId,
      billMonthYear: transactions[0].bill.monthYear,
      transactions: enriched,
    });
  } catch (error) {
    console.error("Fetch import error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
