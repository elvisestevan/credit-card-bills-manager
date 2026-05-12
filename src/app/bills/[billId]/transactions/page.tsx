"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { BillTransactionsResponse, TransactionListResponse, Transaction } from "@/types";
import { CategorizationModal } from "@/components/CategorizationModal";

interface BillTransactionsPageProps {
  params: Promise<{ billId: string }>;
}

interface BillSummary {
  totalTransactions: number;
  totalValue: number;
  totalInstallmentTransactions: number;
  totalInstallmentValue: number;
  lastInstallmentCount: number;
  lastInstallmentTotal: number;
}

export default function BillTransactionsPage({ params }: BillTransactionsPageProps) {
  const [billId, setBillId] = useState<string | null>(null);
  const [billMonthYear, setBillMonthYear] = useState<string | null>(null);
  const [data, setData] = useState<TransactionListResponse["data"]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<BillSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [categorizeTransaction, setCategorizeTransaction] = useState<Transaction | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showInstallments, setShowInstallments] = useState(false);
  const [showLastInstallment, setShowLastInstallment] = useState(false);
  const [showRefunds, setShowRefunds] = useState(false);
  const [showUncategorized, setShowUncategorized] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const hasActiveFilters = searchInput || showInstallments || showLastInstallment || showRefunds || showUncategorized;

  useEffect(() => {
    async function loadParams() {
      const resolved = await params;
      setBillId(resolved.billId);
    }
    loadParams();
  }, [params]);

  const fetchTransactions = useCallback(async () => {
    if (!billId) return;

    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
      });

      if (debouncedSearch.trim()) {
        queryParams.set("search", debouncedSearch.trim());
      }
      if (showInstallments) {
        queryParams.set("installments", "true");
      }
      if (showLastInstallment) {
        queryParams.set("lastInstallment", "true");
      }
      if (showRefunds) {
        queryParams.set("refunds", "true");
      }
      if (showUncategorized) {
        queryParams.set("uncategorized", "true");
      }

      const response = await fetch(`/api/bills/${billId}/transactions?${queryParams}`);
      const result: BillTransactionsResponse = await response.json();

      if (response.ok) {
        setBillMonthYear(result.bill.monthYear);
        setData(result.data || []);
        setPagination(result.pagination);
      } else {
        console.error("Failed to fetch bill transactions:", result);
      }
    } catch (error) {
      console.error("Failed to fetch bill transactions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [billId, pagination.page, pagination.limit, sortBy, sortOrder, debouncedSearch, showInstallments, showLastInstallment, showRefunds, showUncategorized]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPagination((p) => ({ ...p, page: 1 }));
  }, [debouncedSearch, showInstallments, showLastInstallment, showRefunds, showUncategorized]);

  useEffect(() => {
    if (!billId) return;

    async function fetchSummary() {
      setIsSummaryLoading(true);
      try {
        const response = await fetch(`/api/bills/${billId}/summary`);
        const data = await response.json();
        setSummary(data);
      } catch (error) {
        console.error("Failed to fetch bill summary:", error);
      } finally {
        setIsSummaryLoading(false);
      }
    }
    fetchSummary();
  }, [billId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

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
      <div className="min-h-screen bg-zinc-950 text-zinc-50">
        <header className="bg-zinc-900 border-b border-zinc-800">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="text-center text-zinc-500">Loading...</div>
          </div>
        </header>
      </div>
    );
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <span className="text-zinc-600">↕</span>;
    return <span>{sortOrder === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/bills"
                className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                ← Back to Bills
              </Link>
              <h1 className="text-2xl font-semibold text-white mt-2">
                Bill: {billMonthYear || billId}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <section className="mb-8">
          {isSummaryLoading ? (
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
              <div className="text-center text-zinc-500">Loading summary...</div>
            </div>
          ) : summary && summary.totalTransactions > 0 ? (
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
              <h3 className="text-sm font-medium text-zinc-400 mb-4">Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-zinc-500">Total Transactions</p>
                  <p className="text-lg font-semibold text-zinc-200">
                    {summary.totalTransactions}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Total Value</p>
                  <p className="text-lg font-semibold text-zinc-200">
                    {formatCurrency(summary.totalValue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Installment Transactions</p>
                  <p className="text-lg font-semibold text-zinc-200">
                    {summary.totalInstallmentTransactions}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Installment Value</p>
                  <p className="text-lg font-semibold text-zinc-200">
                    {formatCurrency(summary.totalInstallmentValue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Last Installments</p>
                  <p className="text-lg font-semibold text-zinc-200">
                    {summary.lastInstallmentCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Last Installments Total</p>
                  <p className="text-lg font-semibold text-zinc-200">
                    {formatCurrency(summary.lastInstallmentTotal)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mb-6">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full px-3 py-1.5 pl-8 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              onClick={() => setShowInstallments((v) => !v)}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                showInstallments
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              Installments
            </button>
            <button
              onClick={() => setShowLastInstallment((v) => !v)}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                showLastInstallment
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              Last Installment
            </button>
            <button
              onClick={() => setShowRefunds((v) => !v)}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                showRefunds
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              Refunds
            </button>
            <button
              onClick={() => setShowUncategorized((v) => !v)}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                showUncategorized
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              Uncategorized
            </button>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setShowInstallments(false);
                  setShowLastInstallment(false);
                  setShowRefunds(false);
                  setShowUncategorized(false);
                }}
                className="px-3 py-1.5 text-sm rounded border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-medium text-zinc-200 mb-4">Transactions</h2>
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-x-auto">
          {(data?.length === 0) && !isLoading ? (
            <div className="text-center py-8 text-zinc-500">
              {hasActiveFilters ? "No transactions match your filters." : "No transactions for this bill."}
            </div>
          ) : (
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
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                    Category
                  </th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((transaction) => (
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
                    <td className="px-4 py-3 text-sm text-zinc-300">
                      {transaction.categoryName || (
                        <button
                          onClick={() => setCategorizeTransaction(transaction as Transaction)}
                          className="text-yellow-400 hover:text-yellow-300 text-xs font-medium"
                        >
                          Categorize
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-4 pb-4">
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
        </section>
      </main>
      {categorizeTransaction && billId && (
        <CategorizationModal
          billId={billId}
          initialTransaction={categorizeTransaction}
          onClose={() => setCategorizeTransaction(null)}
          onSaved={fetchTransactions}
        />
      )}
    </div>
  );
}
