"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bill } from "@/types";
import { FileUpload } from "@/components/FileUpload";

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchBills() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/bills");
        const data = await response.json();
        if (Array.isArray(data)) {
          setBills(data);
        } else {
          setBills([]);
        }
      } catch (error) {
        console.error("Failed to fetch bills:", error);
        setBills([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchBills();
  }, []);

  const handleUploadComplete = () => {
    fetch("/api/bills")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBills(data);
        }
      })
      .catch(console.error);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleBillClick = (billId: string) => {
    router.push(`/bills/${billId}/transactions`);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-semibold text-white">
            Credit Card Bills Manager
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Import your Itau credit card statements
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <section className="mb-8">
          <h2 className="text-lg font-medium text-zinc-200 mb-4">Import CSV</h2>
          <FileUpload onUploadComplete={handleUploadComplete} />
        </section>

        <section>
          <h2 className="text-lg font-medium text-zinc-200 mb-4">Bills</h2>
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-8 text-zinc-500">Loading...</div>
            ) : bills.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                No bills yet. Import a CSV file to create your first bill.
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
                      Total Amount
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">
                      Installment Transactions
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">
                      Installment Amount
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                      Last Updated
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-zinc-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(bills) && bills.map((bill) => (
                    <tr
                      key={bill.id}
                      className="border-b border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                      onClick={() => handleBillClick(bill.id)}
                    >
                      <td className="px-4 py-3 text-sm text-zinc-200 font-medium">
                        {bill.monthYear}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300 text-right">
                        {bill.totalTransactions}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300 text-right font-medium">
                        {formatCurrency(bill.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300 text-right">
                        {bill.totalInstallmentTransactions}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300 text-right font-medium">
                        {formatCurrency(bill.totalInstallmentAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400">
                        {formatDate(bill.lastUpdated)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBillClick(bill.id);
                          }}
                          className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 text-zinc-300 transition-colors"
                        >
                          View
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
    </div>
  );
}
