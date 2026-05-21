"use client";

interface SummaryCard {
  label: string;
  value: string;
  highlight?: boolean;
}

export function SummaryCards({ cards }: { cards: SummaryCard[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`bg-zinc-900 rounded-lg border p-4 ${
            card.highlight
              ? "border-yellow-600/50"
              : "border-zinc-800"
          }`}
        >
          <p className="text-xs text-zinc-500">{card.label}</p>
          <p
            className={`text-lg font-semibold mt-1 ${
              card.highlight ? "text-yellow-400" : "text-zinc-200"
            }`}
          >
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
