import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionType = searchParams.get("type");
    const typeFilter = transactionType === "credit_card" || transactionType === "checking_account"
      ? { transactionType }
      : {};

    const bills = await prisma.bill.findMany({
      include: {
        transactions: {
          where: typeFilter,
          select: {
            amount: true,
            categoryId: true,
            category: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { monthYear: "asc" },
    });

    const filteredBills = bills.filter((b) => b.transactions.length > 0);

    const billsSummary = filteredBills.map((bill) => {
      const totalAmount = bill.transactions.reduce(
        (sum, t) => sum + (t.amount as Prisma.Decimal).toNumber(),
        0
      );
      return {
        id: bill.id,
        monthYear: bill.monthYear,
        totalAmount,
        totalTransactions: bill.transactions.length,
      };
    });

    const categoryBreakdown = filteredBills.map((bill) => {
      const catMap = new Map<string, { total: number; count: number }>();
      for (const t of bill.transactions) {
        const catName = t.category?.name ?? "Uncategorized";
        const entry = catMap.get(catName) || { total: 0, count: 0 };
        entry.total += (t.amount as Prisma.Decimal).toNumber();
        entry.count += 1;
        catMap.set(catName, entry);
      }
      return {
        monthYear: bill.monthYear,
        categories: Array.from(catMap.entries()).map(([name, data]) => ({
          name,
          total: data.total,
          count: data.count,
        })),
      };
    });

    const totalSpending = billsSummary.reduce((s, b) => s + b.totalAmount, 0);
    const summary = {
      totalBills: billsSummary.length,
      totalSpending,
      averageMonthly: billsSummary.length > 0 ? totalSpending / billsSummary.length : 0,
    };

    return NextResponse.json({ bills: billsSummary, categoryBreakdown, summary });
  } catch (error) {
    console.error("Dashboard global error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
