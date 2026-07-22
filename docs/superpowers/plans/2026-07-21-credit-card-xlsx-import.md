# Credit Card XLSX Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add XLSX import support for Itaú credit card billing statements with a two-step preview/confirm flow.

**Architecture:** New parser (`itau-xlsx.ts`) reads Itaú XLSX billing statements via SheetJS. New API routes (`/preview` and `/confirm`) follow the checking account two-step pattern. New component (`CreditCardXlsxImport.tsx`) provides upload → preview table → confirm UI. Integrated into existing add transaction page via dropdown.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma (SQLite), xlsx (SheetJS), Vitest, @testing-library/react

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/types/index.ts` | Modify | Add `ItauXlsxTransaction`, `CreditCardXlsxPreviewItem` types |
| `src/lib/parsers/itau-xlsx.ts` | Create | XLSX parser for Itaú billing statements |
| `src/lib/parsers/__tests__/itau-xlsx.test.ts` | Create | Parser unit tests |
| `src/app/api/transactions/import/credit-card-xlsx/preview/route.ts` | Create | Preview API endpoint |
| `src/app/api/transactions/import/credit-card-xlsx/preview/__tests__/route.test.ts` | Create | Preview API tests |
| `src/app/api/transactions/import/credit-card-xlsx/confirm/route.ts` | Create | Confirm API endpoint |
| `src/app/api/transactions/import/credit-card-xlsx/confirm/__tests__/route.test.ts` | Create | Confirm API tests |
| `src/components/CreditCardXlsxImport.tsx` | Create | Upload + preview + confirm component |
| `src/components/__tests__/CreditCardXlsxImport.test.tsx` | Create | Component tests |
| `src/app/transactions/add/page.tsx` | Modify | Add "Credit Card XLSX" dropdown option |

---

### Task 1: Install xlsx dependency

- [ ] **Step 1: Install SheetJS**

```bash
bun add xlsx
```

- [ ] **Step 2: Verify installation**

```bash
bun run node -e "const XLSX = require('xlsx'); console.log('xlsx version:', XLSX.version)"
```

Expected: prints xlsx version number

---

### Task 2: Add types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add ItauXlsxTransaction and CreditCardXlsxPreviewItem types**

Add these after the `CheckingAccountPreviewItem` type (line 120):

```typescript
export interface ItauXlsxTransaction {
  date: Date;
  description: string;
  amount: number;
  installmentNumber: number | null;
  totalInstallments: number | null;
}

export interface CreditCardXlsxPreviewItem {
  index: number;
  date: string;
  description: string;
  amount: number;
  installmentNumber: number | null;
  totalInstallments: number | null;
  billMonthYear: string;
  selected: boolean;
  exists: boolean;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun --bun run build --no-lint 2>&1 | head -20
```

Expected: no type errors related to the new types (build may fail for other reasons in dev, that's fine)

---

### Task 3: Implement parser

**Files:**
- Create: `src/lib/parsers/itau-xlsx.ts`
- Create: `src/lib/parsers/__tests__/itau-xlsx.test.ts`

- [ ] **Step 1: Create the parser**

```typescript
// src/lib/parsers/itau-xlsx.ts
import type { ItauXlsxTransaction } from "@/types";

const INSTALLMENT_REGEX = /Parcela (\d+) de (\d+)/;

function excelSerialToDate(serial: number): Date {
  // Excel epoch: 1900-01-01 is serial 1
  // JavaScript epoch: 1970-01-01 is 0
  // Excel treats 1900 as a leap year (bug), so subtract 2 days for dates after Feb 28 1900
  const utcDays = Math.floor(serial - 25569);
  const utcMs = utcDays * 86400 * 1000;
  return new Date(utcMs);
}

function monthNameToNumber(name: string): string | null {
  const months: Record<string, string> = {
    janeiro: "01", fevereiro: "02", março: "03", marco: "03",
    abril: "04", maio: "05", junho: "06", julho: "07",
    agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
  };
  return months[name.toLowerCase()] ?? null;
}

function getCellValue(row: Record<string, unknown>, col: string): string {
  const val = row[col];
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

export function parseItauXlsx(buffer: Buffer): {
  transactions: ItauXlsxTransaction[];
  errors: string[];
  billMonthYear: string;
  cardName: string;
} {
  const XLSX = require("xlsx");
  const errors: string[] = [];
  const transactions: ItauXlsxTransaction[] = [];
  let billMonthYear = "";
  let cardName = "";

  let workbook: any;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    errors.push("Invalid XLSX file");
    return { transactions, errors, billMonthYear, cardName };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    errors.push("XLSX file has no sheets");
    return { transactions, errors, billMonthYear, cardName };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (rows.length < 14) {
    errors.push("XLSX file is too short or has no transaction data");
    return { transactions, errors, billMonthYear, cardName };
  }

  // Extract metadata from rows 1-13 (0-indexed: 0-12)
  for (let i = 0; i < Math.min(13, rows.length); i++) {
    const row = rows[i];
    const values = Array.isArray(row) ? row : Object.values(row);
    const rowStr = values.join(" ");

    // Card name: row containing "Cartão" or "Cartao"
    if (rowStr.includes("Cartão") || rowStr.includes("Cartao")) {
      const nameVal = values.find((v: unknown) =>
        typeof v === "string" && v.length > 10 && !v.includes("Cartão") && !v.includes("Cartao") && !v.includes("Valor")
      );
      if (nameVal) cardName = String(nameVal).trim();
    }

    // Bill month: "Fatura Aberta - Mês/AAAA" or "Fatura Aberta - Mes/AAAA"
    if (typeof rowStr === "string" && rowStr.includes("Fatura Aberta")) {
      const match = rowStr.match(/(\w+)\/(\d{4})/);
      if (match) {
        const monthNum = monthNameToNumber(match[1]);
        if (monthNum) {
          billMonthYear = `${monthNum}-${match[2]}`;
        }
      }
    }
  }

  // Find header row: contains "Data" and "Lançamento" and "Valor"
  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const values = Array.isArray(row) ? row : Object.values(row).map((_, idx) => (row as any)[`F${idx + 1}`] ?? Object.values(row)[idx]);
    const cellValues = values.map((v: unknown) => String(v ?? "").trim().toLowerCase());
    if (cellValues.includes("data") && cellValues.includes("lançamento") && cellValues.includes("valor")) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    errors.push("Could not find header row (expected: Data, Lançamento, Valor)");
    return { transactions, errors, billMonthYear, cardName };
  }

  // Parse transaction rows after header
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const values = Array.isArray(row) ? row : Object.values(row);

    // Stop at empty rows or "Subtotal"
    const rowStr = values.join(" ").trim();
    if (!rowStr || rowStr.includes("Subtotal") || rowStr.includes("Importante saber")) {
      break;
    }

    // Map to columns: B=date(0), C=description(1), D=installment(2), E=amount(3)
    const dateVal = values[0];
    const description = getCellValue(row as any, "C") || String(values[1] ?? "").trim();
    const installmentStr = getCellValue(row as any, "D") || String(values[2] ?? "").trim();
    const amountVal = values[3] ?? values[4];

    if (!description || description === "Lançamento") continue;

    // Skip payment rows
    if (description === "Pagamento Efetuado") continue;

    // Parse date (Excel serial number)
    let date: Date;
    const serial = typeof dateVal === "number" ? dateVal : parseFloat(String(dateVal));
    if (isNaN(serial) || serial < 1) {
      errors.push(`Row ${i + 1}: Invalid date serial "${dateVal}"`);
      continue;
    }
    date = excelSerialToDate(serial);
    if (isNaN(date.getTime())) {
      errors.push(`Row ${i + 1}: Invalid date from serial "${dateVal}"`);
      continue;
    }

    // Parse amount
    const amount = parseFloat(String(amountVal));
    if (isNaN(amount)) {
      errors.push(`Row ${i + 1}: Invalid amount "${amountVal}"`);
      continue;
    }

    // Parse installment
    let installmentNumber: number | null = null;
    let totalInstallments: number | null = null;
    if (installmentStr) {
      const match = installmentStr.match(INSTALLMENT_REGEX);
      if (match) {
        installmentNumber = parseInt(match[1], 10);
        totalInstallments = parseInt(match[2], 10);
      }
    }

    transactions.push({
      date,
      description,
      amount,
      installmentNumber,
      totalInstallments,
    });
  }

