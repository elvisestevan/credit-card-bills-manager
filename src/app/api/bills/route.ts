import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export async function GET() {
  try {
    const bills = await prisma.bill.findMany({
      include: {
        _count: {
          select: { transactions: true },
        },
        transactions: {
          select: {
            amount: true,
            installmentNumber: true,
            totalInstallments: true,
          },
        },
      },
      orderBy: {
        monthYear: "desc",
      },
    });

    const result = bills.map((bill) => {
      const totalAmount = bill.transactions.reduce(
        (sum, t) => sum + (t.amount as Prisma.Decimal).toNumber(),
        0
      );

      const installmentTransactions = bill.transactions.filter(
        (t) => t.installmentNumber !== null && t.totalInstallments !== null
      );

      const totalInstallmentAmount = installmentTransactions.reduce(
        (sum, t) => sum + (t.amount as Prisma.Decimal).toNumber(),
        0
      );

      return {
        id: bill.id,
        monthYear: bill.monthYear,
        totalTransactions: bill._count.transactions,
        totalAmount,
        totalInstallmentTransactions: installmentTransactions.length,
        totalInstallmentAmount,
        lastUpdated: bill.updatedAt.toISOString(),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("List bills error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
