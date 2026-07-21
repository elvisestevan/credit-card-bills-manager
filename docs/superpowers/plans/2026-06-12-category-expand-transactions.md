# Category Expand Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a category in the dashboard's MonthlySection expands inline to show its transactions.

**Architecture:** Two files modified. MonthlySection fetches transactions from the existing bill transactions API when a category is selected. CategoryBreakdownTable receives the data and renders an expanded sub-row. No new API endpoints or components.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4

---

### Task 1: Add transaction fetching to MonthlySection

**Files:**
- Modify: `src/components/dashboard/MonthlySection.tsx`

- [ ] **Step 1: Add state for category transactions**

After line 64 (`const [categoryIdMap, setCategoryIdMap] = useState<Record<string, number>>({});`), add:

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

- [ ] **Step 2: Clear transactions when monthly data reloads**

In the `fetchMonthlyData` effect, alongside the existing `setSelectedCategory(null)` on line 102, add:

```typescript
setCategoryTransactions([]);
```

- [ ] **Step 3: Add effect to fetch transactions when category is selected**

After the existing trend effect (line 153), add:

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
      const res = await fetch(
        `/api/bills/${selectedBillId}/transactions?categoryId=${categoryId}&limit=50&sortBy=date&sortOrder=desc`
      );
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

- [ ] **Step 4: Pass transactions to CategoryBreakdownTable**

Update the `CategoryBreakdownTable` JSX (lines 212-216) to add the new props:

```tsx
<CategoryBreakdownTable
  data={data.categoryBreakdown}
  selectedCategory={selectedCategory}
  onSelectCategory={setSelectedCategory}
  transactions={categoryTransactions}
  isLoadingTransactions={isLoadingCategoryTransactions}
/>
```

- [ ] **Step 5: Run tests to verify no regressions**

Run: `bun run test`
Expected: All tests pass

### Task 2: Add expanded sub-row to CategoryBreakdownTable

**Files:**
- Modify: `src/components/dashboard/Charts/CategoryBreakdownTable.tsx`

- [ ] **Step 1: Add new props to the interface**

Replace the existing `CategoryTableProps` interface with:

```typescript
interface CategoryTableProps {
  data: CategoryData[];
  selectedCategory: string | null;
  onSelectCategory: (name: string | null) => void;
  transactions: { id: number; date: string; description: string; amount: string }[];
  isLoadingTransactions: boolean;
}
```

- [ ] **Step 2: Update component destructuring**

Replace line 19-23 with:

```typescript
export function CategoryBreakdownTable({
  data,
  selectedCategory,
  onSelectCategory,
  transactions,
  isLoadingTransactions,
}: CategoryTableProps) {
```

- [ ] **Step 3: Add formatAmount helper**

After the existing `formatCurrency` function (line 16-17), add:

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

- [ ] **Step 4: Add expanded sub-row after each category row**

After the closing `</tr>` of each category row (line 66), inside the `sorted.map`, add the expanded row:

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

- [ ] **Step 5: Run tests to verify no regressions**

Run: `bun run test`
Expected: All tests pass
