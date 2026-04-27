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
bun run test:e2e     # Run E2E tests
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

## E2E Tests (Playwright)
```bash
bun run test:e2e          # Run E2E tests
```

### Adding E2E Tests
1. Create test file in `tests/e2e/` (e.g., `tests/e2e/home.spec.ts`)
2. Use fixtures from `tests/fixtures/` directory
3. Test database: `tests/e2e-test.db` (auto-created with schema)
4. Database resets between tests via `resetTestDatabase()` function

### E2E Test Structure
```typescript
import { test, expect } from "@playwright/test";
import path from "path";

// Test database path
const testDbPath = "/path/to/tests/e2e-test.db";

test.describe("Feature Name", () => {
  test.beforeEach(async () => {
    // Reset database before each test
    const prisma = createPrismaClient(testDbPath);
    await prisma.transaction.deleteMany();
    await prisma.$disconnect();
  });

  test("should do something", async ({ page }) => {
    await page.goto("/");
    // ... test steps
  });
});
```

### E2E Fixtures
Place CSV files in `tests/fixtures/`:
- Format: `data,lançamento,valor`
- Decimal separator: comma (`,`)

## E2E Test Database Setup
```bash
# Create test database with schema (one time)
DATABASE_URL=file:./tests/e2e-test.db bun --bun run prisma migrate dev --name init_e2e
```

Or copy from dev.db:
```bash
cp dev.db tests/e2e-test.db
```
