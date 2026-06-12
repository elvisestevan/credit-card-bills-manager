# Credit Card Bills Manager

## Tech Stack
- **Framework**: Next.js 16 (App Router) with TypeScript
- **Database**: SQLite via Prisma + libsql adapter
- **CSS**: Tailwind CSS v4

## Dev Commands
```bash
bun --bun run dev     # Start dev server (auto-installs & generates if needed)
bun --bun run build   # Production build
bun --bun run lint    # ESLint
bun run test          # Run unit tests
```

**Note**: The `dev` command is idempotent - it automatically runs `bun install` and `prisma generate` when needed (e.g., fresh worktree).

## Prisma Commands
```bash
bun --bun run prisma migrate dev --name <name>   # Create & apply migration
bun --bun run prisma generate                    # Generate Prisma client
bun --bun run prisma studio                       # Open database GUI
```

**Important**: Use `bun --bun run prisma` instead of `npx prisma` because:
- Bun path is at `~/.bun/bin` (not in default PATH)
- `--bun` flag ensures correct runtime

## Database
- File: `dev.db` (in project root, NOT in `prisma/` folder)
- Connection URL: `file:./dev.db`
- Prisma client generated to: `src/generated/prisma/`
- Import path: `@/generated/prisma/client`

## Clear Database
```bash
echo 'DELETE FROM "Transaction";' > /tmp/delete.sql
bun --bun run prisma db execute --file /tmp/delete.sql
```

## Key Files
- `src/lib/parsers/itau.ts` - CSV parser (Itau format)
- `src/lib/parsers/checking-account.ts` - CSV parser (Checking Account format)
- `src/app/api/transactions/import/route.ts` - Import API (credit card)
- `src/app/api/transactions/import/checking-account/preview/route.ts` - Checking account preview API
- `src/app/api/transactions/import/checking-account/confirm/route.ts` - Checking account import API
- `src/app/api/transactions/route.ts` - List API (supports `source` filter: `?source=manual` or `?source=import`)
- Transaction `source` field: `"manual"` | `"import"` — distinguishes manual entries from CSV imports
- `src/app/transactions/add/page.tsx` - Unified add page (tabs: Import CSV / Manual Entry)
- `src/components/FileUpload.tsx` - Credit card CSV upload component
- `src/components/CheckingAccountImport.tsx` - Checking account CSV import component
- `src/components/ManualEntryForm.tsx` - Manual transaction entry form component
- `src/components/TransactionsTable.tsx` - Table component

## CSV Format (Itau)
Columns: `data,lançamento,valor`
- Installments extracted via regex `(\d+)/(\d+)$` appended to description
- Negative amounts = credits/refunds

## CSV Format (Checking Account)
Semicolon-delimited, no header: `date;description;amount`
- Date format: `DD/MM/YYYY`
- Amount: Brazilian format (comma decimal `.` -> `,`, thousands `.` separator)
- **Negation**: All amounts are negated on parse to normalize convention:
  `positive = expense, negative = refund` (same as credit card)
  - CSV debit `-702,45` → stored as `702.45` (expense, red)
  - CSV credit `0,04` → stored as `-0.04` (refund, green)
- Positive amounts after negation = debits/expenses (auto-selected)
- Negative amounts after negation = credits/refunds (auto-unselected)

## ESLint Rules
- `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-unused-vars` are disabled for `src/**/__tests__/**` files in `eslint.config.mjs`
- Use `(global.fetch as any)` pattern for mocking fetch in tests (allowed by rule override)

## Test Files
- `src/lib/parsers/__tests__/itau.test.ts` - Parser unit tests (16 tests)
- `src/lib/parsers/__tests__/checking-account.test.ts` - Checking account parser tests (9 tests)
- `src/app/api/transactions/import/__tests__/route.test.ts` - Import API tests (7 tests)
- `src/app/api/transactions/__tests__/route.test.ts` - List API tests (10 tests)
- `src/app/api/transactions/__tests__/route.post.test.ts` - Create transaction API tests (7 tests)
- `src/app/api/transactions/[id]/__tests__/route.test.ts` - PATCH transaction tests (5 tests)
- `src/app/api/transactions/user-description-suggestions/__tests__/route.test.ts` - User description suggestions tests (3 tests)
- `src/app/api/budget/__tests__/route.test.ts` - Budget API tests (8 tests)
- `src/app/api/bills/__tests__/route.test.ts` - Bills API tests (3 tests)
- `src/app/api/bills/[billId]/transactions/__tests__/route.test.ts` - Bill transactions tests (8 tests)
- `src/components/__tests__/FileUpload.test.tsx` - FileUpload component tests (13 tests)
- `src/components/settings/__tests__/BudgetForm.test.tsx` - BudgetForm component tests (8 tests)

## CI Pipeline
- `.github/workflows/ci.yml` runs on `main`/`master` pushes and PRs
- **test job** requires `DATABASE_URL="file:./dev.db" bun --bun run prisma generate` before `bun run test`
- All 99 tests pass via `vitest` with `jsdom` environment
