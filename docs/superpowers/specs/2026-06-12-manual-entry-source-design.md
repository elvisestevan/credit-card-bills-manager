# Manual Entry Source — Show Recent Manual Transactions

## Problem

The "Recently Added" section on the Manual Entry page (`/transactions/add?tab=manual`) only tracks transactions in session-local state. It does not persist across page reloads or show previous manual entries from the database.

There is currently no way to distinguish manually entered transactions from CSV-imported ones at the database level, so we cannot query for them.

## Solution

### 1. Schema: Add `source` column

Add a non-nullable `source` field to the `Transaction` model with `@default("import")`:

```
source  String  @default("import")
```

Values: `"manual"` | `"import"`

### 2. Data Migration

The existing two manual transactions (cardName = "C6") need to be updated to `source = "manual"` after the column is added:

```sql
UPDATE "Transaction" SET source = 'manual' WHERE cardName = 'C6';
```

### 3. API Changes

**POST `/api/transactions`** (manual entry):
- Pass `source: "manual"` in the Prisma `create` data
- Return `source` in the response transaction object

**POST `/api/transactions/import`** (credit card CSV):
- Pass `source: "import"` in `createMany` data

**POST `/api/transactions/import/checking-account/confirm`** (checking account CSV):
- Pass `source: "import"` in `createMany` data

**GET `/api/transactions`** (list):
- Add `source` query param filter, same pattern as existing `transactionType` filter:
  ```
  if (source === "manual" || source === "import") {
    where.source = source;
  }
  ```

### 4. Frontend Changes (`ManualEntryForm.tsx`)

- **On mount**: fetch `/api/transactions?source=manual&limit=5&sortBy=createdAt&sortOrder=desc`
- **After successful POST**: refetch the recent list from the API
- This replaces the current session-only `recentTransactions` state with a persisted version
- The table UI stays the same

### 5. Test Updates

- Update `src/app/api/transactions/__tests__/route.test.ts`:
  - POST test: verify response includes `source: "manual"`
  - GET test: add test for `source=manual` filter
- Update `src/app/api/transactions/import/__tests__/route.test.ts`:
  - Verify imported transactions include `source: "import"` in response

### No Changes Needed

- The existing "Recently Added" table UI (date, description, amount columns) stays identical
- No new endpoints — only a new query param on the existing GET
- Import routes already batch-insert with `createMany` and the `@default("import")` handles it, but we set it explicitly for clarity
