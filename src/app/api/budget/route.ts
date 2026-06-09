import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export async function GET() {
  try {
    let budgetGoal = await prisma.budgetGoal.findFirst();
    if (!budgetGoal) {
      budgetGoal = await prisma.budgetGoal.create({
        data: { amount: 10000 },
      });
    }
    return NextResponse.json({ amount: (budgetGoal.amount as Prisma.Decimal).toNumber() });
  } catch (error) {
    console.error("Budget GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
