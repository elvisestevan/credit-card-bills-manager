"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CategoryData {
  name: string;
  total: number;
  count: number;
  percentage: number;
}

interface CategoryPieProps {
  data: CategoryData[];
  selectedCategory: string | null;
  onSelectCategory: (name: string | null) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  alimentacao: "#ef4444",
  transporte: "#3b82f6",
  moradia: "#f59e0b",
  saude: "#10b981",
  educacao: "#8b5cf6",
  lazer: "#ec4899",
  assinaturas: "#06b6d4",
  compras: "#f97316",
  Uncategorized: "#71717a",
};

const FALLBACK_COLORS = [
  "#84cc16", "#14b8a6", "#f43f5e", "#6366f1",
  "#d946ef", "#0ea5e9", "#a855f7", "#22c55e",
  "#eab308", "#78716c",
];

const getColor = (name: string, index: number): string => {
  if (CATEGORY_COLORS[name]) return CATEGORY_COLORS[name];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function CategoryPieChart({ data, selectedCategory, onSelectCategory }: CategoryPieProps) {
  if (data.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
        No categories for this month
      </div>
    );
  }

  const handleClick = (entry: CategoryData) => {
    if (selectedCategory === entry.name) {
      onSelectCategory(null);
    } else {
      onSelectCategory(entry.name);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">Spending by Category</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            innerRadius={50}
            cursor="pointer"
            onClick={(entry) => handleClick(entry as CategoryData)}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={getColor(entry.name, index)}
                opacity={selectedCategory && selectedCategory !== entry.name ? 0.4 : 1}
                stroke={selectedCategory === entry.name ? "#e4e4e7" : "transparent"}
                strokeWidth={selectedCategory === entry.name ? 2 : 0}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #27272a",
              borderRadius: "8px",
              color: "#e4e4e7",
            }}
            formatter={(value: number, name: string) => [formatCurrency(value), name]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
