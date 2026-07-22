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

describe("POST /api/transactions/import/credit-card-xlsx/confirm", async () => {
  const { POST } = await import("../route");

  beforeEach(() => {
    vi.clearAllMocks();
    polyfillArrayBuffer();
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
        date: new Date("2026-07-06"),
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
