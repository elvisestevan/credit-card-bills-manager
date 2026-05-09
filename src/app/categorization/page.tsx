"use client";

import { useState, useEffect, useCallback } from "react";
import { Bill } from "@/types";
import { CategorizationModal } from "@/components/CategorizationModal";

export default function CategorizationPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

  const fetchBills = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/bills");
      const data = await response.json();
      if (Array.isArray(data)) {
        const billsWithPending = data.filter(
          (bill: Bill) => bill.pendingCount > 0
        );
        setBills(billsWithPending);
      }
    } catch (error) {
      console.error("Failed to fetch bills:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleCategorize = (billId: string) => {
    setSelectedBillId(billId);
  };

  const handleCloseModal = () => {
    setSelectedBillId(null);
    fetchBills();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-semibold text-white">
            Categorize Transactions
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Assign categories to uncategorized transactions
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <section>
          <h2 className="text-lg font-medium text-zinc-200 mb-4">
            Bills with Pending Transactions
          </h2>
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-8 text-zinc-500">Loading...</div>
            ) : bills.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                No bills with pending transactions. All transactions are categorized!
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                      Bill ID (MM-YYYY)
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">
                      Total Transactions
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">
                      Pending Transactions
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">
                      Pending Amount
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-zinc-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr
                      key={bill.id}
                      className="border-b border-zinc-800 hover:bg-zinc-800/50"
                    >
                      <td className="px-4 py-3 text-sm text-zinc-200 font-medium">
                        {bill.monthYear}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300 text-right">
                        {bill.totalTransactions}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className="text-yellow-400 font-medium">
                          {bill.pendingCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-yellow-400">
                        {formatCurrency(bill.pendingAmount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleCategorize(bill.id)}
                          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded border border-blue-500 text-white transition-colors"
                        >
                          Categorize
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {selectedBillId && (
        <CategorizationModal
          billId={selectedBillId}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
