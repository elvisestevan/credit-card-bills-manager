"use client";

interface BillOption {
  id: string;
  monthYear: string;
}

export function MonthlyBillsFilter({
  bills,
  selectedBillId,
  onSelect,
}: {
  bills: BillOption[];
  selectedBillId: string;
  onSelect: (billId: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-zinc-400">Select Month:</label>
      <select
        value={selectedBillId}
        onChange={(e) => onSelect(e.target.value)}
        className="px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:outline-none focus:border-zinc-500"
      >
        {bills.map((bill) => (
          <option key={bill.id} value={bill.id}>
            {bill.monthYear}
          </option>
        ))}
      </select>
    </div>
  );
}
