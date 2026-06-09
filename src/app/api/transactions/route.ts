import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { TransactionType } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, description, userDescription, amount, cardName, categoryName, installmentNumber, totalInstallments, transactionType } = body;

    if (!date || !description || amount === undefined || amount === null) {
      return NextResponse.json(
        { success: false, error: "date, description, and amount are required" },
        { status: 400 }
      );
    }

    const [yearStr, monthStr, dayStr] = (date as string).split(/[/-]/);
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return NextResponse.json(
        { success: false, error: "Invalid date" },
        { status: 400 }
      );
    }

    const transactionDate = new Date(year, month - 1, day);
    const monthPadded = String(month).padStart(2, "0");
    const monthYear = `${monthPadded}-${year}`;

    const bill = await prisma.bill.upsert({
      where: { monthYear },
      create: { monthYear },
      update: {},
    });

    let categoryId: number | null = null;
    if (categoryName) {
      const normalized = categoryName.trim().toLowerCase();
      const category = await prisma.category.upsert({
        where: { name: normalized },
        update: {},
        create: { name: normalized },
      });
      categoryId = category.id;
    }

    const transaction = await prisma.transaction.create({
      data: {
        date: transactionDate,
        description: description.trim(),
        userDescription: userDescription?.trim() || null,
        amount: new Prisma.Decimal(amount),
        cardName: cardName?.trim() || null,
        installmentNumber: installmentNumber != null ? parseInt(installmentNumber, 10) : null,
        totalInstallments: totalInstallments != null ? parseInt(totalInstallments, 10) : null,
        transactionType: transactionType === "checking_account" ? "checking_account" : "credit_card",
        importId: crypto.randomUUID(),
        billId: bill.id,
        categoryId,
      },
      include: { category: true, bill: true },
    });

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        date: transaction.date.toISOString().split("T")[0],
        description: transaction.description,
        userDescription: transaction.userDescription,
        amount: transaction.amount.toString(),
        cardName: transaction.cardName,
        installmentNumber: transaction.installmentNumber,
        totalInstallments: transaction.totalInstallments,
        transactionType: transaction.transactionType,
        billId: transaction.billId,
        billMonthYear: transaction.bill.monthYear,
        categoryId: transaction.categoryId,
        categoryName: transaction.category?.name || null,
      },
    });
  } catch (error) {
    console.error("Create transaction error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const sortBy = searchParams.get("sortBy") ?? "date";
    const sortOrder = searchParams.get("sortOrder") ?? "desc";
    const search = searchParams.get("search");
    const categoryId = searchParams.get("categoryId");
    const installments = searchParams.get("installments") === "true";
    const lastInstallment = searchParams.get("lastInstallment") === "true";
    const refunds = searchParams.get("refunds") === "true";
    const transactionType = searchParams.get("type");
    const cardNameFilter = searchParams.get("cardName");

    const skip = (page - 1) * limit;

    const validSortFields = ["date", "amount", "description"];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : "date";
    const orderByDirection =
      sortOrder === "asc" ? ("asc" as const) : ("desc" as const);

    const where: Prisma.TransactionWhereInput = {};

    if (search) {
      where.OR = [
        { description: { contains: search } },
        { userDescription: { contains: search } },
        { category: { name: { contains: search } } },
      ];
    }

    if (refunds) {
      where.amount = { lt: 0 };
    }

    if (transactionType === "credit_card" || transactionType === "checking_account") {
      where.transactionType = transactionType;
    }

    if (categoryId) {
      if (categoryId === "null") {
        where.categoryId = null;
      } else {
        const parsedId = parseInt(categoryId, 10);
        if (!isNaN(parsedId)) {
          where.categoryId = parsedId;
        }
      }
    }

    if (cardNameFilter) {
      where.cardName = cardNameFilter;
    }

    let installmentIds: number[] | undefined;

    if (lastInstallment) {
      const rows = await prisma.$queryRaw<{ id: number }[]>(
        Prisma.sql`SELECT id FROM "Transaction" WHERE "installmentNumber" IS NOT NULL AND "totalInstallments" IS NOT NULL AND "installmentNumber" = "totalInstallments"`
      );
      installmentIds = rows.map((r) => r.id);
    } else if (installments) {
      const rows = await prisma.$queryRaw<{ id: number }[]>(
        Prisma.sql`SELECT id FROM "Transaction" WHERE "installmentNumber" IS NOT NULL`
      );
      installmentIds = rows.map((r) => r.id);
    }

    if (installmentIds !== undefined) {
      where.id = { in: installmentIds };
    }

    const [transactions, total, summaryRows] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: orderByDirection },
        include: { category: true, bill: true },
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        select: { amount: true, installmentNumber: true, totalInstallments: true },
      }),
    ]);

    const data = transactions.map((t) => ({
      id: t.id,
      date: t.date.toISOString().split("T")[0],
      description: t.description,
      userDescription: t.userDescription,
      amount: t.amount.toString(),
      cardName: t.cardName,
      installmentNumber: t.installmentNumber,
      totalInstallments: t.totalInstallments,
      transactionType: t.transactionType as TransactionType,
      categoryId: t.categoryId,
      categoryName: t.category?.name || null,
      billId: t.billId,
      billMonthYear: t.bill.monthYear,
    }));

    const summary = {
      totalTransactions: summaryRows.length,
      totalValue: summaryRows.reduce((s, r) => s + Number(r.amount), 0),
      totalInstallmentTransactions: summaryRows.filter((r) => r.installmentNumber !== null).length,
      totalInstallmentValue: summaryRows
        .filter((r) => r.installmentNumber !== null)
        .reduce((s, r) => s + Number(r.amount), 0),
      lastInstallmentCount: summaryRows.filter(
        (r) => r.installmentNumber !== null && r.totalInstallments !== null && r.installmentNumber === r.totalInstallments
      ).length,
      lastInstallmentTotal: summaryRows
        .filter((r) => r.installmentNumber !== null && r.totalInstallments !== null && r.installmentNumber === r.totalInstallments)
        .reduce((s, r) => s + Number(r.amount), 0),
    };

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
      },
      summary,
    });
  } catch (error) {
    console.error("List transactions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
