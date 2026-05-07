"use client";

import { useState, useEffect, useCallback } from "react";
import { Transaction } from "@/types";
import { CategoryDropdown } from "@/components/CategoryDropdown";

interface CategorizationModalProps {
  billId: string;
  onClose: () => void;
}

export function CategorizationModal({
  billId,
  onClose,
}: CategorizationModalProps) {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showBulkPrompt, setShowBulkPrompt] = useState(false);
  const [matchingTransactions, setMatchingTransactions] = useState<
    { id: number; date: string; description: string; amount: string; installmentNumber?: number | null; totalInstallments?: number | null }[]
  >([]);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<number[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null
  );
  const [selectedCategoryName, setSelectedCategoryName] = useState<
    string | undefined
  >(undefined);
  const [categoryRefreshKey, setCategoryRefreshKey] = useState(0);
  const [skipOffset, setSkipOffset] = useState(0);
  const [remaining, setRemaining] = useState(0);

  const fetchNextTransaction = useCallback(async (skip: number = 0) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/bills/${billId}/next-transaction?skip=${skip}`);
      if (response.status === 404) {
        setTransaction(null);
      } else {
        const data = await response.json();
        setTransaction(data);
        setSelectedCategoryId(data.categoryId);
        setSelectedCategoryName(undefined);
        setRemaining(data.remaining ?? 0);
      }
    } catch (error) {
      console.error("Failed to fetch next transaction:", error);
    } finally {
      setIsLoading(false);
    }
  }, [billId]);

  useEffect(() => {
    fetchNextTransaction(0);
  }, [fetchNextTransaction]);

  const checkMatchingTransactions = useCallback(
    async (description: string, currentTransactionId: number) => {
      try {
        const response = await fetch(
          `/api/transactions/search?description=${encodeURIComponent(description)}&categoryId=null`
        );
        const matching = await response.json();
        const otherMatching = matching.filter(
          (t: { id: number }) => t.id !== currentTransactionId
        );

        if (otherMatching.length > 0) {
          setMatchingTransactions(otherMatching);
          setSelectedTransactionIds(otherMatching.map((t: { id: number }) => t.id));
          setShowBulkPrompt(true);
        } else {
          fetchNextTransaction(0);
        }
      } catch (error) {
        console.error("Failed to check matching transactions:", error);
        fetchNextTransaction(0);
      }
    },
    [fetchNextTransaction]
  );

  const handleSave = async () => {
    if (!transaction || (!selectedCategoryId && !selectedCategoryName)) return;

    setIsSaving(true);
    try {
      const body: { categoryId?: number; categoryName?: string } = {};
      if (selectedCategoryId) {
        body.categoryId = selectedCategoryId;
      } else if (selectedCategoryName) {
        body.categoryName = selectedCategoryName;
      }

      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        // Refresh categories if a new one was created
        if (selectedCategoryName) {
          setCategoryRefreshKey(prev => prev + 1);
        }
        await checkMatchingTransactions(transaction.description, transaction.id);
      }
    } catch (error) {
      console.error("Failed to update transaction:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (!transaction || (!selectedCategoryId && !selectedCategoryName) || selectedTransactionIds.length === 0) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/transactions/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: transaction.description,
          categoryId: selectedCategoryId,
          categoryName: selectedCategoryName,
          transactionIds: selectedTransactionIds,
        }),
      });

      if (response.ok) {
        setShowBulkPrompt(false);
        setMatchingTransactions([]);
        setSelectedTransactionIds([]);
        setSkipOffset(0);
        fetchNextTransaction(0);
      }
    } catch (error) {
      console.error("Failed to bulk update:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedTransactionIds.length === matchingTransactions.length) {
      setSelectedTransactionIds([]);
    } else {
      setSelectedTransactionIds(matchingTransactions.map(t => t.id));
    }
  };

  const handleToggleTransaction = (id: number) => {
    setSelectedTransactionIds(prev =>
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const formatAmount = (amount: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Math.abs(parseFloat(amount)));
  };

  const getAmountClass = (amount: string) => {
    const num = parseFloat(amount);
    return num < 0 ? "text-green-400" : "text-red-400";
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-zinc-900 rounded-lg p-8 text-zinc-200">
          Loading...
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-zinc-900 rounded-lg p-8 max-w-md w-full mx-4">
          <h2 className="text-xl font-semibold text-white mb-4">
            No Pending Transactions
          </h2>
          <p className="text-zinc-400 mb-6">
            All transactions for this bill have been categorized!
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">
            Categorize Transaction
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Date</label>
              <div className="text-zinc-200">{transaction.date}</div>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Amount</label>
              <div className={`font-medium ${getAmountClass(transaction.amount)}`}>
                {formatAmount(transaction.amount)}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Description</label>
            <div className="text-zinc-200">{transaction.description}</div>
          </div>

          {transaction.installmentNumber && transaction.totalInstallments && (
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Installments
              </label>
              <div className="text-zinc-200">
                {transaction.installmentNumber}/{transaction.totalInstallments}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Category</label>
            <CategoryDropdown
              value={selectedCategoryId}
              categoryName={selectedCategoryName}
              onChange={(categoryId, categoryName) => {
                setSelectedCategoryId(categoryId);
                setSelectedCategoryName(categoryName);
              }}
              refreshKey={categoryRefreshKey}
            />
          </div>
        </div>

        {showBulkPrompt && (
          <div className="mb-6 p-4 bg-zinc-800 rounded-lg border border-yellow-600">
            <p className="text-yellow-400 mb-3">
              Found {matchingTransactions.length} transaction(s) with the same description.
              Select which ones to update:
            </p>
            <div className="overflow-x-auto mb-3">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="px-3 py-2 text-left">
                      <input
                        type="checkbox"
                        checked={selectedTransactionIds.length === matchingTransactions.length}
                        onChange={handleSelectAll}
                        className="cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-2 text-left text-sm text-zinc-400">Date</th>
                    <th className="px-3 py-2 text-left text-sm text-zinc-400">Description</th>
                    <th className="px-3 py-2 text-left text-sm text-zinc-400">Installments</th>
                    <th className="px-3 py-2 text-right text-sm text-zinc-400">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {matchingTransactions.map((t) => (
                    <tr key={t.id} className="border-b border-zinc-800">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedTransactionIds.includes(t.id)}
                          onChange={() => handleToggleTransaction(t.id)}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2 text-sm text-zinc-300">{t.date.split("T")[0]}</td>
                      <td className="px-3 py-2 text-sm text-zinc-200">{t.description}</td>
                      <td className="px-3 py-2 text-sm text-zinc-300">
                        {t.installmentNumber && t.totalInstallments
                          ? `${t.installmentNumber}/${t.totalInstallments}`
                          : "-"}
                      </td>
                      <td className={`px-3 py-2 text-sm text-right ${parseFloat(t.amount) < 0 ? "text-green-400" : "text-red-400"}`}>
                        {formatAmount(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleBulkUpdate}
                disabled={isSaving || selectedTransactionIds.length === 0}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white disabled:opacity-50"
              >
                Update Selected ({selectedTransactionIds.length})
              </button>
              <button
                onClick={() => {
                  setShowBulkPrompt(false);
                  setMatchingTransactions([]);
                  setSelectedTransactionIds([]);
                  setSkipOffset(0);
                  fetchNextTransaction(0);
                }}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-200"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving || (!selectedCategoryId && !selectedCategoryName)}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save & Next"}
          </button>
          <button
            onClick={() => {
              const nextSkip = skipOffset + 1;
              setSkipOffset(nextSkip);
              setSelectedCategoryId(null);
              setSelectedCategoryName(undefined);
              fetchNextTransaction(nextSkip);
            }}
            disabled={isSaving}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-200 disabled:opacity-50"
          >
            Skip {remaining > 0 ? `(${remaining} left)` : ""}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
