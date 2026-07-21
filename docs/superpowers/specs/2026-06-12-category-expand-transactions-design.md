# Category Expand Transactions Design

## Summary

When a user clicks a category row in the `CategoryBreakdownTable` on the dashboard's MonthlySection, the row expands inline to show individual transactions belonging to that category.

## Architecture

No new API endpoints. No new components. Two existing files are modified:

- `src/components/dashboard/MonthlySection.tsx` — manage state, fetch transactions
- `src/components/dashboard/Charts/CategoryBreakdownTable.tsx` — render expanded sub-row

## Data Flow

1. User clicks a category row in `CategoryBreakdownTable` (or a pie slice in `CategoryPieChart`)
2. `onSelectCategory` toggles `selectedCategory` state in `MonthlySection`
3. A `useEffect` keyed on `[selectedCategory, selectedBillId, categoryIdMap]` fires:
   - If `selectedCategory` is null → clear transactions
   - Otherwise → fetch from `/api/bills/${selectedBillId}/transactions?categoryId=${categoryId}&limit=50&sortBy=date&sortOrder=desc`
4. Result passed to `CategoryBreakdownTable` as `transactions` and `isLoadingTransactions` props
5. Table renders an expanded sub-row when its category matches `selectedCategory`

## Changes

### MonthlySection.tsx

New state:

```typescript
interface CategoryTransaction {
  id: number;
  date: string;
  description: string;
  amount: string;
}

const [categoryTransactions, setCategoryTransactions] = useState<CategoryTransaction[]>([]);
const [isLoadingCategoryTransactions, setIsLoadingCategoryTransactions] = useState(false);
```

New effect (after existing trend effect):

```typescript
useEffect(() => {
  if (!selectedCategory || !selectedBillId || !categoryIdMap[selectedCategory]) {
    setCategoryTransactions([]);
    return;
  }
  const categoryId = categoryIdMap[selectedCategory];
  async function fetchCategoryTransactions() {
    setIsLoadingCategoryTransactions(true);
    try {
      const res = await fetch(`/api/bills/${selectedBillId}/transactions?categoryId=${categoryId}&limit=50&sortBy=date&sortOrder=desc`);
      const json = await res.json();
      setCategoryTransactions(json.data || []);
    } catch (err) {
      console.error("Failed to load category transactions:", err);
      setCategoryTransactions([]);
    } finally {
      setIsLoadingCategoryTransactions(false);
    }
  }
  fetchCategoryTransactions();
}, [selectedCategory, selectedBillId, categoryIdMap]);
```

Clear transactions in the `fetchMonthlyData` effect alongside existing `setSelectedCategory(null)` (already set to null, add setCategoryTransactions([])).

Updated `CategoryBreakdownTable` props:

```tsx
<CategoryBreakdownTable
  data={data.categoryBreakdown}
  selectedCategory={selectedCategory}
  onSelectCategory={setSelectedCategory}
  transactions={categoryTransactions}
  isLoadingTransactions={isLoadingCategoryTransactions}
/>
```

### CategoryBreakdownTable.tsx

New props:

```typescript
interface CategoryTableProps {
  data: CategoryData[];
  selectedCategory: string | null;
  onSelectCategory: (name: string | null) => void;
  transactions: { id: number; date: string; description: string; amount: string }[];
  isLoadingTransactions: boolean;
}
```

Inside the `sorted.map`, after the category `<tr>`, conditionally render:

```tsx
{selectedCategory === cat.name && (
  <tr key={`${cat.name}-expanded`}>
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
                <td className={`px-3 py-2 text-sm text-right font-medium ${parseFloat(t.amount) < 0 ? "text-green-400" : "text-red-400"}`}>
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
```

Add a `formatAmount` helper (mirrors the convention from TransactionListView):

```typescript
const formatAmount = (amount: string) => {
  const num = parseFloat(amount);
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Math.abs(num));
  return num < 0 ? `(${formatted})` : formatted;
};
```

## UX Behavior

- Click category → row highlights + trend chart shows + transactions expand inline below the row
- Click same category again → collapses everything
- Click different category → previous collapses, new expands
- Clicking pie slice in `CategoryPieChart` also triggers the same expansion

## Edge Cases

- **No transactions for category**: Shows "No transactions for this category" inside the expanded row
- **Loading state**: Shows "Loading transactions..." while fetching
- **Category deselected** (clicking same row or switching bills): Transactions cleared automatically
- **Bill changes**: The `fetchMonthlyData` effect already clears `selectedCategory`, which triggers the transaction-clear effect
