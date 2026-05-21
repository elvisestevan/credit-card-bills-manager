import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export async function GET() {
  try {
    const bills = await prisma.bill.findMany({
      include: {
        transactions: {
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

    const billsSummary = bills.map((bill) => {
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

    const categoryBreakdown = bills.map((bill) => {
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
      totalBills: bills.length,
      totalSpending,
      averageMonthly: bills.length > 0 ? totalSpending / bills.length : 0,
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
