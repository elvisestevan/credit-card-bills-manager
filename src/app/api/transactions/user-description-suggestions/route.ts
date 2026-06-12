import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const description = searchParams.get("description");

    if (!description) {
      return NextResponse.json(
        { error: "description query parameter is required" },
        { status: 400 }
      );
    }

    const [userDescriptionResults, categoryResults] = await Promise.all([
      prisma.transaction.groupBy({
        by: ["userDescription"],
        where: {
          description,
          userDescription: { not: null },
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.transaction.findMany({
        where: {
          description,
          categoryId: { not: null },
        },
        include: { category: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      }),
    ]);

    const userDescription =
      userDescriptionResults.length > 0
        ? userDescriptionResults[0].userDescription
        : null;
    const categoryName =
      categoryResults.length > 0 ? categoryResults[0].category!.name : null;

    return NextResponse.json({
      userDescription,
      categoryName,
    });
  } catch (error) {
    console.error("User description suggestions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
