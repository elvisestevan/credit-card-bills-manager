import { NextRequest, NextResponse } from "next/server";
import { parseCheckingAccountCsv } from "@/lib/parsers/checking-account";

function dateToMonthYear(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${m}-${y}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json({ success: false, error: "File must be a CSV" }, { status: 400 });
    }

    const content = await file.text();
    const { transactions, errors: parseErrors } = parseCheckingAccountCsv(content);

    if (parseErrors.length > 0 && transactions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to parse CSV", errors: parseErrors },
        { status: 400 }
      );
    }

    const items = transactions.map((t, index) => ({
      index,
      date: `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}-${String(t.date.getDate()).padStart(2, "0")}`,
      description: t.description,
      amount: t.amount,
      billMonthYear: dateToMonthYear(t.date),
      selected: t.amount > 0,
    }));

    return NextResponse.json({ success: true, items, errors: parseErrors });
  } catch (error) {
    console.error("Checking account preview error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
