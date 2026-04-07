import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const sortBy = searchParams.get("sortBy") ?? "date";
    const sortOrder = searchParams.get("sortOrder") ?? "desc";

    const skip = (page - 1) * limit;

    const validSortFields = ["date", "amount", "description"];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : "date";
    const orderByDirection =
      sortOrder === "asc" ? ("asc" as const) : ("desc" as const);

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        skip,
        take: limit,
        orderBy: { [orderByField]: orderByDirection },
      }),
      prisma.transaction.count(),
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
      data,
      pagination: {
        page,
        limit,
        total,
      },
    });
  } catch (error) {
    console.error("List transactions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
