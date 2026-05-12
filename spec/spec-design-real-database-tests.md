---
title: Real Database Integration Tests Specification
version: 1.0
date_created: 2026-05-12
tags: [app, design, test, infrastructure, database]
---

# Introduction

This specification defines and evaluates two approaches for introducing real database integration tests into the Credit Card Bills Manager project, which currently relies entirely on mocked Prisma calls for all test coverage.

## 1. Purpose & Scope

### Purpose
Evaluate and recommend an approach to add tests that interact with a real SQLite database (via Prisma) instead of only having mocked database interactions.

### Scope
- Analysis of the current test architecture (7 files, all mocked or no DB)
- Option evaluation (additive vs. replacement)
- Recommendation with rationale
- Implementation plan for the chosen approach

### Audience
Developers working on this project, CI pipeline maintainers.

## 2. Definitions

| Term | Definition |
|------|------------|
| Integration test | A test that exercises the real database layer, including Prisma queries, aggregations, and raw SQL |
| Unit test | A test that isolates a single module/function, with all external dependencies mocked |
| Mocked DB test | A test that replaces `@/lib/db` with `vi.mock()` to avoid real database calls |
| Test database | An ephemeral SQLite database (`:memory:` or temp file) created fresh per test run |
| CI | Continuous Integration — the GitHub Actions pipeline that runs on push/PR |

## 3. Option Analysis

### Option 1: Add new integration tests alongside existing tests (Recommended)
Create dedicated integration test files (e.g., `src/lib/__tests__/*.integration.test.ts`) that use the real Prisma client against an ephemeral SQLite test database. Existing mocked tests remain untouched.

### Option 2: Replace all existing tests to use real database
Modify all 4 API route test files to remove mocking and use a real database instead. Every existing test would need setup/teardown with database transactions.

## 4. Comparative Evaluation

| Criterion | Option 1 (Additive) | Option 2 (Replace All) |
|-----------|---------------------|------------------------|
| **Risk** | Low — existing tests untouched | High — all tests rewritten |
| **Test speed** | Fast unit tests + slow integration tests are separated | All tests become slower (database overhead) |
| **CI impact** | Can run in parallel or separate job | Single test job, all tests slower |
| **Maintenance** | Low — new tests in new files | High — every existing test refactored |
| **Value added** | Tests what mocking cannot (real queries, aggregations, raw SQL, Prisma behavior) | Tests the same handler logic but with real DB |
| **Coverage type** | Adds missing integration coverage | Changes unit tests to integration tests |
| **Setup complexity** | Moderate — needs test DB config, prisma migration in CI | High — every test needs transactional isolation |

### Why Option 1 is better

The current mocked tests serve a valuable purpose: they are **fast** and **precise** — they verify that the handler calls Prisma with the correct arguments. This is the correct approach for testing handler logic (routing, parameter parsing, error handling, response formatting).

What's missing is **coverage of the database layer itself**: complex queries, aggregations (`_count`, `sum`, raw `toNumber()` calls), pagination correctness with real data, and the interaction between Prisma and SQLite.

Option 1 fills this gap without sacrificing the existing fast feedback loop. Option 2 would make every test slower and more complex without adding meaningful coverage that Option 1 doesn't already provide.

## 5. Requirements

- **REQ-001**: All existing tests must continue to pass unchanged.
- **REQ-002**: Integration tests must use an ephemeral SQLite database (in-memory or temp file).
- **REQ-003**: Each integration test run must start with a clean database state.
- **REQ-004**: The Prisma schema must be applied (via `prisma migrate deploy` or `prisma db push`) before integration tests run.
- **REQ-005**: Integration tests must clean up after themselves (either via database transactions or drop/truncate after each test/suite).
- **REQ-006**: CI must run integration tests (either in a separate job or as part of the test job with proper DB setup).
- **REQ-007**: The test database URL must not collide with the development database (`dev.db`).

## 6. Constraints

- **CON-001**: `@prisma/adapter-libsql` is used in production — the test database must use the same adapter to be a true integration test.
- **CON-002**: SQLite `:memory:` databases with `libsql` adapter may not support multi-connection access; a temp file may be safer.
- **CON-003**: Prisma client is generated to `src/generated/prisma/` — tests must import from `@/generated/prisma/client`.
- **CON-004**: Tests run via `vitest` with `jsdom` or `node` environment — integration tests must use `node` environment.

## 7. Acceptance Criteria

- **AC-001**: Given the existing test suite, when `vitest` is run, all existing mocked tests still pass.
- **AC-002**: Given a `DATABASE_URL` pointing to a temp SQLite file, when integration tests run, they create tables and interact with them without error.
- **AC-003**: Given integration tests that insert and query data, when the test completes, the temporary database is removed (or cleaned).
- **AC-004**: Given the CI pipeline, when a PR is opened, integration tests run against a clean database.
- **AC-005**: Given integration tests that test aggregation queries (e.g., bill totals), the results match expected SQLite behavior.

## 8. Implementation Plan (Option 1)

### 8.1 Vitest Configuration
Add a separate vitest workspace entry or environment configuration for integration tests:

