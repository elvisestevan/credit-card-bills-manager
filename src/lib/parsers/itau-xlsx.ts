import type { ItauXlsxTransaction } from "@/types";

const INSTALLMENT_REGEX = /Parcela (\d+) de (\d+)/;

function excelSerialToDate(serial: number): Date {
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

export function parseItauXlsx(buffer: Buffer): {
  transactions: ItauXlsxTransaction[];
  errors: string[];
  billMonthYear: string;
  cardName: string;
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx");
  const errors: string[] = [];
  const transactions: ItauXlsxTransaction[] = [];
  let billMonthYear = "";
  let cardName = "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (rows.length < 14) {
    errors.push("XLSX file is too short or has no transaction data");
    return { transactions, errors, billMonthYear, cardName };
  }

  // Extract metadata from rows 0-12
  for (let i = 0; i < Math.min(13, rows.length); i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const rowStr = row.map((v) => String(v ?? "")).join(" ");

    // Bill month: "Fatura Aberta - Mês/AAAA"
    if (rowStr.includes("Fatura Aberta") && !billMonthYear) {
      const match = rowStr.match(/(\w+)\/(\d{4})/);
      if (match) {
        const monthNum = monthNameToNumber(match[1]);
        if (monthNum) {
          billMonthYear = `${monthNum}-${match[2]}`;
        }
      }
    }

    // Card name: row after the "Cartão" header row
    if (rowStr.includes("Cartão") && !cardName && i + 1 < rows.length) {
      const nextRow = rows[i + 1];
      if (Array.isArray(nextRow)) {
        for (const cell of nextRow) {
          const s = String(cell ?? "").trim();
          if (s.length > 10 && s.includes("final")) {
            cardName = s;
            break;
          }
        }
      }
    }
  }

  // Find header row: "Data", "Lançamento", "Valor"
  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const cellStrs = row.map((v) => String(v ?? "").trim().toLowerCase());
    if (cellStrs.includes("data") && cellStrs.includes("lançamento") && cellStrs.includes("valor")) {
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
    if (!Array.isArray(row)) continue;

    const rowStr = row.map((v) => String(v ?? "")).join("").trim();
    if (!rowStr || rowStr.includes("Subtotal") || rowStr.includes("Importante saber")) {
      break;
    }

    // Columns: B=0(date), C=1(desc), D=2(installment), E=3(amount)
    const dateVal = row[1];
    const description = String(row[2] ?? "").trim();
    const installmentStr = String(row[3] ?? "").trim();
    const amountVal = row[4];

    if (!description || description === "Lançamento") continue;
    if (description === "Pagamento Efetuado") continue;

    // Parse date (Excel serial number)
    const serial = typeof dateVal === "number" ? dateVal : parseFloat(String(dateVal));
    if (isNaN(serial) || serial < 1) {
      errors.push(`Row ${i + 1}: Invalid date serial "${dateVal}"`);
      continue;
    }
    const date = excelSerialToDate(serial);
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
