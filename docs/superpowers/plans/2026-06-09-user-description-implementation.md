# User Description Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `userDescription` field to transactions — a user-editable label distinct from the bank-provided `description`.

**Architecture:** Add `userDescription String?` to the Prisma `Transaction` model. Expose it via all transaction API routes (CRUD + search). Add a suggestions endpoint that returns the most common userDescription for a given bank description. Add inline editing in the transaction list table (like the existing CategoryDropdown pattern). Add the field to manual entry and checking account import preview.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Prisma (SQLite), Tailwind CSS v4, Vitest

---

## File Structure

### Files to Create
- `src/app/api/transactions/user-description-suggestions/route.ts` — suggestion endpoint
- `src/app/api/transactions/user-description-suggestions/__tests__/route.test.ts` — suggestion endpoint tests

### Files to Modify
- `prisma/schema.prisma` — add field to Transaction model
- `src/types/index.ts` — add `userDescription` to type interfaces
- `src/app/api/transactions/route.ts` — POST: accept userDescription; GET: include in response + search expansion
- `src/app/api/transactions/[id]/route.ts` — PATCH: accept userDescription
- `src/app/api/transactions/__tests__/route.test.ts` — update GET response assertions
- `src/app/api/transactions/[id]/__tests__/route.test.ts` — add userDescription PATCH test
- `src/app/api/transactions/import/checking-account/preview/route.ts` — no change (userDescription is client-side addition, not in CSV)
- `src/app/api/transactions/import/checking-account/confirm/route.ts` — accept userDescriptions map via FormData
- `src/app/api/transactions/import/[importId]/route.ts` — include userDescription in response
- `src/app/api/bills/[billId]/transactions/route.ts` — include userDescription in GET response
- `src/app/api/bills/[billId]/transactions/__tests__/route.test.ts` — update response assertions
- `src/components/TransactionListView.tsx` — add userDescription column with inline editing
- `src/components/ManualEntryForm.tsx` — add userDescription input with suggestions
- `src/components/CheckingAccountImport.tsx` — add userDescription column to preview rows

---

### Task 1: Database Migration — Add `userDescription` Field

**Files:**
- Modify: `prisma/schema.prisma:25-43`

- [ ] **Step 1: Edit Prisma schema — add `userDescription String?` after `description`**

```
model Transaction {
  id                Int       @id @default(autoincrement())
  date              DateTime
  description       String
  userDescription   String?
  amount            Decimal
  ...
```

- [ ] **Step 2: Create and apply migration**

Run: `bun --bun run prisma migrate dev --name add-user-description`
Expected: migration created and applied to dev.db

- [ ] **Step 3: Generate Prisma client**

Run: `bun --bun run prisma generate`
Expected: client regenerated with new field

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add userDescription field to Transaction model"
```

---

### Task 2: TypeScript Types — Add `userDescription` to Interfaces

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Update `Transaction` interface — add `userDescription`**

```typescript
export interface Transaction {
  id: number;
  date: string;
  description: string;
  userDescription: string | null;
  amount: string;
  installmentNumber: number | null;
  totalInstallments: number | null;
  transactionType?: TransactionType;
  categoryId: number | null;
  categoryName?: string;
}
```

- [ ] **Step 2: Update `TransactionListResponse['data']` — add `userDescription`**

```typescript
export interface TransactionListResponse {
  data: {
    id: number;
    date: string;
    description: string;
    userDescription: string | null;
    amount: string;
    cardName: string | null;
    installmentNumber: number | null;
    totalInstallments: number | null;
    transactionType: TransactionType;
    categoryId: number | null;
    categoryName: string | null;
    billId: string;
    billMonthYear: string | null;
  }[];
  ...
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add userDescription to TypeScript types"
```

---

### Task 3: Suggestions API — New Endpoint

**Files:**
- Create: `src/app/api/transactions/user-description-suggestions/route.ts`
- Create: `src/app/api/transactions/user-description-suggestions/__tests__/route.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect, vi } from "vitest";

