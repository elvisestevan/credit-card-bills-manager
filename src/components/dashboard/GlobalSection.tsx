"use client";

import { useState, useEffect } from "react";
import { SummaryCards } from "./SummaryCards";
import { MonthlyTrendChart } from "./Charts/MonthlyTrendChart";
import { CategoryBreakdownBarChart } from "./Charts/CategoryBreakdownBarChart";

interface GlobalData {
  bills: { monthYear: string; totalAmount: number }[];
  categoryBreakdown: {
    monthYear: string;
    categories: { name: string; total: number; count: number }[];
  }[];
  summary: {
    totalBills: number;
    totalSpending: number;
    averageMonthly: number;
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function GlobalSection() {
  const [data, setData] = useState<GlobalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/dashboard/global");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to load global dashboard data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
        Loading global data...
      </div>
    );
  }

  if (!data || data.bills.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
        No data available. Import a CSV file to get started.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-zinc-200">Global Analysis</h2>
      </div>
      <SummaryCards
        cards={[
          { label: "Total Bills", value: String(data.summary.totalBills) },
          { label: "Total Spending", value: formatCurrency(data.summary.totalSpending) },
          { label: "Average per Month", value: formatCurrency(data.summary.averageMonthly) },
        ]}
      />
      <MonthlyTrendChart data={data.bills} />
      <CategoryBreakdownBarChart data={data.categoryBreakdown} />
    </div>
  );
}
