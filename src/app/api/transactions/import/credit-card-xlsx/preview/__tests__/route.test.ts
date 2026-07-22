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

function polyfillArrayBuffer() {
  if (typeof File !== "undefined" && !File.prototype.arrayBuffer) {
    File.prototype.arrayBuffer = function () {
      return new Promise<ArrayBuffer>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.readAsArrayBuffer(this);
      });
    };
  }
}

describe("POST /api/transactions/import/credit-card-xlsx/preview", async () => {
  const { POST } = await import("../route");

  beforeEach(() => {
    vi.clearAllMocks();
    polyfillArrayBuffer();
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
        date: new Date("2026-07-06"),
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
