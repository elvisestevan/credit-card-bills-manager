import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) {
  try {
    const { billId } = await params;
    const { searchParams } = new URL(request.url);
    const skip = parseInt(searchParams.get("skip") ?? "0", 10);

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          billId,
          categoryId: null,
        },
        orderBy: { date: "asc" },
        skip,
        take: 1,
      }),
      prisma.transaction.count({
        where: {
          billId,
          categoryId: null,
        },
      }),
    ]);

    const transaction = transactions[0] ?? null;

    if (!transaction) {
      return NextResponse.json(
        { error: "No pending transactions found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: transaction.id,
      date: transaction.date.toISOString().split("T")[0],
      description: transaction.description,
      amount: transaction.amount.toString(),
      installmentNumber: transaction.installmentNumber,
      totalInstallments: transaction.totalInstallments,
      categoryId: transaction.categoryId,
      remaining: total - skip - 1,
    });
  } catch (error) {
    console.error("Get next transaction error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
