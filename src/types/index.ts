export interface ItauTransaction {
  date: Date;
  description: string;
  amount: number;
  installmentNumber: number | null;
  totalInstallments: number | null;
}

export interface ImportResult {
  importId: string;
  count: number;
  errors: string[];
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
    categoryId: number | null;
    categoryName: string | null;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
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
