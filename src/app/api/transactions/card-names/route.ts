import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const result = await prisma.transaction.findMany({
      where: { cardName: { not: null } },
      select: { cardName: true },
      distinct: ["cardName"],
      orderBy: { cardName: "asc" },
    });

    const cardNames = result.map((r) => r.cardName as string);

    return NextResponse.json(cardNames);
  } catch (error) {
    console.error("Fetch card names error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
