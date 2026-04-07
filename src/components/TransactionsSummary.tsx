"use client";

import { useState, useEffect } from "react";

interface Summary {
  totalTransactions: number;
  totalValue: number;
  totalInstallmentTransactions: number;
  totalInstallmentValue: number;
}

interface TransactionsSummaryProps {
  refreshKey: number;
}

export function TransactionsSummary({ refreshKey }: TransactionsSummaryProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSummary() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/transactions/summary");
        const data = await response.json();
        setSummary(data);
      } catch (error) {
        console.error("Failed to fetch summary:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSummary();
  }, [refreshKey]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
        <div className="text-center text-zinc-500">Loading summary...</div>
      </div>
    );
  }

  if (!summary || summary.totalTransactions === 0) {
    return null;
  }

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      </div>
    </div>
  );
}
