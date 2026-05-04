import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) {
  try {
    const { billId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const sortBy = searchParams.get("sortBy") ?? "date";
    const sortOrder = searchParams.get("sortOrder") ?? "desc";

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
    });

    if (!bill) {
      return NextResponse.json(
        { error: "Bill not found" },
        { status: 404 }
      );
    }

    const skip = (page - 1) * limit;

    const validSortFields = ["date", "amount", "description"];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : "date";
    const orderByDirection =
      sortOrder === "asc" ? ("asc" as const) : ("desc" as const);

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { billId },
        skip,
        take: limit,
        orderBy: { [orderByField]: orderByDirection },
      }),
      prisma.transaction.count({
        where: { billId },
      }),
    ]);

    const data = transactions.map((t) => ({
      id: t.id,
      date: t.date.toISOString().split("T")[0],
      description: t.description,
      amount: t.amount.toString(),
      cardName: t.cardName,
      installmentNumber: t.installmentNumber,
      totalInstallments: t.totalInstallments,
    }));

    return NextResponse.json({
      bill: {
        id: bill.id,
        monthYear: bill.monthYear,
      },
      data,
      pagination: {
        page,
        limit,
        total,
      },
    });
  } catch (error) {
    console.error("Get bill transactions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
