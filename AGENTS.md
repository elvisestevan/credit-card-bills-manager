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
- `src/app/api/transactions/import/route.ts` - Import API
- `src/app/api/transactions/route.ts` - List API
- `src/components/FileUpload.tsx` - Upload component
- `src/components/TransactionsTable.tsx` - Table component

## CSV Format (Itau)
Columns: `data,lançamento,valor`
- Installments extracted via regex `(\d+)/(\d+)$` appended to description
- Negative amounts = credits/refunds

## ESLint Rules
- `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-unused-vars` are disabled for `src/**/__tests__/**` files in `eslint.config.mjs`
- Use `(global.fetch as any)` pattern for mocking fetch in tests (allowed by rule override)

## Test Files
- `src/lib/parsers/__tests__/itau.test.ts` - Parser unit tests (15 tests)
- `src/app/api/transactions/import/__tests__/route.test.ts` - Import API tests (1 test)
- `src/app/api/transactions/__tests__/route.test.ts` - List API tests (8 tests)
- `src/components/__tests__/FileUpload.test.tsx` - FileUpload component tests (9 tests)
- `src/components/__tests__/TransactionsTable.test.tsx` - TransactionsTable component tests (15 tests)

## CI Pipeline
- `.github/workflows/ci.yml` runs on `main`/`master` pushes and PRs
- **test job** requires `DATABASE_URL="file:./dev.db" bun --bun run prisma generate` before `bun run test`
- All 48 tests pass via `vitest` with `jsdom` environment
