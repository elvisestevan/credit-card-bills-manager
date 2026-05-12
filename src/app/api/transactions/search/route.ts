import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const description = searchParams.get("description");
    const categoryId = searchParams.get("categoryId");

    if (!description) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    const where = {
      description: { contains: description },
    } as {
      description: { contains: string };
      categoryId?: number | null;
    };

    if (categoryId === "null") {
      where.categoryId = null;
    } else if (categoryId) {
      where.categoryId = parseInt(categoryId, 10);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        id: true,
        description: true,
        date: true,
        amount: true,
        installmentNumber: true,
        totalInstallments: true,
        category: { select: { name: true } },
      },
    });

    const normalizedDescription = description.toLowerCase();
    const matching = transactions.filter(
      t => t.description.toLowerCase() === normalizedDescription
    );

    return NextResponse.json(matching);
  } catch (error) {
    console.error("Search transactions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
