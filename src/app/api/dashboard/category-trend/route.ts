import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryIdParam = searchParams.get("categoryId");

    if (!categoryIdParam) {
      return NextResponse.json(
        { error: "categoryId query parameter is required" },
        { status: 400 }
      );
    }

    const categoryId = parseInt(categoryIdParam, 10);
    if (isNaN(categoryId)) {
      return NextResponse.json(
        { error: "categoryId must be a valid integer" },
        { status: 400 }
      );
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const bills = await prisma.bill.findMany({
      include: {
        transactions: {
          where: { categoryId },
          select: { amount: true },
        },
      },
      orderBy: { monthYear: "asc" },
    });

    const trend = bills
      .filter((bill) => bill.transactions.length > 0)
      .map((bill) => {
        const total = bill.transactions.reduce(
          (sum, t) => sum + (t.amount as Prisma.Decimal).toNumber(),
          0
        );
        return {
          monthYear: bill.monthYear,
          total,
        };
      });

    return NextResponse.json({
      categoryId: category.id,
      categoryName: category.name,
      trend,
    });
  } catch (error) {
    console.error("Dashboard category trend error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
