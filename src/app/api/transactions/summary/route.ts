import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const [transactions, installments, lastInstallments] = await Promise.all([
      prisma.transaction.findMany(),
      prisma.transaction.findMany({
        where: {
          installmentNumber: {
            not: null,
          },
        },
      }),
      prisma.transaction.findMany({
        where: {
          installmentNumber: {
            not: null,
          },
          totalInstallments: {
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
    const lastInstallmentTransactions = lastInstallments.filter(
      (t) => t.installmentNumber === t.totalInstallments
    );
    const lastInstallmentCount = lastInstallmentTransactions.length;
    const lastInstallmentTotal = lastInstallmentTransactions.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );

    return NextResponse.json({
      totalTransactions,
      totalValue,
      totalInstallmentTransactions,
      totalInstallmentValue,
      lastInstallmentCount,
      lastInstallmentTotal,
    });
  } catch (error) {
    console.error("Summary error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
