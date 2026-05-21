"use client";

import { useState, useEffect } from "react";
import { SummaryCards } from "./SummaryCards";
import { MonthlyBillsFilter } from "./MonthlyBillsFilter";
import { BudgetProjectionChart } from "./Charts/BudgetProjectionChart";
import { CategoryPieChart } from "./Charts/CategoryPieChart";
import { CategoryBreakdownTable } from "./Charts/CategoryBreakdownTable";
import { CategoryTrendChart } from "./Charts/CategoryTrendChart";

interface BillOption {
  id: string;
  monthYear: string;
}

interface DailyCumulative {
  dayOfMonth: number;
  runningTotal: number;
}

interface CategoryData {
  name: string;
  total: number;
  count: number;
  percentage: number;
}

interface MonthlyData {
  bill: {
    id: string;
    monthYear: string;
    totalAmount: number;
    totalTransactions: number;
  };
  dailyCumulative: DailyCumulative[];
  categoryBreakdown: CategoryData[];
  budgetGoal: number;
  lastTransactionDate: string | null;
  daysInMonth: number;
  remainingBudget: number;
}

interface TrendPoint {
  monthYear: string;
  total: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function MonthlySection() {
  const [bills, setBills] = useState<BillOption[]>([]);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [data, setData] = useState<MonthlyData | null>(null);
  const [isLoadingBills, setIsLoadingBills] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [trendCategoryName, setTrendCategoryName] = useState<string>("");
  const [categoryIdMap, setCategoryIdMap] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchBills() {
      try {
        const res = await fetch("/api/bills");
        const json = await res.json();
        if (Array.isArray(json)) {
          const options = json as BillOption[];
          setBills(options);
          if (options.length > 0) {
            setSelectedBillId(options[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load bills:", err);
      } finally {
        setIsLoadingBills(false);
      }
    }
    fetchBills();
  }, []);

  useEffect(() => {
    if (!selectedBillId) return;

    async function fetchMonthlyData() {
      setIsLoadingData(true);
      setSelectedCategory(null);
      setTrendData([]);
      try {
        const res = await fetch(`/api/dashboard/monthly?billId=${selectedBillId}`);
        const json = await res.json();
        setData(json);

        const catRes = await fetch("/api/categories");
        const catJson = await catRes.json();
        if (Array.isArray(catJson)) {
          const map: Record<string, number> = {};
          for (const cat of catJson) {
            map[cat.name] = cat.id;
          }
          setCategoryIdMap(map);
        }
      } catch (err) {
        console.error("Failed to load monthly data:", err);
      } finally {
        setIsLoadingData(false);
      }
    }
    fetchMonthlyData();
  }, [selectedBillId]);

  useEffect(() => {
    if (!selectedCategory || !categoryIdMap[selectedCategory]) {
      setTrendData([]);
      return;
    }

    const categoryId = categoryIdMap[selectedCategory];

    async function fetchTrend() {
      try {
        const res = await fetch(`/api/dashboard/category-trend?categoryId=${categoryId}`);
        const json = await res.json();
        setTrendData(json.trend || []);
        setTrendCategoryName(json.categoryName || selectedCategory);
      } catch (err) {
        console.error("Failed to load category trend:", err);
        setTrendData([]);
      }
    }
    fetchTrend();
  }, [selectedCategory, categoryIdMap]);

  if (isLoadingBills) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
        Loading monthly section...
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
        No bills available. Import a CSV file to get started.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-zinc-200">Monthly Drill-Down</h2>
        <MonthlyBillsFilter
          bills={bills}
          selectedBillId={selectedBillId || ""}
          onSelect={setSelectedBillId}
        />
      </div>

      {isLoadingData ? (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
          Loading...
        </div>
      ) : data ? (
        <>
          <SummaryCards
            cards={[
              { label: "Total Spent", value: formatCurrency(data.bill.totalAmount) },
              { label: "Transactions", value: String(data.bill.totalTransactions) },
              {
                label: "Remaining Budget",
                value: formatCurrency(data.remainingBudget),
                highlight: data.remainingBudget < 0,
              },
            ]}
          />

          <BudgetProjectionChart
            dailyCumulative={data.dailyCumulative}
            budgetGoal={data.budgetGoal}
            daysInMonth={data.daysInMonth}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CategoryPieChart
              data={data.categoryBreakdown}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
            <CategoryBreakdownTable
              data={data.categoryBreakdown}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>

          {selectedCategory && trendData.length > 0 && (
            <CategoryTrendChart
              categoryName={trendCategoryName}
              data={trendData}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
