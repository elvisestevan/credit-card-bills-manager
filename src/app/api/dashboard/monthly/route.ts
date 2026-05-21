import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const billId = searchParams.get("billId");

    if (!billId) {
      return NextResponse.json(
        { error: "billId query parameter is required" },
        { status: 400 }
      );
    }

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        transactions: {
          orderBy: { date: "asc" },
          include: { category: true },
        },
      },
    });

    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    const totalAmount = bill.transactions.reduce(
      (sum, t) => sum + (t.amount as Prisma.Decimal).toNumber(),
      0
    );

    let latestTxnYear = 0;
    let latestTxnMonth = 0;
    for (const t of bill.transactions) {
      const y = t.date.getFullYear();
      const m = t.date.getMonth() + 1;
      if (y > latestTxnYear || (y === latestTxnYear && m > latestTxnMonth)) {
        latestTxnYear = y;
        latestTxnMonth = m;
      }
    }

    if (latestTxnMonth === 0) {
      const [mStr, yStr] = bill.monthYear.split("-");
      latestTxnMonth = parseInt(mStr, 10);
      latestTxnYear = parseInt(yStr, 10);
    }

    const daysInMonth = new Date(latestTxnYear, latestTxnMonth, 0).getDate();

    const dailyMap = new Map<number, number>();
    for (const t of bill.transactions) {
      const txnMonth = t.date.getMonth() + 1;
      const day =
        txnMonth === latestTxnMonth && t.date.getFullYear() === latestTxnYear
          ? t.date.getDate()
          : 1;
      dailyMap.set(day, (dailyMap.get(day) || 0) + (t.amount as Prisma.Decimal).toNumber());
    }

    const sortedDays = Array.from(dailyMap.keys()).sort((a, b) => a - b);
    let runningTotal = 0;
    const dailyCumulative = sortedDays.map((day) => {
      runningTotal += dailyMap.get(day) || 0;
      return {
        date: `${latestTxnYear}-${String(latestTxnMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        runningTotal,
        dayOfMonth: day,
      };
    });

    const catMap = new Map<string, { total: number; count: number }>();
    for (const t of bill.transactions) {
      const catName = t.category?.name ?? "Uncategorized";
      const entry = catMap.get(catName) || { total: 0, count: 0 };
      entry.total += (t.amount as Prisma.Decimal).toNumber();
      entry.count += 1;
      catMap.set(catName, entry);
    }

    const categoryBreakdown = Array.from(catMap.entries()).map(([name, data]) => ({
      name,
      total: data.total,
      count: data.count,
      percentage: totalAmount > 0 ? Math.round((data.total / totalAmount) * 1000) / 10 : 0,
    }));

    const lastTransaction =
      bill.transactions.length > 0
        ? bill.transactions[bill.transactions.length - 1]
        : null;

    const BUDGET_GOAL = 10000;
    const remainingBudget = BUDGET_GOAL - totalAmount;

    return NextResponse.json({
      bill: {
        id: bill.id,
        monthYear: bill.monthYear,
        totalAmount,
        totalTransactions: bill.transactions.length,
      },
      dailyCumulative,
      categoryBreakdown,
      budgetGoal: BUDGET_GOAL,
      lastTransactionDate: lastTransaction
        ? lastTransaction.date.toISOString().split("T")[0]
        : null,
      daysInMonth,
      remainingBudget,
    });
  } catch (error) {
    console.error("Dashboard monthly error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
