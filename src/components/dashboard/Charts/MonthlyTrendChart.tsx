"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MonthlyTrendProps {
  data: { monthYear: string; totalAmount: number }[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function MonthlyTrendChart({ data }: MonthlyTrendProps) {
  if (data.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
        No data available
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">Monthly Spending Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="monthYear" stroke="#71717a" tick={{ fontSize: 12 }} />
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
            formatter={(value: number) => [formatCurrency(value), "Total"]}
          />
          <Line
            type="monotone"
            dataKey="totalAmount"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: "#3b82f6", r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