const mockPrisma = {
  transaction: {
    groupBy: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

describe("GET /api/transactions/user-description-suggestions", async () => {
  const { GET } = await import("../route");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return most common userDescription for a description", async () => {
    mockPrisma.transaction.groupBy.mockResolvedValueOnce([
      { userDescription: "Netflix", _count: { id: 5 } },
      { userDescription: "Streaming", _count: { id: 2 } },
    ]);

    const request = new Request("http://localhost:3000/api/transactions/user-description-suggestions?description=NETFLIX");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ userDescription: "Netflix", count: 5 });
  });

  it("should return null when no suggestions exist", async () => {
    mockPrisma.transaction.groupBy.mockResolvedValueOnce([]);

    const request = new Request("http://localhost:3000/api/transactions/user-description-suggestions?description=UNKNOWN");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ userDescription: null, count: 0 });
  });

  it("should return 400 when description param is missing", async () => {
    const request = new Request("http://localhost:3000/api/transactions/user-description-suggestions");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("description query parameter is required");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/app/api/transactions/user-description-suggestions/__tests__/route.test.ts`
Expected: FAIL - route module not found

- [ ] **Step 3: Write the implementation**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const description = searchParams.get("description");

    if (!description) {
      return NextResponse.json(
        { error: "description query parameter is required" },
        { status: 400 }
      );
    }

    const results = await prisma.transaction.groupBy({
      by: ["userDescription"],
      where: {
        description,
        userDescription: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    if (results.length === 0) {
      return NextResponse.json({ userDescription: null, count: 0 });
    }

    return NextResponse.json({
      userDescription: results[0].userDescription,
      count: results[0]._count.id,
    });
  } catch (error) {
    console.error("User description suggestions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/app/api/transactions/user-description-suggestions/__tests__/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/transactions/user-description-suggestions/
git commit -m "feat: add userDescription suggestions API endpoint"
```

---

### Task 4: PATCH Route — Accept `userDescription`

**Files:**
- Modify: `src/app/api/transactions/[id]/route.ts`
- Modify: `src/app/api/transactions/[id]/__tests__/route.test.ts`

- [ ] **Step 1: Update PATCH route to also accept userDescription**

Change the destructuring and data passed to `prisma.transaction.update`:

```typescript
const { categoryId, categoryName, userDescription } = body;

...

const updateData: { categoryId?: number | null; userDescription?: string | null } = { categoryId: finalCategoryId };

if (userDescription !== undefined) {
  updateData.userDescription = userDescription || null;
}

const transaction = await prisma.transaction.update({
  where: { id: parseInt(id, 10) },
  data: updateData,
  include: { category: true },
});

return NextResponse.json({
  id: transaction.id,
  date: transaction.date.toISOString().split("T")[0],
  description: transaction.description,
  userDescription: transaction.userDescription,
  amount: transaction.amount.toString(),
  transactionType: transaction.transactionType,
  categoryId: transaction.categoryId,
  categoryName: transaction.category?.name,
});
```

- [ ] **Step 2: Update the PATCH test — add test for userDescription update**

Add at the end of `src/app/api/transactions/[id]/__tests__/route.test.ts`:

```typescript
it("should update userDescription", async () => {
  mockPrisma.transaction.update.mockResolvedValueOnce({
    id: 4,
    date: new Date("2024-04-01"),
    description: "NETFLIX",
    userDescription: "My Netflix",
    amount: { toString: () => "-39.90" },
    categoryId: null,
    category: null,
  });

  const request = new Request("http://localhost:3000/api/transactions/4", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userDescription: "My Netflix" }),
  });
  const response = await PATCH(request, { params: Promise.resolve({ id: "4" }) });
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.userDescription).toBe("My Netflix");
  expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 4 },
      data: { userDescription: "My Netflix", categoryId: null },
    })
  );
});

it("should clear userDescription when set to null", async () => {
  mockPrisma.transaction.update.mockResolvedValueOnce({
    id: 5,
    date: new Date("2024-05-01"),
    description: "Uber",
    userDescription: null,
    amount: { toString: () => "-25" },
    categoryId: null,
    category: null,
  });

  const request = new Request("http://localhost:3000/api/transactions/5", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userDescription: null }),
  });
  const response = await PATCH(request, { params: Promise.resolve({ id: "5" }) });
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.userDescription).toBeNull();
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `bun run test -- src/app/api/transactions/\[id\]/__tests__/route.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/transactions/\[id\]/route.ts src/app/api/transactions/\[id\]/__tests__/route.test.ts
git commit -m "feat: support userDescription in PATCH /api/transactions/[id]"
```

---

### Task 5: POST/GET Transactions Route — Accept & Expose `userDescription`

**Files:**
- Modify: `src/app/api/transactions/route.ts`
- Modify: `src/app/api/transactions/__tests__/route.test.ts`

- [ ] **Step 1: Update POST handler — accept userDescription**

In the destructuring at `route.ts:9`, add `userDescription`:
```typescript
const { date, description, userDescription, amount, cardName, categoryName, installmentNumber, totalInstallments, transactionType } = body;
```

In the `prisma.transaction.create` call at `route.ts:51-65`, add `userDescription`:
```typescript
const transaction = await prisma.transaction.create({
  data: {
    date: transactionDate,
    description: description.trim(),
    userDescription: userDescription?.trim() || null,
    ...
  },
```

In the response at `route.ts:67-83`, add `userDescription`:
```typescript
return NextResponse.json({
  success: true,
  transaction: {
    id: transaction.id,
    date: transaction.date.toISOString().split("T")[0],
    description: transaction.description,
    userDescription: transaction.userDescription,
    ...
  },
});
```

- [ ] **Step 2: Update GET handler — expose userDescription in response data**

In the `data` mapping at `route.ts:180-193`, add userDescription:
```typescript
const data = transactions.map((t) => ({
  id: t.id,
  date: t.date.toISOString().split("T")[0],
  description: t.description,
  userDescription: t.userDescription,
  amount: t.amount.toString(),
  ...
}));
```

- [ ] **Step 3: Update GET handler — expand search to cover userDescription**

At `route.ts:118-121`, expand the OR search to include userDescription:
```typescript
if (search) {
  where.OR = [
    { description: { contains: search } },
    { userDescription: { contains: search } },
    { category: { name: { contains: search } } },
  ];
}
```

- [ ] **Step 4: Update GET tests — add userDescription to mock data**

In `src/app/api/transactions/__tests__/route.test.ts`, add `userDescription: null` to all mock transaction objects and `userDescription: null` to the expected output in all response assertions.

For example, on line 23, change:
```typescript
{ id: 1, date: new Date("2024-01-02"), description: "Test2", amount: { toString: () => "-100" }, cardName: null, installmentNumber: null, totalInstallments: null, categoryId: null, category: null, billId: "bill1", bill: { monthYear: "01-2024" } },
```
to:
```typescript
{ id: 1, date: new Date("2024-01-02"), description: "Test2", userDescription: null, amount: { toString: () => "-100" }, cardName: null, installmentNumber: null, totalInstallments: null, categoryId: null, category: null, billId: "bill1", bill: { monthYear: "01-2024" } },
```

And in the expected output at line 144:
```typescript
expect(data.data[0]).toEqual({
  id: 1,
  date: "2024-01-01",
  description: "Test",
  userDescription: null,
  amount: "-100.50",
  ...
});
```

Apply `userDescription: null` to all mock data objects in this file (find and add to every mock transaction).

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test -- src/app/api/transactions/__tests__/route.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/transactions/route.ts src/app/api/transactions/__tests__/route.test.ts
git commit -m "feat: support userDescription in POST/GET /api/transactions"
```

---

### Task 6: Bill Transactions Route — Expose `userDescription`

**Files:**
- Modify: `src/app/api/bills/[billId]/transactions/route.ts`
- Modify: `src/app/api/bills/[billId]/transactions/__tests__/route.test.ts`

- [ ] **Step 1: Add userDescription to response mapping**

In `route.ts:113-124`, add to the data mapping:
```typescript
const data = transactions.map((t) => ({
  id: t.id,
  date: t.date.toISOString().split("T")[0],
  description: t.description,
  userDescription: t.userDescription,
  amount: t.amount.toString(),
  ...
}));
```

Also expand search at `route.ts:50-55`:
```typescript
if (search) {
  where.OR = [
    { description: { contains: search } },
    { userDescription: { contains: search } },
    { category: { name: { contains: search } } },
  ];
}
```

- [ ] **Step 2: Update tests — add userDescription to mock data**

In `src/app/api/bills/[billId]/transactions/__tests__/route.test.ts`, add `userDescription: null` to all mock transaction objects.

- [ ] **Step 3: Run tests to verify they pass**

Run: `bun run test -- src/app/api/bills/\[billId\]/transactions/__tests__/route.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/bills/\[billId\]/transactions/route.ts src/app/api/bills/\[billId\]/transactions/__tests__/route.test.ts
git commit -m "feat: support userDescription in bill transactions API"
```

---

### Task 7: Import Review API — Expose `userDescription`

**Files:**
- Modify: `src/app/api/transactions/import/[importId]/route.ts`

- [ ] **Step 1: Add userDescription to the select query and response**

In the `select` at `route.ts:13-25`, add `userDescription: true`.

In the `enriched` mapping at `route.ts:65-78`, add:
```typescript
return {
  id: t.id,
  date: t.date.toISOString().split("T")[0],
  description: t.description,
  userDescription: t.userDescription,
  amount: t.amount.toString(),
  ...
};
```

- [ ] **Step 2: Ensure dev server is running (verify with a quick check)**

Run: `bun --bun run build` (catches any type errors)
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/api/transactions/import/\[importId\]/route.ts
git commit -m "feat: expose userDescription in import review API"
```

---

### Task 8: Checking Account Import Confirm — Accept `userDescriptions`

**Files:**
- Modify: `src/app/api/transactions/import/checking-account/confirm/route.ts`

- [ ] **Step 1: Parse userDescriptions from FormData**

After parsing `selectedIndicesRaw` (`route.ts:24-32`), add:
```typescript
const userDescriptionsRaw = formData.get("userDescriptions") as string | null;
let userDescriptions: Record<number, string> = {};
if (userDescriptionsRaw) {
  try {
    userDescriptions = JSON.parse(userDescriptionsRaw);
  } catch {
    // Invalid JSON, ignore
  }
}
```

- [ ] **Step 2: Pass userDescription to createMany**

In the `createMany` data at `route.ts:117-128`, add:
```typescript
data: txns.map((t) => {
  const txKey = `${t.date.toISOString().split("T")[0]}|${t.description}|${t.amount}`;
  return {
    date: t.date,
    description: t.description,
    userDescription: userDescriptions[txKey]?.trim() || null,
    amount: new Prisma.Decimal(t.amount),
    transactionType: "checking_account",
    importId: batchImportId,
    billId,
  };
}),
```

The key format for the map should match the preview item's `date|description|amount` format used in the component.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/transactions/import/checking-account/confirm/route.ts
git commit -m "feat: accept userDescriptions in checking account import confirm"
```

---

### Task 9: Transaction List View — Inline Editable `userDescription` Column

**Files:**
- Modify: `src/components/TransactionListView.tsx`

- [ ] **Step 1: Add a new `UserDescriptionCell` inline component below the `SortIcon`**

Create a small inline component (or function) at the end of the component, before the return:

```typescript
function UserDescriptionCell({ transaction, onUpdate }: {
  transaction: TransactionListResponse["data"][number];
  onUpdate: (id: number, value: string | null) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(transaction.userDescription || "");

  useEffect(() => {
    setValue(transaction.userDescription || "");
  }, [transaction.userDescription]);

  const handleSave = async () => {
    const newValue = value.trim() || null;
    if (newValue === transaction.userDescription) {
      setIsEditing(false);
      return;
    }
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userDescription: newValue }),
      });
      if (response.ok) {
        onUpdate(transaction.id, newValue);
      }
    } catch (error) {
      console.error("Failed to update userDescription:", error);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") { setValue(transaction.userDescription || ""); setIsEditing(false); }
        }}
        autoFocus
        className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-0.5 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
      />
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-zinc-700/50 px-2 py-0.5 rounded -mx-2 text-sm ${
        transaction.userDescription ? "text-zinc-200" : "text-zinc-600 italic"
      }`}
    >
      {transaction.userDescription || "Add label..."}
    </span>
  );
}
```

- [ ] **Step 2: Add import for useState/useEffect**

The file already imports these from React. Also import UserDescriptionCell into the component scope.

- [ ] **Step 3: Add the new th and td in the table**

Add a new `<th>` after the "Description" header (after line 366):
```tsx
<th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
  Label
</th>
```

Add a new `<td>` after the description `<td>` (after line 399):
```tsx
<td className="px-4 py-3 text-sm max-w-[200px]">
  <UserDescriptionCell
    transaction={transaction}
    onUpdate={(id, userDescription) => {
      setData((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, userDescription } : t
        )
      );
    }}
  />
