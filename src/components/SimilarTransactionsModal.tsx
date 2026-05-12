"use client";

import { useState, useEffect } from "react";

interface SimilarTransaction {
  id: number;
  date: string;
  description: string;
  amount: string;
  installmentNumber: number | null;
  totalInstallments: number | null;
  category: { name: string } | null;
}

interface SimilarTransactionsModalProps {
  description: string;
  onClose: () => void;
}

export function SimilarTransactionsModal({
  description,
  onClose,
}: SimilarTransactionsModalProps) {
  const [transactions, setTransactions] = useState<SimilarTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSimilar() {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/transactions/search?description=${encodeURIComponent(description)}`
        );
        if (response.ok) {
          const data = await response.json();
          setTransactions(data);
        }
      } catch (error) {
        console.error("Failed to fetch similar transactions:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSimilar();
  }, [description]);

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg p-8 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Similar Transactions
            </h2>
            <p className="text-sm text-zinc-400 mt-1">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200"
          >
            ×
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-zinc-500">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            No similar transactions found for this description.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Installments</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Category</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-800">
                    <td className="px-4 py-3 text-sm text-zinc-300">
                      {t.date.split("T")[0]}
                    </td>
                    <td className={`px-4 py-3 text-sm ${getAmountClass(t.amount)}`}>
                      {formatAmount(t.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">
                      {t.installmentNumber && t.totalInstallments
                        ? `${t.installmentNumber}/${t.totalInstallments}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">
                      {t.category?.name ?? <span className="text-zinc-500">None</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
