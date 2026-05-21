"use client";

import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";

interface DailyCumulative {
  dayOfMonth: number;
  runningTotal: number;
}

interface BudgetProjectionProps {
  dailyCumulative: DailyCumulative[];
  budgetGoal: number;
  daysInMonth: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function BudgetProjectionChart({
  dailyCumulative,
  budgetGoal,
  daysInMonth,
}: BudgetProjectionProps) {
  if (dailyCumulative.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
        No transaction data for this month
      </div>
    );
  }

  const lastDay =
    dailyCumulative.length > 0
      ? dailyCumulative[dailyCumulative.length - 1].dayOfMonth
      : daysInMonth;

  const budgetData = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const prorated = (budgetGoal / daysInMonth) * Math.min(day, lastDay);
    budgetData.push({
      day,
      proratedBudget: Math.min(prorated, budgetGoal),
    });
  }

  const mergedData = budgetData.map((bd) => {
    const cumEntry = dailyCumulative.find((d) => d.dayOfMonth === bd.day);
    return {
      day: bd.day,
      cumulativeSpending: cumEntry?.runningTotal ?? null,
      proratedBudget: bd.proratedBudget,
    };
  });

  const lastCumulative =
    dailyCumulative.length > 0
      ? dailyCumulative[dailyCumulative.length - 1].runningTotal
      : 0;
  const isOverBudget = lastCumulative > (budgetGoal / daysInMonth) * lastDay;

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">
        Budget Projection — Goal: {formatCurrency(budgetGoal)}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={mergedData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="day"
            stroke="#71717a"
            tick={{ fontSize: 12 }}
            label={{ value: "Day of Month", position: "insideBottom", offset: -5, fill: "#71717a", fontSize: 12 }}
          />
          <YAxis
            stroke="#71717a"
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => formatCurrency(v)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #27272a",
              borderRadius: "8px",
              color: "#e4e4e7",
            }}
            formatter={((value: unknown, name: string) => {
              if (value === null || value === undefined) return ["N/A", name];
              return [formatCurrency(Number(value)), name === "cumulativeSpending" ? "Cumulative" : "Prorated Budget"];
            }) as any}
          />
          <ReferenceLine
            y={budgetGoal}
            stroke="#f59e0b"
            strokeDasharray="5 5"
            label={{ value: "Goal", fill: "#f59e0b", fontSize: 12, position: "right" }}
          />
          <Area
            type="monotone"
            dataKey="cumulativeSpending"
            fill={isOverBudget ? "#ef444440" : "#10b98140"}
            stroke={isOverBudget ? "#ef4444" : "#10b981"}
            strokeWidth={2}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="proratedBudget"
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
