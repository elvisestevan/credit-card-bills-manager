import { describe, it, expect } from "vitest";
import { parseCheckingAccountCsv } from "../checking-account";

describe("parseCheckingAccountCsv", () => {
  it("should parse valid CSV with semicolons", () => {
    const csv = `19/05/2026;COR OPERACOES B3;-702,45
19/05/2026;REND PAGO APLIC AUT MAIS;0,04`;
    const result = parseCheckingAccountCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].description).toBe("COR OPERACOES B3");
    expect(result.transactions[0].amount).toBe(702.45);
    expect(result.transactions[1].amount).toBe(-0.04);
  });

  it("should handle dates correctly", () => {
    const csv = `15/03/2026;TED TRANSFERENCIA;-1500,00`;
    const result = parseCheckingAccountCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.transactions).toHaveLength(1);
    const t = result.transactions[0];
    expect(t.date.getFullYear()).toBe(2026);
    expect(t.date.getMonth()).toBe(2); // 0-indexed
    expect(t.date.getDate()).toBe(15);
  });

  it("should handle amounts with thousands separators", () => {
    const csv = `10/01/2026;PAGAMENTO;-1.500,50`;
    const result = parseCheckingAccountCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.transactions[0].amount).toBe(1500.50);
  });

  it("should reject rows with wrong column count", () => {
    const csv = `19/05/2026;COR OPERACOES B3;-702,45;extra`;
    const result = parseCheckingAccountCsv(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.transactions).toHaveLength(0);
    expect(result.errors[0]).toContain("Invalid number of columns");
  });

  it("should handle empty CSV", () => {
    const csv = ``;
    const result = parseCheckingAccountCsv(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBe("CSV file is empty");
    expect(result.transactions).toHaveLength(0);
  });

  it("should skip empty lines", () => {
    const csv = `19/05/2026;COR OPERACOES B3;-702,45

20/05/2026;PAGAMENTO;-100,00`;
    const result = parseCheckingAccountCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.transactions).toHaveLength(2);
  });

  it("should report invalid date format", () => {
    const csv = `invalid-date;DESCRICAO;-100,00`;
    const result = parseCheckingAccountCsv(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Invalid date");
    expect(result.transactions).toHaveLength(0);
  });

  it("should report invalid amount", () => {
    const csv = `19/05/2026;DESCRICAO;not-a-number`;
    const result = parseCheckingAccountCsv(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Invalid amount");
  });

  it("should report missing fields", () => {
    const csv = `19/05/2026;;-100,00`;
    const result = parseCheckingAccountCsv(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Missing required fields");
  });
});