  return { transactions, errors, billMonthYear, cardName };
}
```

- [ ] **Step 2: Run parser with the real XLSX file to validate**

```bash
bun --bun run node -e "
const fs = require('fs');
const { parseItauXlsx } = require('./src/lib/parsers/itau-xlsx');
const buf = fs.readFileSync('/home/elvis/Downloads/fatura-aberta-final 6283-agosto2026.xlsx');
const result = parseItauXlsx(buf);
console.log('Transactions:', result.transactions.length);
console.log('Bill:', result.billMonthYear);
console.log('Card:', result.cardName);
console.log('Errors:', result.errors);
const total = result.transactions.reduce((s, t) => s + t.amount, 0);
console.log('Total:', total.toFixed(2));
"
```

Expected:
- Transactions: 28
- Bill: 08-2026
- Card: Itaú Personnalite Black Pontos Mastercard - final 6283
- Errors: []
- Total: 2617.66

- [ ] **Step 3: Create parser tests**

```typescript
// src/lib/parsers/__tests__/itau-xlsx.test.ts
import { describe, it, expect } from "vitest";
import { parseItauXlsx } from "../itau-xlsx";
import * as XLSX from "xlsx";

function createXlsxBuffer(rows: (string | number | null)[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function createItauXlsx(transactions: { date: number; desc: string; installment: string; amount: number }[]): Buffer {
  const rows: (string | number | null)[][] = [
    [null, null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null, null],
    [null, "Nome", "Elvis Test"],
    [null, "Agência", "1234"],
    [null, "Conta", "12345-6"],
    [null, null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null, null],
    [null, "Fatura Aberta - Agosto/2026"],
    [null, null, null, null, null, null, null, null, null, null],
    [null, "Cartão", null, null, null, null, "Valor (parcial)", null, "Vencimento", null],
    [null, "Itaú Personnalite Black Pontos Mastercard - final 6283", null, null, null, null, 2617.66, null, 46240, null],
    [null, null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null, null],
    [null, "Lançamentos"],
    [null, "Data", "Lançamento", "Parcelamento", "Valor", null, "Titularidade", "Nome", "Tipo do cartão", "Número do cartão"],
  ];

  for (const t of transactions) {
    rows.push([null, t.date, t.desc, t.installment, t.amount]);
  }

  return createXlsxBuffer(rows);
}

describe("parseItauXlsx", () => {
  it("should parse valid XLSX with transactions", () => {
    const buffer = createItauXlsx([
      { date: 46209, desc: "Test Store", installment: "", amount: 100 },
      { date: 46218, desc: "Another Store", installment: "Parcela 2 de 3", amount: 50 },
    ]);
    const result = parseItauXlsx(buffer);
    expect(result.errors).toHaveLength(0);
    expect(result.transactions).toHaveLength(2);
    expect(result.billMonthYear).toBe("08-2026");
    expect(result.cardName).toContain("final 6283");
  });

  it("should convert Excel serial dates correctly", () => {
    const buffer = createItauXlsx([
      { date: 46209, desc: "Test", installment: "", amount: 10 },
    ]);
    const result = parseItauXlsx(buffer);
    expect(result.errors).toHaveLength(0);
    const d = result.transactions[0].date;
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(6); // July = 6
    expect(d.getUTCDate()).toBe(15);
  });

  it("should parse installment info from Parcelamento column", () => {
    const buffer = createItauXlsx([
      { date: 46209, desc: "Test", installment: "Parcela 3 de 4", amount: 100 },
    ]);
    const result = parseItauXlsx(buffer);
    expect(result.transactions[0].installmentNumber).toBe(3);
    expect(result.transactions[0].totalInstallments).toBe(4);
  });

  it("should skip Pagamento Efetuado rows", () => {
    const buffer = createItauXlsx([
      { date: 46209, desc: "Pagamento Efetuado", installment: "", amount: -500 },
      { date: 46210, desc: "Real Purchase", installment: "", amount: 100 },
    ]);
    const result = parseItauXlsx(buffer);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe("Real Purchase");
  });

  it("should include cashback credits as negative amounts", () => {
    const buffer = createItauXlsx([
      { date: 46209, desc: "Credito Programa Cashback", installment: "", amount: -1 },
      { date: 46210, desc: "Purchase", installment: "", amount: 100 },
    ]);
    const result = parseItauXlsx(buffer);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].amount).toBe(-1);
    expect(result.transactions[0].description).toBe("Credito Programa Cashback");
  });

  it("should handle empty XLSX", () => {
    const buffer = createXlsxBuffer([]);
    const result = parseItauXlsx(buffer);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.transactions).toHaveLength(0);
  });

  it("should handle XLSX with no header row", () => {
    const buffer = createXlsxBuffer([
      [null, "Nome", "Test"],
      [null, null, null],
      [null, null, null],
    ]);
    const result = parseItauXlsx(buffer);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.transactions).toHaveLength(0);
  });

  it("should handle transactions without installment info", () => {
    const buffer = createItauXlsx([
      { date: 46209, desc: "Simple Purchase", installment: "", amount: 42.50 },
    ]);
    const result = parseItauXlsx(buffer);
    expect(result.transactions[0].installmentNumber).toBeNull();
    expect(result.transactions[0].totalInstallments).toBeNull();
    expect(result.transactions[0].amount).toBe(42.50);
  });

  it("should accumulate errors for invalid rows while parsing valid ones", () => {
    const wb = XLSX.utils.book_new();
    const rows: (string | number | null)[][] = [
      [null, "Nome", "Test"],
      [null, null, null],
      [null, null, null],
      [null, null, null],
      [null, null, null],
      [null, null, null],
      [null, null, null],
      [null, "Fatura Aberta - Agosto/2026"],
      [null, null, null],
      [null, "Cartão", "Itaú - final 9999"],
      [null, null, null],
      [null, null, null],
      [null, null, null],
      [null, "Lançamentos"],
      [null, "Data", "Lançamento", "Parcelamento", "Valor"],
      [null, 46209, "Valid Purchase", "", 100],
      [null, "invalid", "Bad Date", "", 50],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const result = parseItauXlsx(buffer);
    expect(result.transactions).toHaveLength(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Run parser tests**

```bash
bun run test -- --run src/lib/parsers/__tests__/itau-xlsx.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/lib/parsers/itau-xlsx.ts src/lib/parsers/__tests__/itau-xlsx.test.ts
git commit -m "feat: add Itaú XLSX parser with tests"
```

---

### Task 4: Implement preview API route

**Files:**
- Create: `src/app/api/transactions/import/credit-card-xlsx/preview/route.ts`
- Create: `src/app/api/transactions/import/credit-card-xlsx/preview/__tests__/route.test.ts`

- [ ] **Step 1: Create preview route**

```typescript
// src/app/api/transactions/import/credit-card-xlsx/preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { parseItauXlsx } from "@/lib/parsers/itau-xlsx";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json({ success: false, error: "File must be an XLSX" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { transactions, errors: parseErrors, billMonthYear, cardName } = parseItauXlsx(buffer);

    if (parseErrors.length > 0 && transactions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to parse XLSX", errors: parseErrors },
        { status: 400 }
      );
    }

    const existingTransactions = await prisma.transaction.findMany({
      where: {
        OR: transactions.map((t) => ({
          date: t.date,
          description: t.description,
          amount: new Prisma.Decimal(t.amount),
        })),
      },
      select: {
        date: true,
        description: true,
        amount: true,
      },
    });

    const existingKeys = new Set(
      existingTransactions.map(
        (t) => `${t.date.toISOString().split("T")[0]}|${t.description}|${t.amount.toString()}`
      )
    );

    const items = transactions.map((t, index) => {
      const dateStr = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}-${String(t.date.getDate()).padStart(2, "0")}`;
      const key = `${dateStr}|${t.description}|${t.amount}`;
      const exists = existingKeys.has(key);
      return {
        index,
        date: dateStr,
        description: t.description,
        amount: t.amount,
        installmentNumber: t.installmentNumber,
        totalInstallments: t.totalInstallments,
        billMonthYear,
        selected: t.amount > 0 && !exists,
        exists,
      };
    });

    return NextResponse.json({
      success: true,
      billMonthYear,
      cardName,
      items,
      errors: parseErrors,
    });
  } catch (error) {
    console.error("Credit card XLSX preview error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create preview API tests**

```typescript
// src/app/api/transactions/import/credit-card-xlsx/preview/__tests__/route.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";

const mockPrisma = {
  transaction: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/generated/prisma/client", () => ({
  Prisma: {
    Decimal: vi.fn().mockImplementation((value: string | number) => ({
      value,
      toString: () => String(value),
    })),
  },
}));

function createXlsxBuffer(rows: (string | number | null)[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function createItauXlsxBuffer(transactions: { date: number; desc: string; installment: string; amount: number }[]): Buffer {
  const rows: (string | number | null)[][] = [
    [null, null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null, null],
    [null, "Nome", "Elvis Test"],
    [null, "Agência", "1234"],
    [null, "Conta", "12345-6"],
    [null, null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null, null],
    [null, "Fatura Aberta - Agosto/2026"],
    [null, null, null, null, null, null, null, null, null, null],
    [null, "Cartão", null, null, null, null, "Valor (parcial)", null, "Vencimento", null],
    [null, "Itaú Personnalite Black Pontos Mastercard - final 6283", null, null, null, null, 2617.66, null, 46240, null],
    [null, null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null, null],
    [null, "Lançamentos"],
    [null, "Data", "Lançamento", "Parcelamento", "Valor", null, "Titularidade", "Nome", "Tipo do cartão", "Número do cartão"],
  ];
  for (const t of transactions) {
    rows.push([null, t.date, t.desc, t.installment, t.amount]);
  }
  return createXlsxBuffer(rows);
}

function createMockRequest(buffer: Buffer): NextRequest {
  const request = new NextRequest("http://localhost:3000/api/transactions/import/credit-card-xlsx/preview", {
    method: "POST",
  });
  const file = new File([buffer], "fatura.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const formData = new FormData();
  formData.append("file", file);
  vi.spyOn(request, "formData").mockResolvedValue(formData as any);
  return request;
}

describe("POST /api/transactions/import/credit-card-xlsx/preview", async () => {
  const { POST } = await import("../route");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 if no file provided", async () => {
    const request = new NextRequest("http://localhost:3000/api/transactions/import/credit-card-xlsx/preview", {
      method: "POST",
    });
    const formData = new FormData();
    vi.spyOn(request, "formData").mockResolvedValue(formData as any);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("No file provided");
  });

  it("should return 400 if file is not XLSX", async () => {
    const request = new NextRequest("http://localhost:3000/api/transactions/import/credit-card-xlsx/preview", {
      method: "POST",
    });
    const file = new File(["content"], "test.csv", { type: "text/csv" });
    const formData = new FormData();
    formData.append("file", file);
    vi.spyOn(request, "formData").mockResolvedValue(formData as any);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("File must be an XLSX");
  });

  it("should return preview items with correct structure", async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    const buffer = createItauXlsxBuffer([
      { date: 46209, desc: "Test Store", installment: "", amount: 100 },
      { date: 46210, desc: "Another Store", installment: "Parcela 2 de 3", amount: 50 },
    ]);
    const request = createMockRequest(buffer);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.billMonthYear).toBe("08-2026");
    expect(data.cardName).toContain("final 6283");
    expect(data.items).toHaveLength(2);
    expect(data.items[0]).toMatchObject({
      index: 0,
      description: "Test Store",
      amount: 100,
      installmentNumber: null,
      totalInstallments: null,
      selected: true,
      exists: false,
    });
    expect(data.items[1]).toMatchObject({
      installmentNumber: 2,
      totalInstallments: 3,
    });
  });

  it("should auto-select expenses and unselect credits", async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    const buffer = createItauXlsxBuffer([
      { date: 46209, desc: "Purchase", installment: "", amount: 100 },
      { date: 46210, desc: "Cashback", installment: "", amount: -5 },
    ]);
    const request = createMockRequest(buffer);

    const response = await POST(request);
    const data = await response.json();

    expect(data.items[0].selected).toBe(true);
    expect(data.items[1].selected).toBe(false);
  });

  it("should mark existing transactions", async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([
      {
        date: new Date("2026-07-15"),
        description: "Test Store",
        amount: { toString: () => "100" },
      },
    ]);
    const buffer = createItauXlsxBuffer([
      { date: 46209, desc: "Test Store", installment: "", amount: 100 },
    ]);
    const request = createMockRequest(buffer);

    const response = await POST(request);
    const data = await response.json();

    expect(data.items[0].exists).toBe(true);
    expect(data.items[0].selected).toBe(false);
  });
});
```

- [ ] **Step 3: Run preview API tests**

```bash
bun run test -- --run src/app/api/transactions/import/credit-card-xlsx/preview/__tests__/route.test.ts
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/app/api/transactions/import/credit-card-xlsx/preview/
git commit -m "feat: add credit card XLSX preview API endpoint"
```

---

### Task 5: Implement confirm API route

**Files:**
- Create: `src/app/api/transactions/import/credit-card-xlsx/confirm/route.ts`
- Create: `src/app/api/transactions/import/credit-card-xlsx/confirm/__tests__/route.test.ts`

- [ ] **Step 1: Create confirm route**

```typescript
// src/app/api/transactions/import/credit-card-xlsx/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseItauXlsx } from "@/lib/parsers/itau-xlsx";
import { Prisma } from "@/generated/prisma/client";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const selectedIndicesRaw = formData.get("selectedIndices") as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json({ success: false, error: "File must be an XLSX" }, { status: 400 });
    }

    if (!selectedIndicesRaw) {
      return NextResponse.json({ success: false, error: "No selected indices provided" }, { status: 400 });
    }

    let selectedIndices: number[];
    try {
      selectedIndices = JSON.parse(selectedIndicesRaw);
      if (!Array.isArray(selectedIndices) || selectedIndices.length === 0) {
        throw new Error("Invalid selection");
      }
    } catch {
      return NextResponse.json({ success: false, error: "Invalid selectedIndices format" }, { status: 400 });
    }

    const userDescriptionsRaw = formData.get("userDescriptions") as string | null;
    let userDescriptions: Record<string, string> = {};
    if (userDescriptionsRaw) {
      try {
        userDescriptions = JSON.parse(userDescriptionsRaw);
        if (typeof userDescriptions !== "object" || Array.isArray(userDescriptions)) {
          userDescriptions = {};
        }
      } catch {
        // Invalid JSON, ignore
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { transactions, errors: parseErrors, billMonthYear, cardName } = parseItauXlsx(buffer);

    if (parseErrors.length > 0 && transactions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to parse XLSX", errors: parseErrors },
        { status: 400 }
      );
    }

    const toImport = selectedIndices
      .filter((i) => i >= 0 && i < transactions.length)
      .map((i) => transactions[i]);

    if (toImport.length === 0) {
      return NextResponse.json({ success: false, error: "No valid transactions selected" }, { status: 400 });
    }

    const existingTransactions = await prisma.transaction.findMany({
      where: {
        OR: toImport.map((t) => ({
          date: t.date,
          description: t.description,
          amount: new Prisma.Decimal(t.amount),
        })),
      },
      select: {
        date: true,
        description: true,
        amount: true,
      },
    });

    const existingKeys = new Set(
      existingTransactions.map(
        (t) => `${t.date.toISOString().split("T")[0]}|${t.description}|${t.amount.toString()}`
      )
    );

    const newTransactions = toImport.filter((t) => {
      const dateStr = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}-${String(t.date.getDate()).padStart(2, "0")}`;
      const key = `${dateStr}|${t.description}|${t.amount}`;
      return !existingKeys.has(key);
    });

    const skipped = toImport.length - newTransactions.length;
    const batchImportId = crypto.randomUUID();

    const bill = await prisma.bill.upsert({
      where: { monthYear: billMonthYear },
      create: { monthYear: billMonthYear },
      update: {},
    });

    const filteredTransactions = newTransactions.filter((t) => {
      const dateStr = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}-${String(t.date.getDate()).padStart(2, "0")}`;
      const key = `${dateStr}|${t.description}|${t.amount}`;
      return true;
    });

    await prisma.transaction.createMany({
      data: filteredTransactions.map((t) => {
        const dateStr = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}-${String(t.date.getDate()).padStart(2, "0")}`;
        const key = `${dateStr}|${t.description}|${t.amount}`;
        return {
          date: t.date,
          description: t.description,
          userDescription: userDescriptions[key]?.trim() || null,
          amount: new Prisma.Decimal(t.amount),
          installmentNumber: t.installmentNumber,
          totalInstallments: t.totalInstallments,
          cardName,
          transactionType: "credit_card",
          importId: batchImportId,
          source: "import",
          billId: bill.id,
        };
      }),
    });

    return NextResponse.json({
      success: true,
      added: filteredTransactions.length,
      ignored: skipped,
      errors: parseErrors,
      importId: batchImportId,
      billId: bill.id,
      billMonthYear,
    });
  } catch (error) {
    console.error("Credit card XLSX import confirm error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create confirm API tests**

```typescript
// src/app/api/transactions/import/credit-card-xlsx/confirm/__tests__/route.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";

const mockPrisma = {
  transaction: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
  bill: {
    upsert: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/generated/prisma/client", () => ({
  Prisma: {
    Decimal: vi.fn().mockImplementation((value: string | number) => ({
      value,
      toString: () => String(value),
    })),
  },
}));

function createXlsxBuffer(rows: (string | number | null)[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function createItauXlsxBuffer(transactions: { date: number; desc: string; installment: string; amount: number }[]): Buffer {
  const rows: (string | number | null)[][] = [
    [null, null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null, null],
    [null, "Nome", "Elvis Test"],
    [null, "Agência", "1234"],
    [null, "Conta", "12345-6"],
    [null, null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null, null],
    [null, "Fatura Aberta - Agosto/2026"],
    [null, null, null, null, null, null, null, null, null, null],
    [null, "Cartão", null, null, null, null, "Valor (parcial)", null, "Vencimento", null],
    [null, "Itaú Personnalite Black Pontos Mastercard - final 6283", null, null, null, null, 2617.66, null, 46240, null],
    [null, null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null, null],
    [null, "Lançamentos"],
    [null, "Data", "Lançamento", "Parcelamento", "Valor", null, "Titularidade", "Nome", "Tipo do cartão", "Número do cartão"],
  ];
  for (const t of transactions) {
    rows.push([null, t.date, t.desc, t.installment, t.amount]);
  }
  return createXlsxBuffer(rows);
}

function createMockRequest(buffer: Buffer, selectedIndices: number[], userDescriptions?: Record<string, string>): NextRequest {
  const request = new NextRequest("http://localhost:3000/api/transactions/import/credit-card-xlsx/confirm", {
    method: "POST",
  });
  const file = new File([buffer], "fatura.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const formData = new FormData();
  formData.append("file", file);
  formData.append("selectedIndices", JSON.stringify(selectedIndices));
  if (userDescriptions) {
    formData.append("userDescriptions", JSON.stringify(userDescriptions));
  }
  vi.spyOn(request, "formData").mockResolvedValue(formData as any);
  return request;
}

describe("POST /api/transactions/import/credit-card-xlsx/confirm", async () => {
  const { POST } = await import("../route");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 if no file provided", async () => {
    const request = new NextRequest("http://localhost:3000/api/transactions/import/credit-card-xlsx/confirm", {
      method: "POST",
    });
    const formData = new FormData();
    vi.spyOn(request, "formData").mockResolvedValue(formData as any);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("No file provided");
  });

  it("should return 400 if file is not XLSX", async () => {
    const request = new NextRequest("http://localhost:3000/api/transactions/import/credit-card-xlsx/confirm", {
      method: "POST",
    });
    const file = new File(["content"], "test.csv", { type: "text/csv" });
    const formData = new FormData();
    formData.append("file", file);
    vi.spyOn(request, "formData").mockResolvedValue(formData as any);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("File must be an XLSX");
  });

  it("should return 400 if no selectedIndices", async () => {
    const buffer = createItauXlsxBuffer([
      { date: 46209, desc: "Test", installment: "", amount: 100 },
    ]);
    const request = new NextRequest("http://localhost:3000/api/transactions/import/credit-card-xlsx/confirm", {
      method: "POST",
    });
    const file = new File([buffer], "fatura.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const formData = new FormData();
    formData.append("file", file);
    vi.spyOn(request, "formData").mockResolvedValue(formData as any);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("No selected indices provided");
  });

  it("should successfully import selected transactions", async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    mockPrisma.bill.upsert.mockResolvedValueOnce({ id: "bill123", monthYear: "08-2026" });
    mockPrisma.transaction.createMany.mockResolvedValueOnce({ count: 2 });

    const buffer = createItauXlsxBuffer([
      { date: 46209, desc: "Purchase 1", installment: "", amount: 100 },
      { date: 46210, desc: "Purchase 2", installment: "", amount: 50 },
      { date: 46211, desc: "Skipped", installment: "", amount: 30 },
    ]);
    const request = createMockRequest(buffer, [0, 1]);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.added).toBe(2);
    expect(data.billMonthYear).toBe("08-2026");
  });

  it("should skip duplicate transactions", async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([
      {
        date: new Date("2026-07-15"),
        description: "Purchase 1",
        amount: { toString: () => "100" },
      },
    ]);
    mockPrisma.bill.upsert.mockResolvedValueOnce({ id: "bill123", monthYear: "08-2026" });
    mockPrisma.transaction.createMany.mockResolvedValueOnce({ count: 1 });

    const buffer = createItauXlsxBuffer([
      { date: 46209, desc: "Purchase 1", installment: "", amount: 100 },
      { date: 46210, desc: "Purchase 2", installment: "", amount: 50 },
    ]);
    const request = createMockRequest(buffer, [0, 1]);

    const response = await POST(request);
    const data = await response.json();

    expect(data.added).toBe(1);
    expect(data.ignored).toBe(1);
  });

  it("should include installment info in created transactions", async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    mockPrisma.bill.upsert.mockResolvedValueOnce({ id: "bill123", monthYear: "08-2026" });
    mockPrisma.transaction.createMany.mockResolvedValueOnce({ count: 1 });

    const buffer = createItauXlsxBuffer([
      { date: 46209, desc: "Store", installment: "Parcela 3 de 4", amount: 100 },
    ]);
    const request = createMockRequest(buffer, [0]);

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.added).toBe(1);

    const createCall = mockPrisma.transaction.createMany.mock.calls[0][0];
    expect(createCall.data[0].installmentNumber).toBe(3);
    expect(createCall.data[0].totalInstallments).toBe(4);
  });

  it("should set correct transactionType and source", async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
    mockPrisma.bill.upsert.mockResolvedValueOnce({ id: "bill123", monthYear: "08-2026" });
    mockPrisma.transaction.createMany.mockResolvedValueOnce({ count: 1 });

    const buffer = createItauXlsxBuffer([
      { date: 46209, desc: "Test", installment: "", amount: 100 },
    ]);
    const request = createMockRequest(buffer, [0]);

    await POST(request);

    const createCall = mockPrisma.transaction.createMany.mock.calls[0][0];
    expect(createCall.data[0].transactionType).toBe("credit_card");
    expect(createCall.data[0].source).toBe("import");
    expect(createCall.data[0].cardName).toContain("final 6283");
  });
});
```

- [ ] **Step 3: Run confirm API tests**

```bash
bun run test -- --run src/app/api/transactions/import/credit-card-xlsx/confirm/__tests__/route.test.ts
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/app/api/transactions/import/credit-card-xlsx/confirm/
git commit -m "feat: add credit card XLSX confirm API endpoint"
```

---

### Task 6: Implement CreditCardXlsxImport component

**Files:**
- Create: `src/components/CreditCardXlsxImport.tsx`
- Create: `src/components/__tests__/CreditCardXlsxImport.test.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/CreditCardXlsxImport.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { CreditCardXlsxPreviewItem } from "@/types";

export function CreditCardXlsxImport() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [items, setItems] = useState<CreditCardXlsxPreviewItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [userDescriptions, setUserDescriptions] = useState<Record<string, string>>({});
  const [billMonthYear, setBillMonthYear] = useState("");
  const [cardName, setCardName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handlePreview = async (file: File) => {
    if (!file.name.endsWith(".xlsx")) {
      setMessage({ type: "error", text: "Please select an XLSX file" });
      return;
    }

    setIsUploading(true);
    setMessage(null);
    setItems([]);
    setParseErrors([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/transactions/import/credit-card-xlsx/preview", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: result.error || "Failed to parse file" });
        if (result.errors) setParseErrors(result.errors);
      } else {
        setItems(result.items);
        setSelectedFile(file);
        setBillMonthYear(result.billMonthYear);
        setCardName(result.cardName);
        if (result.errors?.length > 0) setParseErrors(result.errors);
        if (result.items.length === 0) {
          setMessage({ type: "error", text: "No valid transactions found in the file" });
        }
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    const selectedIndices = items.filter((i) => i.selected).map((i) => i.index);
    if (selectedIndices.length === 0) {
      setMessage({ type: "error", text: "Select at least one transaction to import" });
      return;
    }

    setIsImporting(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("selectedIndices", JSON.stringify(selectedIndices));

      const selectedItems = items.filter((i) => i.selected);
      const filledUserDescriptions: Record<string, string> = {};
      selectedItems.forEach((item) => {
        const key = `${item.date}|${item.description}|${item.amount}`;
        if (userDescriptions[key]?.trim()) {
          filledUserDescriptions[key] = userDescriptions[key].trim();
        }
      });
      if (Object.keys(filledUserDescriptions).length > 0) {
        formData.append("userDescriptions", JSON.stringify(filledUserDescriptions));
      }

      const response = await fetch("/api/transactions/import/credit-card-xlsx/confirm", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: result.error || "Failed to import" });
      } else {
        setMessage({
          type: "success",
          text: `Imported ${result.added} transactions (${result.ignored} duplicates skipped)`,
        });
        setItems([]);
        setSelectedFile(null);
        setBillMonthYear("");
        setCardName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setIsImporting(false);
    }
  };

  const toggleItem = (index: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.index === index && !i.exists ? { ...i, selected: !i.selected } : i
      )
    );
  };

  const toggleAll = () => {
    const newItems = items.filter((i) => !i.exists);
    const allSelected = newItems.every((i) => i.selected);
    setItems((prev) =>
      prev.map((i) => (i.exists ? i : { ...i, selected: !allSelected }))
    );
  };

  const getAmountClass = (amount: number) => (amount < 0 ? "text-green-400" : "text-red-400");

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handlePreview(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePreview(file);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const resetUpload = () => {
    setItems([]);
    setSelectedFile(null);
    setMessage(null);
    setParseErrors([]);
    setUserDescriptions({});
    setBillMonthYear("");
    setCardName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const newItems = items.filter((i) => !i.exists);
  const hasData = newItems.length > 0;

  useEffect(() => {
    if (items.length === 0) return;
    const uniqueDescriptions = [...new Set(items.map((i) => i.description))];
    const fetchSuggestions = async () => {
      const suggestions: Record<string, string> = {};
      for (const desc of uniqueDescriptions) {
        try {
          const res = await fetch(`/api/transactions/user-description-suggestions?description=${encodeURIComponent(desc)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.userDescription) {
              const item = items.find((i) => i.description === desc);
              if (item) {
                const key = `${item.date}|${item.description}|${item.amount}`;
                suggestions[key] = data.userDescription;
              }
            }
          }
        } catch {
          // Ignore
        }
      }
      setUserDescriptions((prev) => ({ ...prev, ...suggestions }));
    };
    fetchSuggestions();
  }, [items]);

  return (
    <>
      {!hasData && (
        <div className="max-w-md mb-8">
          {billMonthYear && (
            <div className="mb-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700 text-sm">
              <p className="text-zinc-400">Bill: <span className="text-zinc-200">{billMonthYear}</span></p>
              {cardName && <p className="text-zinc-400">Card: <span className="text-zinc-200">{cardName}</span></p>}
            </div>
          )}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragging ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 hover:border-zinc-600"
            } ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleChange}
              className="hidden"
              disabled={isUploading}
            />
            <button
              type="button"
              onClick={handleClick}
              disabled={isUploading}
              className="w-full h-full bg-transparent border-none cursor-pointer"
            >
              <div className="text-zinc-400">
                {isUploading ? (
                  <p>Parsing file...</p>
                ) : (
                  <>
                    <p className="font-medium text-zinc-200">Drop your XLSX file here</p>
                    <p className="text-sm mt-1">or click to browse</p>
                  </>
                )}
              </div>
            </button>
          </div>

          {parseErrors.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-lg text-sm">
              <p className="font-medium mb-1">Parse warnings:</p>
              {parseErrors.map((e, i) => (
                <p key={i} className="text-xs">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {message && (
        <div
          className={`mb-6 p-3 rounded-lg text-sm whitespace-pre-line ${
            message.type === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {message.text}
        </div>
      )}

      {hasData && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-medium text-zinc-200">
                Preview ({newItems.length} transactions)
              </h2>
              <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newItems.every((i) => i.selected)}
                  onChange={toggleAll}
                  className="rounded border-zinc-600"
                />
                Select all
              </label>
            </div>
            <div className="flex gap-3">
              <button
                onClick={resetUpload}
                disabled={isImporting}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 border border-zinc-700 transition-colors"
              >
                Start Over
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting || newItems.filter((i) => i.selected).length === 0}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium disabled:opacity-50 transition-colors"
              >
                {isImporting ? "Importing..." : `Import Selected (${newItems.filter((i) => i.selected).length})`}
              </button>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="px-4 py-3 text-center text-sm font-medium text-zinc-400 w-12">
                    <input
                      type="checkbox"
                      checked={newItems.every((i) => i.selected)}
                      onChange={toggleAll}
                      className="rounded border-zinc-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Installment</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Label</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Amount</th>
                </tr>
              </thead>
              <tbody>
                {newItems.map((item) => (
                  <tr
                    key={item.index}
                    className={`border-b border-zinc-800 hover:bg-zinc-800/50 cursor-pointer ${
                      !item.selected ? "opacity-50" : ""
                    }`}
                    onClick={() => toggleItem(item.index)}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleItem(item.index)}
                        className="rounded border-zinc-600"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">{item.date}</td>
                    <td className="px-4 py-3 text-sm text-zinc-200">{item.description}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {item.installmentNumber && item.totalInstallments
                        ? `${item.installmentNumber}/${item.totalInstallments}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={userDescriptions[`${item.date}|${item.description}|${item.amount}`] || ""}
                        onChange={(e) => {
                          const key = `${item.date}|${item.description}|${item.amount}`;
                          setUserDescriptions((prev) => ({ ...prev, [key]: e.target.value }));
                        }}
                        placeholder="Add label..."
                        className="w-full bg-transparent border border-zinc-700 rounded px-2 py-0.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                      />
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${getAmountClass(item.amount)}`}>
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-sm text-zinc-500">
            {newItems.filter((i) => i.selected).length} of {newItems.length} new transactions selected
            {items.length > newItems.length && (
              <span className="ml-2">
                ({items.length - newItems.length} already imported — hidden)
              </span>
            )}
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Create component tests**

```tsx
// src/components/__tests__/CreditCardXlsxImport.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { CreditCardXlsxImport } from "../CreditCardXlsxImport";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("CreditCardXlsxImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders upload zone correctly", () => {
    render(<CreditCardXlsxImport />);
    expect(screen.getByText("Drop your XLSX file here")).toBeInTheDocument();
    expect(screen.getByText("or click to browse")).toBeInTheDocument();
  });

  it("rejects non-XLSX file", async () => {
    render(<CreditCardXlsxImport />);
    const file = new File(["content"], "test.csv", { type: "text/csv" });
    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Please select an XLSX file")).toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows loading state during upload", async () => {
    (global.fetch as any).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ items: [], billMonthYear: "08-2026", cardName: "Test" }),
      }), 100))
    );

    render(<CreditCardXlsxImport />);
    const file = new File(["content"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Parsing file...")).toBeInTheDocument();
    });
  });

  it("shows preview table after successful upload", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        billMonthYear: "08-2026",
        cardName: "Itaú - final 6283",
        items: [
          { index: 0, date: "2026-07-15", description: "Store A", amount: 100, installmentNumber: null, totalInstallments: null, billMonthYear: "08-2026", selected: true, exists: false },
          { index: 1, date: "2026-07-16", description: "Store B", amount: 50, installmentNumber: 2, totalInstallments: 3, billMonthYear: "08-2026", selected: true, exists: false },
        ],
        errors: [],
      }),
    });

    render(<CreditCardXlsxImport />);
    const file = new File(["content"], "fatura.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Preview (2 transactions)")).toBeInTheDocument();
      expect(screen.getByText("Store A")).toBeInTheDocument();
      expect(screen.getByText("Store B")).toBeInTheDocument();
      expect(screen.getByText("2/3")).toBeInTheDocument();
    });
  });

  it("toggles item selection", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        billMonthYear: "08-2026",
        cardName: "Test",
        items: [
          { index: 0, date: "2026-07-15", description: "Store A", amount: 100, installmentNumber: null, totalInstallments: null, billMonthYear: "08-2026", selected: true, exists: false },
        ],
        errors: [],
      }),
    });

    render(<CreditCardXlsxImport />);
    const file = new File(["content"], "fatura.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Store A")).toBeInTheDocument();
    });

    const checkbox = screen.getAllByRole("checkbox")[1]; // first is select-all
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByText("Import Selected (0)")).toBeInTheDocument();
    });
  });

  it("calls confirm API on import", async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          billMonthYear: "08-2026",
          cardName: "Test",
          items: [
            { index: 0, date: "2026-07-15", description: "Store A", amount: 100, installmentNumber: null, totalInstallments: null, billMonthYear: "08-2026", selected: true, exists: false },
          ],
          errors: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, added: 1, ignored: 0 }),
      });

    render(<CreditCardXlsxImport />);
    const file = new File(["content"], "fatura.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Store A")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Import Selected (1)"));

    await waitFor(() => {
      expect(screen.getByText("Imported 1 transactions (0 duplicates skipped)")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/transactions/import/credit-card-xlsx/confirm",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows error on preview failure", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Failed to parse XLSX" }),
    });

    render(<CreditCardXlsxImport />);
    const file = new File(["content"], "bad.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Failed to parse XLSX")).toBeInTheDocument();
    });
  });

  it("shows network error", async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

    render(<CreditCardXlsxImport />);
    const file = new File(["content"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Network error. Please try again.")).toBeInTheDocument();
    });
  });

  it("resets state on Start Over", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        billMonthYear: "08-2026",
        cardName: "Test",
        items: [
          { index: 0, date: "2026-07-15", description: "Store A", amount: 100, installmentNumber: null, totalInstallments: null, billMonthYear: "08-2026", selected: true, exists: false },
        ],
        errors: [],
      }),
    });

    render(<CreditCardXlsxImport />);
    const file = new File(["content"], "fatura.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Store A")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Start Over"));

    await waitFor(() => {
      expect(screen.getByText("Drop your XLSX file here")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 3: Run component tests**

```bash
bun run test -- --run src/components/__tests__/CreditCardXlsxImport.test.tsx
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/CreditCardXlsxImport.tsx src/components/__tests__/CreditCardXlsxImport.test.tsx
git commit -m "feat: add CreditCardXlsxImport component with tests"
```

---

### Task 7: Update add transaction page

**Files:**
- Modify: `src/app/transactions/add/page.tsx`

- [ ] **Step 1: Update the dropdown and import**

Add `"credit_card_xlsx"` to the csvType state and update the dropdown and rendering logic.

Changes to `src/app/transactions/add/page.tsx`:

1. Add import at top (after line 6):
```typescript
import { CreditCardXlsxImport } from "@/components/CreditCardXlsxImport";
```

2. Change csvType state type (line 18):
```typescript
const [csvType, setCsvType] = useState<"credit_card" | "credit_card_xlsx" | "checking_account">("credit_card");
```

3. Update the select element (lines 68-74) to add the new option:
```typescript
<select
  value={csvType}
  onChange={(e) => setCsvType(e.target.value as "credit_card" | "credit_card_xlsx" | "checking_account")}
  className="w-full max-w-xs px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
>
  <option value="credit_card">Credit Card (CSV)</option>
  <option value="credit_card_xlsx">Credit Card (XLSX)</option>
  <option value="checking_account">Checking Account</option>
</select>
```

4. Update the conditional rendering (lines 77-81):
```typescript
{csvType === "credit_card" ? (
  <FileUpload onUploadComplete={() => {}} />
) : csvType === "credit_card_xlsx" ? (
  <CreditCardXlsxImport />
) : (
  <CheckingAccountImport />
)}
```

5. Update the page description (line 32):
```typescript
<p className="text-sm text-zinc-400 mt-1">
  Import CSV/XLSX files or manually enter transactions
</p>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun --bun run build --no-lint 2>&1 | head -30
```

Expected: no type errors

- [ ] **Step 3: Commit**

```bash
git add src/app/transactions/add/page.tsx
git commit -m "feat: add Credit Card XLSX option to import dropdown"
```

---

### Task 8: Run all tests and lint

- [ ] **Step 1: Run all tests**

```bash
bun run test
```

Expected: all tests pass (existing + new)

- [ ] **Step 2: Run lint**

```bash
bun --bun run lint
```

Expected: no lint errors

- [ ] **Step 3: Fix any issues**

If tests or lint fail, fix them before proceeding.

---

### Task 9: Validate with real XLSX file

- [ ] **Step 1: Start dev server**

```bash
bun --bun run dev
```

- [ ] **Step 2: Test in browser**

1. Navigate to `/transactions/add`
2. Select "Credit Card (XLSX)" from dropdown
3. Upload `~/Downloads/fatura-aberta-final 6283-agosto2026.xlsx`
4. Verify preview shows 26 transactions (28 minus Pagamento Efetuado and cashback credits excluded = depends on parser behavior)
5. Verify bill month is "08-2026"
6. Verify card name is correct
7. Select transactions and import
8. Verify success message

- [ ] **Step 2: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues from real file validation"
```
