"use client";

import { useState, useEffect, useCallback } from "react";
import { TransactionListResponse } from "@/types";

interface TransactionsTableProps {
  refreshKey: number;
}

export function TransactionsTable({ refreshKey }: TransactionsTableProps) {
  const [data, setData] = useState<TransactionListResponse["data"]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isLoading, setIsLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
      });

      const response = await fetch(`/api/transactions?${params}`);
      const result: TransactionListResponse = await response.json();
      setData(result.data);
      setPagination(result.pagination);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, sortBy, sortOrder]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions, refreshKey]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Math.abs(num));
    return num < 0 ? `(${formatted})` : formatted;
  };

  const getAmountClass = (amount: string) => {
    const num = parseFloat(amount);
    return num < 0 ? "text-green-400" : "text-red-400";
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  if (isLoading && data.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">Loading...</div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        No transactions yet. Import a CSV file to get started.
      </div>
    );
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <span className="text-zinc-600">↕</span>;
    return <span>{sortOrder === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-zinc-700">
            <th
              className="px-4 py-3 text-left text-sm font-medium text-zinc-400 cursor-pointer hover:bg-zinc-800"
              onClick={() => handleSort("date")}
            >
              Date <SortIcon field="date" />
            </th>
            <th
              className="px-4 py-3 text-left text-sm font-medium text-zinc-400 cursor-pointer hover:bg-zinc-800"
              onClick={() => handleSort("description")}
            >
              Description <SortIcon field="description" />
            </th>
            <th
              className="px-4 py-3 text-right text-sm font-medium text-zinc-400 cursor-pointer hover:bg-zinc-800"
              onClick={() => handleSort("amount")}
            >
              Amount <SortIcon field="amount" />
            </th>
            <th className="px-4 py-3 text-center text-sm font-medium text-zinc-400">
              Installments
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((transaction) => (
            <tr
              key={transaction.id}
              className="border-b border-zinc-800 hover:bg-zinc-800/50"
            >
              <td className="px-4 py-3 text-sm text-zinc-300">{transaction.date}</td>
              <td className="px-4 py-3 text-sm text-zinc-200">{transaction.description}</td>
              <td className={`px-4 py-3 text-sm text-right font-medium ${getAmountClass(transaction.amount)}`}>
                {formatAmount(transaction.amount)}
              </td>
              <td className="px-4 py-3 text-sm text-center text-zinc-500">
                {transaction.installmentNumber && transaction.totalInstallments
                  ? `${transaction.installmentNumber}/${transaction.totalInstallments}`
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-4">
          <span className="text-sm text-zinc-500">
            Page {pagination.page} of {totalPages} ({pagination.total} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page <= 1}
              className="px-3 py-1 text-sm border border-zinc-700 rounded text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page >= totalPages}
              className="px-3 py-1 text-sm border border-zinc-700 rounded text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
