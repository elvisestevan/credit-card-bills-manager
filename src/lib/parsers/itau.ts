import { ItauTransaction } from "@/types";

const INSTALLMENT_REGEX = /(\d+)\/(\d+)$/;

export function parseItauCsv(csvContent: string): {
  transactions: ItauTransaction[];
  errors: string[];
} {
  const lines = csvContent.trim().split("\n");
  const errors: string[] = [];
  const transactions: ItauTransaction[] = [];

  if (lines.length < 2) {
    errors.push("CSV file is empty or has no data rows");
    return { transactions, errors };
  }

  const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());

  const dateIndex = headers.indexOf("data");
  const descriptionIndex = headers.indexOf("lançamento");
  const amountIndex = headers.indexOf("valor");

  if (dateIndex === -1 || descriptionIndex === -1 || amountIndex === -1) {
    errors.push(
      `Invalid headers. Expected: data, lançamento, valor. Got: ${headers.join(", ")}`
    );
    return { transactions, errors };
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const columns = parseCsvLine(line);

    if (columns.length < 3) {
      errors.push(`Row ${i + 1}: Invalid number of columns`);
      continue;
    }

    const dateStr = columns[dateIndex]?.trim();
    const description = columns[descriptionIndex]?.trim();
    const amountStr = columns[amountIndex]?.trim();

    if (!dateStr || !description || !amountStr) {
      errors.push(`Row ${i + 1}: Missing required fields`);
      continue;
    }

    if (description === "PAGAMENTO EFETUADO") {
      continue;
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      errors.push(`Row ${i + 1}: Invalid date format "${dateStr}"`);
      continue;
    }

    const amount = parseFloat(amountStr.replace(",", "."));
    if (isNaN(amount)) {
      errors.push(`Row ${i + 1}: Invalid amount "${amountStr}"`);
      continue;
    }

    const match = description.match(INSTALLMENT_REGEX);
    let installmentNumber: number | null = null;
    let totalInstallments: number | null = null;
    let cleanDescription = description;

    if (match) {
      installmentNumber = parseInt(match[1], 10);
      totalInstallments = parseInt(match[2], 10);
      cleanDescription = description.slice(0, -match[0].length).trim();
    }

    transactions.push({
      date,
      description: cleanDescription,
      amount,
      installmentNumber,
      totalInstallments,
    });
  }

  return { transactions, errors };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}
