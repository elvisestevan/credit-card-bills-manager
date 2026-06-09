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

    const results = await prisma.transaction.groupBy({
      by: ["userDescription"],
      where: {
        description,
        userDescription: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    if (results.length === 0) {
      return NextResponse.json({ userDescription: null, count: 0 });
    }

    return NextResponse.json({
      userDescription: results[0].userDescription,
      count: results[0]._count.id,
    });
  } catch (error) {
    console.error("User description suggestions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
