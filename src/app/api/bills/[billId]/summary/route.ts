import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) {
  try {
    const { billId } = await params;

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
    });

    if (!bill) {
      return NextResponse.json(
        { error: "Bill not found" },
        { status: 404 }
      );
    }

    const [transactions, installments] = await Promise.all([
      prisma.transaction.findMany({
        where: { billId },
      }),
      prisma.transaction.findMany({
        where: {
          billId,
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
    console.error("Bill summary error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
