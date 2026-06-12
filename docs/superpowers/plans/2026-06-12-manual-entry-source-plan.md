# Manual Entry Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist last manually-added transactions across page reloads by adding a `source` field to the Transaction model.

**Architecture:** Add `source` column (`"manual"` | `"import"`) to schema, set it on creation, add `source` filter to existing GET endpoint, and replace ManualEntryForm's session-local state with API-backed fetching.

**Tech Stack:** Prisma/SQLite, Next.js App Router, TypeScript, Vitest

---

### Task 1: Schema Migration — Add `source` column

**Files:**
- Modify: `prisma/schema.prisma`
- Create: Prisma migration (via CLI)
- Run: `prisma generate`

- [ ] **Step 1: Add `source` field to Transaction model**

Edit `prisma/schema.prisma:30-48` — add `source` after `createdAt`:

```prisma
model Transaction {
  id                Int        @id @default(autoincrement())
  date              DateTime
  description       String
  userDescription   String?
  amount            Decimal
  cardName          String?
  installmentNumber Int?
  totalInstallments Int?
  transactionType   String     @default("credit_card")
  importId          String
  categoryId        Int?
  category          Category?  @relation(fields: [categoryId], references: [id])
  billId            String
  bill              Bill       @relation(fields: [billId], references: [id])
  createdAt         DateTime   @default(now())
  source            String     @default("import")

  @@index([billId])
  @@index([categoryId])
}
```

- [ ] **Step 2: Create migration**

Run: `bun --bun run prisma migrate dev --name add-source-to-transaction`

- [ ] **Step 3: Run data migration SQL**

Run raw SQL to tag existing C6 transactions as manual:

```
bun --bun run prisma db execute --sql "UPDATE \"Transaction\" SET source = 'manual' WHERE \"cardName\" = 'C6';"
```

Wait — check if Prisma's `db execute` requires a file. Looking at AGENTS.md, it uses `--file`. Let me use that pattern:

```bash
echo "UPDATE \"Transaction\" SET source = 'manual' WHERE \"cardName\" = 'C6';" > /tmp/update-source.sql
bun --bun run prisma db execute --file /tmp/update-source.sql
```

- [ ] **Step 4: Generate Prisma client**

Run: `bun --bun run prisma generate`

---

### Task 2: Add `source` to GET /api/transactions response + filter

**Files:**
- Modify: `src/app/api/transactions/route.ts`

- [ ] **Step 1: Add `source` filter parsing in GET handler**

After the `cardNameFilter` block (line 146-148), add source filter:

```typescript
const source = searchParams.get("source");
if (source === "manual" || source === "import") {
  where.source = source;
}
```

- [ ] **Step 2: Add `source` to response mapping**

In the `data` map (line 183-197), add `source: t.source,` after `transactionType`:

```typescript
const data = transactions.map((t) => ({
  id: t.id,
  date: t.date.toISOString().split("T")[0],
  description: t.description,
  userDescription: t.userDescription,
  amount: t.amount.toString(),
  cardName: t.cardName,
  installmentNumber: t.installmentNumber,
  totalInstallments: t.totalInstallments,
  transactionType: t.transactionType as TransactionType,
  source: t.source,
  categoryId: t.categoryId,
  categoryName: t.category?.name || null,
  billId: t.billId,
  billMonthYear: t.bill.monthYear,
}));
```

- [ ] **Step 3: Update GET test to fix mock data + add source filter test**

Edit `src/app/api/transactions/__tests__/route.test.ts`:

Add `source` to all mock transaction objects (add `source: "import"` after `totalInstallments`).

Also add `source: "import"` to the "should transform transactions correctly" expected output:

```typescript
expect(data.data[0]).toEqual({
  id: 1,
  date: "2024-01-01",
  description: "Test",
  userDescription: null,
  amount: "-100.50",
  cardName: "Itau",
  installmentNumber: 1,
  totalInstallments: 3,
  transactionType: "credit_card",
  source: "import",
  categoryId: null,
  categoryName: null,
  billId: "bill1",
  billMonthYear: "01-2024",
});
```

Add a new test for the `source` filter:

```typescript
it("should filter by source=manual", async () => {
  mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
  mockPrisma.transaction.count.mockResolvedValueOnce(0);
  mockPrisma.transaction.findMany.mockResolvedValueOnce([]);

  const request = new Request("http://localhost:3000/api/transactions?source=manual");
  await GET(request);

  expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        source: "manual",
      }),
    })
  );
});
```

And another for `source=import`.

- [ ] **Step 4: Run tests to verify**

Run: `bun run test -- src/app/api/transactions/__tests__/route.test.ts`

