"use client";

import { useState, useEffect, useCallback } from "react";
import { TransactionListResponse, Category } from "@/types";
import { CategoryDropdown } from "@/components/CategoryDropdown";

interface TransactionListViewProps {
  fetchUrl: string | ((params: URLSearchParams) => string);
  showBillColumn?: boolean;
}

function UserDescriptionCell({
  transaction,
  onUpdate,
}: {
  transaction: TransactionListResponse["data"][number];
  onUpdate: (id: number, userDescription: string | null) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(transaction.userDescription || "");

  useEffect(() => {
    setValue(transaction.userDescription || "");
  }, [transaction.userDescription]);

  const handleSave = async () => {
    const newValue = value.trim() || null;
    if (newValue === transaction.userDescription) {
      setIsEditing(false);
      return;
    }
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userDescription: newValue }),
      });
      if (response.ok) {
        onUpdate(transaction.id, newValue);
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Failed to update userDescription:", error);
    }
  };

  if (isEditing) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") {
            setValue(transaction.userDescription || "");
            setIsEditing(false);
          }
        }}
        autoFocus
        className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-0.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
      />
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-zinc-700/50 px-2 py-0.5 rounded -mx-2 text-sm ${
        transaction.userDescription ? "text-zinc-200" : "text-zinc-600 italic"
      }`}
    >
      {transaction.userDescription || "Add label..."}
    </span>
  );
}

export function TransactionListView({ fetchUrl, showBillColumn = false }: TransactionListViewProps) {
  const [data, setData] = useState<TransactionListResponse["data"]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [summary, setSummary] = useState<TransactionListResponse["summary"]>(undefined);
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showInstallments, setShowInstallments] = useState(false);
  const [showLastInstallment, setShowLastInstallment] = useState(false);
  const [showRefunds, setShowRefunds] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cardNames, setCardNames] = useState<string[]>([]);
  const [cardNameFilter, setCardNameFilter] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
        }
      })
      .catch(console.error);
    fetch("/api/transactions/card-names")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCardNames(data);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }));
  }, [debouncedSearch, showInstallments, showLastInstallment, showRefunds, categoryFilter, transactionTypeFilter, cardNameFilter]);

  const hasActiveFilters = searchInput || showInstallments || showLastInstallment || showRefunds || categoryFilter !== "" || transactionTypeFilter !== "" || cardNameFilter !== "";

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
      });

      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }
      if (showInstallments) {
        params.set("installments", "true");
      }
      if (showLastInstallment) {
        params.set("lastInstallment", "true");
      }
      if (showRefunds) {
        params.set("refunds", "true");
      }
      if (categoryFilter) {
        params.set("categoryId", categoryFilter);
      }
      if (transactionTypeFilter) {
        params.set("type", transactionTypeFilter);
      }
      if (cardNameFilter) {
        params.set("cardName", cardNameFilter);
      }

      const url = typeof fetchUrl === "function" ? fetchUrl(params) : `${fetchUrl}?${params}`;
      const response = await fetch(url);
      const result = await response.json();

      if (response.ok) {
        setData(result.data || []);
        setPagination(result.pagination);
        setSummary(result.summary);
      } else {
        console.error("Failed to fetch transactions:", result);
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchUrl, pagination.page, pagination.limit, sortBy, sortOrder, debouncedSearch, showInstallments, showLastInstallment, showRefunds, categoryFilter, transactionTypeFilter, cardNameFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getAmountClass = (amount: string) => {
    const num = parseFloat(amount);
    return num < 0 ? "text-green-400" : "text-red-400";
  };

  const handleCategoryChange = async (
    transactionId: number,
    categoryId: number | null,
    categoryName?: string
  ) => {
    try {
      const body: { categoryId?: number | null; categoryName?: string } = {};
      if (categoryName) {
        body.categoryName = categoryName;
      } else {
        body.categoryId = categoryId;
      }

      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const updated = await response.json();
        setData((prev) =>
          prev.map((t) =>
            t.id === transactionId
              ? { ...t, categoryId: updated.categoryId, categoryName: updated.categoryName }
              : t
          )
        );
      }
    } catch (error) {
      console.error("Failed to update category:", error);
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <span className="text-zinc-600">↕</span>;
    return <span>{sortOrder === "asc" ? "↑" : "↓"}</span>;
  };

  if (isLoading && data.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">Loading...</div>
    );
  }

  return (
    <div>
      <div className="mb-6">
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
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-sm rounded border bg-zinc-800 border-zinc-700 text-zinc-200 focus:outline-none focus:border-zinc-500"
          >
            <option value="">All categories</option>
            <option value="null">Uncategorized</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id.toString()}>
                {cat.name}
              </option>
            ))}
          </select>
          <select
            value={transactionTypeFilter}
            onChange={(e) => setTransactionTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-sm rounded border bg-zinc-800 border-zinc-700 text-zinc-200 focus:outline-none focus:border-zinc-500"
          >
            <option value="">All types</option>
            <option value="credit_card">Credit Card</option>
            <option value="checking_account">Checking Account</option>
          </select>
          <select
            value={cardNameFilter}
            onChange={(e) => setCardNameFilter(e.target.value)}
            className="px-3 py-1.5 text-sm rounded border bg-zinc-800 border-zinc-700 text-zinc-200 focus:outline-none focus:border-zinc-500"
          >
            <option value="">All cards</option>
            {cardNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchInput("");
                setShowInstallments(false);
                setShowLastInstallment(false);
                setShowRefunds(false);
                setCategoryFilter("");
                setTransactionTypeFilter("");
                setCardNameFilter("");
              }}
              className="px-3 py-1.5 text-sm rounded border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {summary && data.length > 0 && (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 mb-6">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">
            {hasActiveFilters ? "Filtered Results" : "Results"}
          </h3>
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
      )}

      <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-visible">
        {(data?.length === 0) && !isLoading ? (
          <div className="text-center py-8 text-zinc-500">
            {hasActiveFilters ? "No transactions match your filters." : "No transactions found."}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-700">
                {showBillColumn && (
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                    Bill
                  </th>
                )}
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
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  Label
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  Card
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
                <th className="px-4 py-3 text-center text-sm font-medium text-zinc-400">
                  Type
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
                  {showBillColumn && (
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {transaction.billMonthYear}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-zinc-300">{transaction.date}</td>
                  <td className="px-4 py-3 text-sm text-zinc-200">{transaction.description}</td>
                  <td className="px-4 py-3 text-sm max-w-[200px]">
                    <UserDescriptionCell
                      transaction={transaction}
                      onUpdate={(id, userDescription) => {
                        setData((prev) =>
                          prev.map((t) =>
                            t.id === id ? { ...t, userDescription } : t
                          )
                        );
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {transaction.cardName || "-"}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${getAmountClass(transaction.amount)}`}>
                    {formatAmount(transaction.amount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-zinc-500">
                    {transaction.installmentNumber && transaction.totalInstallments
                      ? `${transaction.installmentNumber}/${transaction.totalInstallments}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      transaction.transactionType === "checking_account"
                        ? "bg-blue-900/40 text-blue-400"
                        : "bg-zinc-800 text-zinc-400"
                    }`}>
                      {transaction.transactionType === "checking_account" ? "CA" : "CC"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-300 min-w-[200px]">
                    <CategoryDropdown
                      value={transaction.categoryId}
                      categoryName={transaction.categoryName || undefined}
                      onChange={(categoryId, categoryName) =>
                        handleCategoryChange(transaction.id, categoryId, categoryName)
                      }
                    />
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
    </div>
  );
}
