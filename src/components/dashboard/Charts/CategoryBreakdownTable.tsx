"use client";

import React from "react";

interface CategoryData {
  name: string;
  total: number;
  count: number;
  percentage: number;
}

interface CategoryTableProps {
  data: CategoryData[];
  selectedCategory: string | null;
  onSelectCategory: (name: string | null) => void;
  transactions: { id: number; date: string; description: string; amount: string }[];
  isLoadingTransactions: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatAmount = (amount: string) => {
  const num = parseFloat(amount);
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Math.abs(num));
  return num < 0 ? `(${formatted})` : formatted;
};

export function CategoryBreakdownTable({
  data,
  selectedCategory,
  onSelectCategory,
  transactions,
  isLoadingTransactions,
}: CategoryTableProps) {
  if (data.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
        No categories for this month
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.total - a.total);

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-zinc-700">
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Category</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Total</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Count</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((cat) => (
            <React.Fragment key={cat.name}>
              <tr
                onClick={() =>
                  onSelectCategory(selectedCategory === cat.name ? null : cat.name)
                }
                className={`border-b border-zinc-800 cursor-pointer transition-colors ${
                  selectedCategory === cat.name
                    ? "bg-zinc-700/50"
                    : "hover:bg-zinc-800/50"
                }`}
              >
                <td className="px-4 py-3 text-sm text-zinc-200 font-medium">{cat.name}</td>
                <td className="px-4 py-3 text-sm text-zinc-300 text-right">
                  {formatCurrency(cat.total)}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-300 text-right">{cat.count}</td>
                <td className="px-4 py-3 text-sm text-zinc-300 text-right">
                  {cat.percentage}%
                </td>
              </tr>
              {selectedCategory === cat.name && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 bg-zinc-800/30">
                    {isLoadingTransactions ? (
                      <div className="text-center text-zinc-500 py-4">Loading transactions...</div>
                    ) : transactions.length === 0 ? (
                      <div className="text-center text-zinc-500 py-4">No transactions for this category</div>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-zinc-700">
                            <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Date</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Description</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((t) => (
                            <tr key={t.id} className="border-b border-zinc-800 last:border-0">
                              <td className="px-3 py-2 text-sm text-zinc-400">{t.date}</td>
                              <td className="px-3 py-2 text-sm text-zinc-200">{t.description}</td>
                              <td
                                className={`px-3 py-2 text-sm text-right font-medium ${
                                  parseFloat(t.amount) < 0 ? "text-green-400" : "text-red-400"
                                }`}
                              >
                                {formatAmount(t.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
