"use client";

import { useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface CategoryData {
  name: string;
  total: number;
  count: number;
}

interface CategoryBreakdownBarProps {
  data: { monthYear: string; categories: CategoryData[] }[];
}

interface Segment {
  name: string;
  total: number;
  y0: number;
  y1: number;
}

interface ProcessedEntry {
  monthYear: string;
  total: number;
  segments: Segment[];
}

interface HoverInfo {
  name: string;
  total: number;
  color: string;
  monthYear: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const FALLBACK_COLORS = [
  "#a3a635", "#5b8c7a", "#c47a8a", "#7a7ab8",
  "#a87ab8", "#5b8fa8", "#8a7ab8", "#6a9a6a",
  "#b89a5b", "#78716c",
];

const CATEGORY_COLORS: Record<string, string> = {
  alimentacao: "#c47a7a",
  transporte: "#7a9ac4",
  moradia: "#c4a47a",
  saude: "#7ac49a",
  educacao: "#9a7ac4",
  lazer: "#c47a9a",
  assinaturas: "#7ac4c4",
  compras: "#c49a7a",
  Uncategorized: "#78716c",
};

function getCategoryColor(name: string, index: number): string {
  return CATEGORY_COLORS[name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export function CategoryBreakdownBarChart({ data }: CategoryBreakdownBarProps) {
  const [hovered, setHovered] = useState<HoverInfo | null>(null);

  const allUniqueCategories = Array.from(
    new Set(data.flatMap((d) => d.categories.map((c) => c.name)))
  );

  const categoryColorMap = new Map<string, string>();
  allUniqueCategories.forEach((name, idx) => {
    categoryColorMap.set(name, getCategoryColor(name, idx));
  });

  const getColor = (name: string): string =>
    categoryColorMap.get(name) ?? "#71717a";

  const processedData: ProcessedEntry[] = data.map((entry) => {
    const sorted = [...entry.categories].sort((a, b) => b.total - a.total);
    let cumulative = 0;
    const segments = sorted.map((cat) => {
      const y0 = cumulative;
      cumulative += cat.total;
      return { name: cat.name, total: cat.total, y0, y1: cumulative };
    });
    return { monthYear: entry.monthYear, total: cumulative, segments };
  });

  const chartData = processedData.map((d) => ({
    monthYear: d.monthYear,
    total: d.total,
  }));

  const handleMouseEnter = useCallback(
    (seg: Segment, color: string, monthYear: string) =>
      setHovered({ name: seg.name, total: seg.total, color, monthYear }),
    []
  );

  const handleMouseLeave = useCallback(() => setHovered(null), []);

  if (data.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
        No data available
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">
        Category Breakdown by Month
      </h3>

      {hovered && (
        <div className="mb-3 px-3 py-2 bg-zinc-800 rounded border border-zinc-700 inline-block text-sm">
          <span
            className="inline-block w-3 h-3 rounded-sm mr-2 align-middle"
            style={{ backgroundColor: hovered.color }}
          />
          <span className="text-zinc-300 align-middle">{hovered.name}</span>
          <span className="text-zinc-400 mx-2 align-middle">·</span>
          <span className="text-zinc-200 font-medium align-middle">
            {formatCurrency(hovered.total)}
          </span>
          <span className="text-zinc-500 ml-2 align-middle text-xs">
            ({hovered.monthYear})
          </span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="monthYear" stroke="#71717a" tick={{ fontSize: 12 }} />
          <YAxis
            stroke="#71717a"
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => formatCurrency(v)}
            domain={[0, "auto"]}
          />
          <Legend
            content={() => (
              <ul className="flex flex-wrap gap-x-4 gap-y-1 justify-center text-xs text-zinc-400 mt-2">
                {allUniqueCategories.map((name) => (
                  <li key={name} className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: getColor(name) }}
                    />
                    {name}
                  </li>
                ))}
              </ul>
            )}
          />
          <Bar
            dataKey="total"
            isAnimationActive={false}
            shape={(barProps) => {
              const p = barProps as unknown as Record<string, unknown>;
              const x = p.x as number;
              const y = p.y as number;
              const width = p.width as number;
              const height = p.height as number;
              const payload = p.payload as { monthYear: string };

              const entry = processedData.find(
                (d) => d.monthYear === payload.monthYear
              );
              if (!entry || entry.total === 0) return null;

              return (
                <g>
                  {entry.segments.map((seg) => {
                    const segHeight = (seg.total / entry.total) * height;
                    const segY = y + height - (seg.y1 / entry.total) * height;
                    const color = getColor(seg.name);
                    const isDimmed =
                      hovered !== null && hovered.name !== seg.name;

                    return (
                      <rect
                        key={seg.name}
                        x={x}
                        y={segY}
                        width={width}
                        height={Math.max(segHeight, 1)}
                        fill={color}
                        fillOpacity={isDimmed ? 0.2 : 0.75}
                        stroke={
                          hovered?.name === seg.name ? "#e4e4e7" : "none"
                        }
                        strokeWidth={hovered?.name === seg.name ? 1.5 : 0}
                        style={{
                          cursor: "pointer",
                          transition: "opacity 0.15s",
                        }}
                        onMouseEnter={() =>
                          handleMouseEnter(seg, color, entry.monthYear)
                        }
                        onMouseLeave={handleMouseLeave}
                      />
                    );
                  })}
                </g>
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
