# Credit Card Bills Manager

## Tech Stack
- **Framework**: Next.js 16 (App Router) with TypeScript
- **Database**: SQLite via Prisma + libsql adapter
- **CSS**: Tailwind CSS v4

## Dev Commands
```bash
bun install           # Install dependencies
bun --bun run dev     # Start dev server (http://localhost:3000)
bun --bun run build   # Production build
bun --bun run lint    # ESLint
bun run test          # Run unit tests
```

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

## Test Files
- `src/lib/parsers/__tests__/itau.test.ts` - Parser unit tests (15 tests)
- `src/app/api/transactions/import/__tests__/route.test.ts` - Import API tests (5 tests)
- `src/app/api/transactions/__tests__/route.test.ts` - List API tests (8 tests)
