import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { categoryId, categoryName } = body;

    let finalCategoryId: number;

    if (categoryName) {
      const normalizedName = categoryName.trim().toLowerCase();

      const category = await prisma.category.upsert({
        where: { name: normalizedName },
        update: {},
        create: { name: normalizedName },
      });

      finalCategoryId = category.id;
    } else if (categoryId) {
      const existingCategory = await prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!existingCategory) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 404 }
        );
      }

      finalCategoryId = categoryId;
    } else {
      return NextResponse.json(
        { error: "categoryId or categoryName is required" },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.update({
      where: { id: parseInt(id, 10) },
      data: { categoryId: finalCategoryId },
      include: { category: true },
    });

    return NextResponse.json({
      id: transaction.id,
      date: transaction.date.toISOString().split("T")[0],
      description: transaction.description,
      amount: transaction.amount.toString(),
      categoryId: transaction.categoryId,
      categoryName: transaction.category?.name,
    });
    } catch (error: unknown) {
      console.error("Update transaction error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