</td>
```

- [ ] **Step 4: Move `UserDescriptionCell` outside the component**

Since `UserDescriptionCell` uses hooks, define it at the module level (outside `TransactionListView`), right before the component definition.

- [ ] **Step 5: Build check**

Run: `bun --bun run build`
Expected: Build succeeds (may show lint warnings, that's OK)

- [ ] **Step 6: Commit**

```bash
git add src/components/TransactionListView.tsx
git commit -m "feat: add inline editable userDescription column to transaction list"
```

---

### Task 10: Manual Entry Form — Add `userDescription` Field

**Files:**
- Modify: `src/components/ManualEntryForm.tsx`

- [ ] **Step 1: Add state for userDescription**

Add after `const [message, setMessage]`:
```typescript
const [userDescription, setUserDescription] = useState("");
const [userDescriptionSuggestions, setUserDescriptionSuggestions] = useState<string | null>(null);
```

- [ ] **Step 2: Add suggestion lookup effect**

Watch the `description` field and fetch suggestions:
```typescript
useEffect(() => {
  const trimmed = description.trim();
  if (!trimmed) {
    setUserDescriptionSuggestions(null);
    return;
  }
  const timer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/transactions/user-description-suggestions?description=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = await res.json();
        setUserDescriptionSuggestions(data.userDescription);
        if (data.userDescription && !userDescription) {
          setUserDescription(data.userDescription);
        }
      }
    } catch {
      // Ignore network errors
    }
  }, 400);
  return () => clearTimeout(timer);
}, [description, userDescription]);
```

- [ ] **Step 3: Reset userDescription in resetForm**

Add to `resetForm()`:
```typescript
setUserDescription("");
```

- [ ] **Step 4: Add the userDescription input field to the form**

Add after the Description field section (after the `</div>` closing the description field at approximately line 252):

```tsx
<div>
  <label className="block text-sm text-zinc-400 mb-1">Label (optional)</label>
  <input
    type="text"
    value={userDescription}
    onChange={(e) => setUserDescription(e.target.value)}
    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-500"
    placeholder="Ex: Minha Netflix"
    autoComplete="off"
  />
  {userDescriptionSuggestions && !userDescription && (
    <p className="text-xs text-zinc-500 mt-1">Suggested: {userDescriptionSuggestions}</p>
  )}
