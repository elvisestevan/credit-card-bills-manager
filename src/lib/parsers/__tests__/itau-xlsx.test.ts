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
    expect(d.toISOString()).toBe("2026-07-06T00:00:00.000Z");
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
