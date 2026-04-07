import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const [transactions, installments] = await Promise.all([
      prisma.transaction.findMany(),
      prisma.transaction.findMany({
        where: {
          installmentNumber: {
            not: null,
          },
        },
      }),
    ]);

    const totalTransactions = transactions.length;
    const totalValue = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalInstallmentTransactions = installments.length;
    const totalInstallmentValue = installments.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );

    return NextResponse.json({
      totalTransactions,
      totalValue,
      totalInstallmentTransactions,
      totalInstallmentValue,
    });
  } catch (error) {
    console.error("Summary error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
