import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

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
    const search = searchParams.get("search");
    const installments = searchParams.get("installments") === "true";
    const lastInstallment = searchParams.get("lastInstallment") === "true";
    const refunds = searchParams.get("refunds") === "true";
    const uncategorized = searchParams.get("uncategorized") === "true";

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

    const where: Prisma.TransactionWhereInput = { billId };

    if (search) {
      where.OR = [
        { description: { contains: search } },
        { category: { name: { contains: search } } },
      ];
    }

    if (refunds) {
      where.amount = { lt: 0 };
    }

    if (uncategorized) {
      where.categoryId = null;
    }

    let installmentIds: number[] | undefined;

    if (lastInstallment) {
      const rows = await prisma.$queryRaw<{ id: number }[]>(
        Prisma.sql`SELECT id FROM "Transaction" WHERE "billId" = ${billId} AND "installmentNumber" IS NOT NULL AND "totalInstallments" IS NOT NULL AND "installmentNumber" = "totalInstallments"`
      );
      installmentIds = rows.map((r) => r.id);
    } else if (installments) {
      const rows = await prisma.$queryRaw<{ id: number }[]>(
        Prisma.sql`SELECT id FROM "Transaction" WHERE "billId" = ${billId} AND "installmentNumber" IS NOT NULL`
      );
      installmentIds = rows.map((r) => r.id);
    }

    if (installmentIds !== undefined) {
      where.id = { in: installmentIds };
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: orderByDirection },
        include: { category: true },
      }),
      prisma.transaction.count({ where }),
    ]);

    const data = transactions.map((t) => ({
      id: t.id,
      date: t.date.toISOString().split("T")[0],
      description: t.description,
      amount: t.amount.toString(),
      cardName: t.cardName,
      installmentNumber: t.installmentNumber,
      totalInstallments: t.totalInstallments,
      categoryId: t.categoryId,
      categoryName: t.category?.name || null,
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