Expected: All tests pass (including new source filter tests).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/app/api/transactions/route.ts src/app/api/transactions/__tests__/route.test.ts
git commit -m "feat: add source field to Transaction model and GET endpoint filter"
```

---

### Task 3: Set `source: "manual"` in POST /api/transactions (manual entry)

**Files:**
- Modify: `src/app/api/transactions/route.ts`

- [ ] **Step 1: Add `source: "manual"` in POST create call**

In the `POST` handler, in the `data` object passed to `prisma.transaction.create` (lines 51-66), add `source: "manual"`:

```typescript
const transaction = await prisma.transaction.create({
  data: {
    date: transactionDate,
    description: description.trim(),
    userDescription: userDescription?.trim() || null,
    amount: new Prisma.Decimal(amount),
    cardName: cardName?.trim() || null,
    installmentNumber: installmentNumber != null ? parseInt(installmentNumber, 10) : null,
    totalInstallments: totalInstallments != null ? parseInt(totalInstallments, 10) : null,
    transactionType: transactionType === "checking_account" ? "checking_account" : "credit_card",
    importId: crypto.randomUUID(),
    source: "manual",
    billId: bill.id,
    categoryId,
  },
  include: { category: true, bill: true },
});
```

- [ ] **Step 2: Add `source` to POST response**

In the response transaction object (lines 70-84), add `source: "manual"`:

```typescript
transaction: {
  id: transaction.id,
  date: transaction.date.toISOString().split("T")[0],
  description: transaction.description,
  userDescription: transaction.userDescription,
  amount: transaction.amount.toString(),
  cardName: transaction.cardName,
  installmentNumber: transaction.installmentNumber,
  totalInstallments: transaction.totalInstallments,
  transactionType: transaction.transactionType,
  source: "manual",
  billId: transaction.billId,
  billMonthYear: transaction.bill.monthYear,
  categoryId: transaction.categoryId,
  categoryName: transaction.category?.name || null,
},
```

- [ ] **Step 3: Verify with a quick test**

Run: `bun run test`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/transactions/route.ts
git commit -m "feat: set source=manual in POST /api/transactions"
```

---

### Task 4: Set `source: "import"` in import routes

**Files:**
- Modify: `src/app/api/transactions/import/route.ts`
- Modify: `src/app/api/transactions/import/checking-account/confirm/route.ts`

- [ ] **Step 1: Add `source: "import"` to credit card import createMany**

In `src/app/api/transactions/import/route.ts` line 114-127, add `source: "import"`:

```typescript
await prisma.transaction.createMany({
  data: newTransactions.map((t) => ({
    date: t.date,
    description: t.description,
    amount: new Prisma.Decimal(t.amount),
    cardName: cardName?.trim() || null,
    installmentNumber: t.installmentNumber,
    totalInstallments: t.totalInstallments,
    transactionType: "credit_card",
    importId: batchImportId,
    source: "import",
    billId: bill.id,
  })),
});
```

- [ ] **Step 2: Add `source: "import"` to checking account confirm createMany**

In `src/app/api/transactions/import/checking-account/confirm/route.ts` line 158-172, add `source: "import"`:

```typescript
await prisma.transaction.createMany({
  data: txns.map((t) => {
    const key = `${t.date.toISOString().split("T")[0]}|${t.description}|${t.amount}`;
    return {
      date: t.date,
      description: t.description,
      userDescription: userDescriptions[key]?.trim() || null,
      categoryId: resolvedCategoryIds.get(key) ?? null,
      amount: new Prisma.Decimal(t.amount),
      transactionType: "checking_account",
      importId: batchImportId,
      source: "import",
      billId,
    };
  }),
});
```

- [ ] **Step 3: Run tests**

Run: `bun run test`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/transactions/import/route.ts src/app/api/transactions/import/checking-account/confirm/route.ts
git commit -m "feat: set source=import in CSV import routes"
```

---

### Task 5: Update ManualEntryForm to fetch recent manual transactions from API

**Files:**
- Modify: `src/components/ManualEntryForm.tsx`

- [ ] **Step 1: Replace session-local state initialization with API fetch**

In `ManualEntryForm.tsx`, replace the initial `useEffect` that sets `date` and `cardName` — keep those lines but add a fetch for recent manual transactions after line 69:

```typescript
useEffect(() => {
  setDate(formatDate(new Date()));
  const savedCardName = localStorage.getItem("addTransactionCardName");
  if (savedCardName) setCardName(savedCardName);
  dateRef.current?.focus();
  fetch("/api/categories")
    .then((r) => r.json())
    .then((data) => {
      if (Array.isArray(data)) setCategories(data.map((c: { name: string }) => c.name));
    })
    .catch(console.error);
  fetchRecentManual();
}, []);

async function fetchRecentManual() {
  try {
    const res = await fetch("/api/transactions?source=manual&limit=5&sortBy=createdAt&sortOrder=desc");
    if (!res.ok) return;
    const data = await res.json();
    if (data.data) {
      setRecentTransactions(
        data.data.map((tx: any) => ({
          id: tx.id,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          isNegative: parseFloat(tx.amount) < 0,
        }))
      );
    }
  } catch {
    // Ignore network errors
  }
}
```

- [ ] **Step 2: Refetch after successful POST**

In the `handleSubmit` function, after the success block (line 164-173), replace the local state prepend with a refetch:

```typescript
if (cardName.trim()) {
  localStorage.setItem("addTransactionCardName", cardName.trim());
}

fetchRecentManual();

setMessage({ type: "success", text: "Adicionada!" });
resetForm();

setTimeout(() => setMessage(null), 1500);
```

- [ ] **Step 3: Move `fetchRecentManual` before useEffect so it can be called from handleSubmit**

Define `fetchRecentManual` as a standalone function inside the component, before the first `useEffect` (after the refs):

```typescript
async function fetchRecentManual() {
  try {
    const res = await fetch("/api/transactions?source=manual&limit=5&sortBy=createdAt&sortOrder=desc");
    if (!res.ok) return;
    const data = await res.json();
    if (data.data) {
      setRecentTransactions(
        data.data.map((tx: any) => ({
          id: tx.id,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          isNegative: parseFloat(tx.amount) < 0,
        }))
      );
    }
  } catch {
    // Ignore network errors
  }
}
```

Then call it in the `useEffect` dependencies and in `handleSubmit`.

- [ ] **Step 4: Run tests**

Run: `bun run test`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ManualEntryForm.tsx
git commit -m "feat: fetch recent manual transactions from API in ManualEntryForm"
```