```typescript
// vitest.config.ts additions
export const integrationTestConfig = defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    exclude: ["node_modules", "dist"],
    pool: "forks",
    setupFiles: ["./vitest.integration.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### 8.2 Integration Test Database Setup
Create a setup file that:
1. Reads `DATABASE_URL` or defaults to `file:./test.db`
2. Runs `prisma db push` to apply schema (or uses `prisma migrate deploy`)
3. Provides a helper to wrap tests in database transactions for isolation

```typescript
// vitest.integration.setup.ts
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { afterAll, beforeAll } from "vitest";

const databaseUrl = process.env.INTEGRATION_DATABASE_URL || "file:./test.db";

const adapter = new PrismaLibSql({ url: databaseUrl });
export const prisma = new PrismaClient({ adapter });

beforeAll(async () => {
  // Ensure tables exist
  await prisma.$executeRawUnsafe("SELECT 1");
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### 8.3 Test Transaction Helper
Create a helper function that wraps each test (or each suite) in a database transaction that rolls back after the test.

**Note**: SQLite with `libsql` adapter may not support nested/interactive transactions. An alternative is to use `prisma db push` before each test file and delete the test database file after, or use `DELETE FROM` statements in `beforeEach`.

### 8.4 Integration Test Files to Create

| File | What it tests | Priority |
|------|---------------|----------|
| `src/lib/__tests__/transactions.integration.test.ts` | CRUD operations, pagination, sorting, filtering with real data | High |
| `src/lib/__tests__/bills.integration.test.ts` | Bill aggregation queries (`_count`, `sum`), monthly grouping | High |
| `src/lib/__tests__/import.integration.test.ts` | Full import flow: CSV parse -> DB insert -> duplicate detection | High |
| `src/lib/__tests__/categories.integration.test.ts` | Category relationships (if categories feature added) | Medium |

### 8.5 CI Pipeline Update

```yaml
jobs:
  integration-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: DATABASE_URL="file:./test.db" bun --bun run prisma db push
      - run: INTEGRATION_DATABASE_URL="file:./test.db" bun run vitest --config vitest.integration.config.ts
```

### 8.6 Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:integration": "INTEGRATION_DATABASE_URL=file:./test.db vitest --config vitest.integration.config.ts"
  }
}
```

## 9. Example Integration Test

```typescript
// src/lib/__tests__/bills.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./setup";

describe("Bill aggregation queries", () => {
  beforeAll(async () => {
    // Seed test data
    await prisma.bill.create({
      data: {
        id: "test-bill-1",
        monthYear: "05-2026",
        transactions: {
          create: [
            { date: new Date("2026-05-01"), description: "Purchase 1", amount: 100, importId: "imp-1" },
            { date: new Date("2026-05-02"), description: "Purchase 2", amount: 200, importId: "imp-1" },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany();
    await prisma.bill.deleteMany();
  });

  it("should return correct total amount for a bill", async () => {
    const bills = await prisma.bill.findMany({
      include: { _count: { select: { transactions: true } } },
    });
    expect(bills).toHaveLength(1);
    expect(bills[0]._count.transactions).toBe(2);
  });
});
```

## 10. Rationale & Context

The current test suite does an excellent job of testing handler logic with mocked dependencies. However, it cannot catch bugs in:

- Prisma query generation (e.g., incorrect `orderBy`, `where` clause composition)
- SQLite-specific behavior (e.g., Decimal handling, date sorting)
- Complex aggregation logic (e.g., `_count`, `sum` in bill endpoints)
- Data integrity (e.g., cascade deletes, unique constraints, type coercion)

These are exactly the kinds of bugs that a real database integration test catches. By adding separate integration tests (Option 1), we get the best of both worlds:

- **Fast unit tests** for handler logic (existing tests, unchanged)
- **Thorough integration tests** for database behavior (new tests)

Option 2 would conflate these concerns — tests would be slower, harder to maintain, and would lose the precise "did my handler call the right Prisma method?" assertions that mocked tests excel at.

## 11. Dependencies & External Integrations

### Technology Platform Dependencies
- **PLT-001**: SQLite via `@prisma/adapter-libsql` — test DB must use the same adapter as production
- **PLT-002**: Vitest 1.6.0 — test runner, workspace configuration
- **PLT-003**: Prisma 7.6.0 — schema management, client generation

### Infrastructure Dependencies
- **INF-001**: Ephemeral SQLite file (`test.db` or `:memory:`) — cleaned up after test run
- **INF-002**: CI must have write permissions to create temp database files

## 12. Validation Criteria

1. `bun run test` passes with all 48+ existing tests unchanged
2. `bun run test:integration` passes with new integration tests
3. CI pipeline includes both test jobs
4. Test database is cleaned up after CI run (gitignored if temp file)
5. All test data is isolated per run (no test pollution)

## 13. Related Specifications / Further Reading

- `spec/spec-design-multiple-bills.md` — Bills feature that defines the aggregation logic to be tested
- `spec/spec-design-transaction-categorization.md` — Categories feature
- AGENTS.md — Dev commands and conventions
