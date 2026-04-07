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
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}
