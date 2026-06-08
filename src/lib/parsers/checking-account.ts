import { CheckingAccountTransaction } from "@/types";

export function parseCheckingAccountCsv(csvContent: string): {
  transactions: CheckingAccountTransaction[];
  errors: string[];
} {
  const lines = csvContent.trim().split("\n").filter((l) => l.trim());
  const errors: string[] = [];
  const transactions: CheckingAccountTransaction[] = [];

  if (lines.length === 0) {
    errors.push("CSV file is empty");
    return { transactions, errors };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const columns = line.split(";");
    if (columns.length !== 3) {
      errors.push(`Row ${i + 1}: Invalid number of columns`);
      continue;
    }

    const dateStr = columns[0].trim();
    const description = columns[1].trim();
    const amountStr = columns[2].trim();

    if (!dateStr || !description || !amountStr) {
      errors.push(`Row ${i + 1}: Missing required fields`);
      continue;
    }

    const [day, month, year] = dateStr.split("/").map(Number);
    if (!day || !month || !year) {
      errors.push(`Row ${i + 1}: Invalid date format "${dateStr}"`);
      continue;
    }
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) {
      errors.push(`Row ${i + 1}: Invalid date "${dateStr}"`);
      continue;
    }

    const normalizedAmount = amountStr.replace(/\./g, "").replace(",", ".");
    const rawAmount = parseFloat(normalizedAmount);
    if (isNaN(rawAmount)) {
      errors.push(`Row ${i + 1}: Invalid amount "${amountStr}"`);
      continue;
    }

    const amount = -rawAmount;
    transactions.push({ date, description, amount });
  }

  return { transactions, errors };
}