</div>
```

- [ ] **Step 5: Include userDescription in POST body**

In the fetch body at around line 121-129, add `userDescription`:
```typescript
body: JSON.stringify({
  date: parsedDate.toISOString().split("T")[0],
  description: description.trim(),
  userDescription: userDescription.trim() || undefined,
  amount,
  ...
}),
```

- [ ] **Step 6: Build check**

Run: `bun --bun run build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/components/ManualEntryForm.tsx
git commit -m "feat: add userDescription field to manual entry form with suggestions"
```

---

### Task 11: Checking Account Import Preview — Add `userDescription` Column

**Files:**
- Modify: `src/components/CheckingAccountImport.tsx`

- [ ] **Step 1: Add userDescriptions state**

Add after `const [parseErrors, setParseErrors]`:
```typescript
const [userDescriptions, setUserDescriptions] = useState<Record<string, string>>({});
```

- [ ] **Step 2: Fetch suggestion when preview loads**

Add a `useEffect` that fetches suggestions for each unique description in the preview items:
```typescript
useEffect(() => {
  if (items.length === 0) return;
  const uniqueDescriptions = [...new Set(items.map((i) => i.description))];
  const fetchSuggestions = async () => {
    const suggestions: Record<string, string> = {};
    for (const desc of uniqueDescriptions) {
      try {
        const res = await fetch(`/api/transactions/user-description-suggestions?description=${encodeURIComponent(desc)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.userDescription) {
            const key = `${items.find(i => i.description === desc)!.date}|${desc}|${items.find(i => i.description === desc)!.amount}`;
            suggestions[key] = data.userDescription;
          }
        }
      } catch {
        // Ignore
      }
    }
    setUserDescriptions(suggestions);
  };
  fetchSuggestions();
}, [items]);
```

- [ ] **Step 3: Add a userDescription column to the preview table**

Add a `<th>` after the "Description" header:
```tsx
<th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Label</th>
```

Add a `<td>` after the description `<td>` for each row:
```tsx
<td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
  <input
    type="text"
    value={userDescriptions[`${item.date}|${item.description}|${item.amount}`] || ""}
    onChange={(e) => {
      const key = `${item.date}|${item.description}|${item.amount}`;
      setUserDescriptions((prev) => ({ ...prev, [key]: e.target.value }));
    }}
    placeholder="Add label..."
    className="w-full bg-transparent border border-zinc-700 rounded px-2 py-0.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
  />
</td>
```

- [ ] **Step 4: Pass userDescriptions in the confirm request**

In `handleImport` (`route.ts:60-100`), add to the formData:
```typescript
const filledUserDescriptions: Record<string, string> = {};
selectedItems.forEach((item) => {
  const key = `${item.date}|${item.description}|${item.amount}`;
  if (userDescriptions[key]?.trim()) {
    filledUserDescriptions[key] = userDescriptions[key].trim();
  }
});
formData.append("userDescriptions", JSON.stringify(filledUserDescriptions));
```

Where `selectedItems` is derived from `items.filter((i) => i.selected)`.

- [ ] **Step 5: Clear userDescriptions on resetUpload**

Add to `resetUpload`:
```typescript
setUserDescriptions({});
```

- [ ] **Step 6: Build check**

Run: `bun --bun run build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/components/CheckingAccountImport.tsx
git commit -m "feat: add userDescription column to checking account import preview"
```

---

### Task 12: Final Verification — Run All Tests

- [ ] **Step 1: Run the full test suite**

Run: `bun run test`
Expected: All ~77 tests pass (69 existing + 8 new)

- [ ] **Step 2: Run the build**

Run: `bun --bun run build`
Expected: Build succeeds

- [ ] **Step 3: Run lint**

Run: `bun --bun run lint`
Expected: No errors (existing warnings OK)

## Self-Review

**Spec coverage:**
- Data model: Task 1 (schema) + Task 2 (types) ✓
- Suggestions API: Task 3 ✓
- PATCH userDescription: Task 4 ✓
- GET/POST userDescription: Task 5 ✓
- Bill transactions: Task 6 ✓
- Import review API: Task 7 ✓
- Checking account import: Task 8 (API) + Task 11 (UI) ✓
- Transaction list inline editing: Task 9 ✓
- Manual entry form: Task 10 ✓

**Placeholder scan:** All steps contain complete code. No TODOs, TBDs, or "implement later" patterns.

**Type consistency:** `userDescription: string | null` used consistently across all tasks. The PATCH route sends `{ userDescription: "value" }` matching what the TransactionListView sends.

**Scope check:** Single feature, well-bounded. Each task produces independently testable changes.
