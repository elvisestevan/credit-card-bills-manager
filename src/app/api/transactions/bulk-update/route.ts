import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, categoryId, categoryName, transactionIds } = body;

    if (!description && !transactionIds) {
      return NextResponse.json(
        { error: "Description or transactionIds is required" },
        { status: 400 }
      );
    }

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

    let idsToUpdate: number[];

    if (transactionIds && Array.isArray(transactionIds)) {
      idsToUpdate = transactionIds;
    } else {
      const matchingTransactions = await prisma.transaction.findMany({
        where: {
          categoryId: null,
        },
        select: { id: true, description: true },
      });

      idsToUpdate = matchingTransactions
        .filter(t => t.description.toLowerCase() === description.toLowerCase())
        .map(t => t.id);
    }

    const result = await prisma.transaction.updateMany({
      where: {
        id: { in: idsToUpdate },
        categoryId: null,
      },
      data: { categoryId: finalCategoryId },
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
    });
    } catch (error: unknown) {
      console.error("Bulk update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
