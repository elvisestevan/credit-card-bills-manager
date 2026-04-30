import { describe, it, expect } from "vitest";
import { parseItauCsv } from "../itau";

describe("parseItauCsv", () => {
  it("should parse valid CSV with headers", () => {
    const csv = "data,lançamento,valor\n2024-01-01,POUPANCA,-100,00";
    const result = parseItauCsv(csv);

    expect(result.errors).toHaveLength(0);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].date.toISOString().split("T")[0]).toBe("2024-01-01");
    expect(result.transactions[0].description).toBe("POUPANCA");
    expect(result.transactions[0].amount).toBe(-100);
  });

  it("should return error for empty CSV", () => {
    const result = parseItauCsv("");
    expect(result.errors).toContain("CSV file is empty or has no data rows");
    expect(result.transactions).toHaveLength(0);
  });

  it("should return error for CSV with only headers", () => {
    const result = parseItauCsv("data,lançamento,valor");
    expect(result.errors).toContain("CSV file is empty or has no data rows");
    expect(result.transactions).toHaveLength(0);
  });

  it("should return error for invalid headers", () => {
    const csv = "a,b,c\n2024-01-01,test,100";
    const result = parseItauCsv(csv);
    expect(result.errors[0]).toContain("Invalid headers");
  });

  it("should return error for invalid date format", () => {
    const csv = "data,lançamento,valor\ninvalid,test,100";
    const result = parseItauCsv(csv);
    expect(result.errors[0]).toContain('Invalid date format "invalid"');
    expect(result.transactions).toHaveLength(0);
  });

  it("should return error for invalid amount", () => {
    const csv = "data,lançamento,valor\n2024-01-01,test,abc";
    const result = parseItauCsv(csv);
    expect(result.errors[0]).toContain('Invalid amount "abc"');
    expect(result.transactions).toHaveLength(0);
  });

  it("should extract installment numbers from description", () => {
    const csv = "data,lançamento,valor\n2024-01-01,STORE 1/3,100";
    const result = parseItauCsv(csv);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].installmentNumber).toBe(1);
    expect(result.transactions[0].totalInstallments).toBe(3);
    expect(result.transactions[0].description).toBe("STORE");
  });

  it("should handle installments without space before numbers", () => {
    const csv = "data,lançamento,valor\n2024-01-01,AMAZON2/5,50";
    const result = parseItauCsv(csv);

    expect(result.transactions[0].installmentNumber).toBe(2);
    expect(result.transactions[0].totalInstallments).toBe(5);
    expect(result.transactions[0].description).toBe("AMAZON");
  });

  it("should handle quoted CSV values", () => {
    const csv = 'data,lançamento,valor\n2024-01-01,"STORE NAME, LLC",100';
    const result = parseItauCsv(csv);

    expect(result.errors).toHaveLength(0);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe("STORE NAME, LLC");
  });

  it("should handle negative amounts (credits)", () => {
    const csv = "data,lançamento,valor\n2024-01-01,REFUND,-50,00";
    const result = parseItauCsv(csv);

    expect(result.transactions[0].amount).toBe(-50);
  });

  it("should handle positive amounts without sign", () => {
    const csv = "data,lançamento,valor\n2024-01-01,PURCHASE,150,00";
    const result = parseItauCsv(csv);

    expect(result.transactions[0].amount).toBe(150);
  });

  it("should skip empty rows", () => {
    const csv = "data,lançamento,valor\n2024-01-01,test,100\n\n2024-01-02,test2,200";
    const result = parseItauCsv(csv);

    expect(result.transactions).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it("should return error for missing required fields", () => {
    const csv = "data,lançamento,valor\n2024-01-01,test";
    const result = parseItauCsv(csv);
    expect(result.errors[0]).toContain("Invalid number of columns");
  });

  it("should return error for row with missing date", () => {
    const csv = "data,lançamento,valor\n,test,100";
    const result = parseItauCsv(csv);
    expect(result.errors[0]).toContain("Missing required fields");
  });

  it("should parse multiple rows", () => {
    const csv = "data,lançamento,valor\n2024-01-01,SHOPPING,-200\n2024-01-02,FOOD,-50\n2024-01-03,SALARY,500";
    const result = parseItauCsv(csv);

    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[0].description).toBe("SHOPPING");
    expect(result.transactions[1].description).toBe("FOOD");
    expect(result.transactions[2].description).toBe("SALARY");
  });
});