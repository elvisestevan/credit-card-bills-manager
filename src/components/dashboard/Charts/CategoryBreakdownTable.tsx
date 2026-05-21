"use client";

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
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function CategoryBreakdownTable({
  data,
  selectedCategory,
  onSelectCategory,
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
            <tr
              key={cat.name}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
