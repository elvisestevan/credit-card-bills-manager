export type TransactionType = "credit_card" | "checking_account";

export interface ItauTransaction {
  date: Date;
  description: string;
  amount: number;
  installmentNumber: number | null;
  totalInstallments: number | null;
}

export interface CheckingAccountTransaction {
  date: Date;
  description: string;
  amount: number;
}

export interface ImportResult {
  importId: string;
  count: number;
  errors: string[];
}

export interface TransactionSummary {
  totalTransactions: number;
  totalValue: number;
  totalInstallmentTransactions: number;
  totalInstallmentValue: number;
  lastInstallmentCount: number;
  lastInstallmentTotal: number;
}

export interface TransactionListResponse {
  data: {
    id: number;
    date: string;
    description: string;
    amount: string;
    cardName: string | null;
    installmentNumber: number | null;
    totalInstallments: number | null;
    transactionType: TransactionType;
    categoryId: number | null;
    categoryName: string | null;
    billId: string;
    billMonthYear: string | null;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  summary?: TransactionSummary;
}

export interface Bill {
  id: string;
  monthYear: string;
  totalTransactions: number;
  totalAmount: number;
  totalInstallmentTransactions: number;
  totalInstallmentAmount: number;
  pendingCount: number;
  pendingAmount: number;
  lastUpdated: string;
}

export interface Category {
  id: number;
  name: string;
  createdAt: string;
}

export interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: string;
  installmentNumber: number | null;
  totalInstallments: number | null;
  transactionType?: TransactionType;
  categoryId: number | null;
  categoryName?: string;
}

export interface BillTransactionsResponse {
  bill: {
    id: string;
    monthYear: string;
  };
  data: TransactionListResponse["data"];
  pagination: TransactionListResponse["pagination"];
  summary?: TransactionSummary;
}

export interface ImportConflict {
  transaction: string;
  existingBill: string;
}

export interface ImportResponse {
  success: boolean;
  added?: number;
  ignored?: number;
  error?: string;
  conflicts?: ImportConflict[];
}

export interface CheckingAccountPreviewItem {
  index: number;
  date: string;
  description: string;
  amount: number;
  billMonthYear: string;
  selected: boolean;
  exists: boolean;
}
