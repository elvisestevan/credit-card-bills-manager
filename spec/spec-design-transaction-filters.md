---
title: Transaction Listing Filters & Search
date_created: 2026-05-09
tags: design, frontend, api
---

# Transaction Listing Filters & Search

## 1. Purpose & Scope

Add client-side search and filter capabilities to the bill-specific transactions listing page. Users can search by free text and toggle three categorical filters to narrow down displayed transactions.

## 2. Definitions

- **Installment Transaction**: A transaction where `installmentNumber` and `totalInstallments` are both non-null
- **Last Installment**: A transaction where `installmentNumber = totalInstallments` (both non-null)
- **Refund**: A transaction with a negative `amount` value

## 3. Requirements

- **REQ-001**: The page shall include a free-text search input that filters transactions by description (contains match)
- **REQ-002**: The page shall include a toggle button "Installments" that filters to transactions with installment data
- **REQ-003**: The page shall include a toggle button "Last Installment" that filters to transactions in their final installment
- **REQ-004**: The page shall include a toggle button "Refunds" that filters to transactions with negative amounts
- **REQ-005**: All active filters shall combine with AND logic
- **REQ-006**: Changing any filter or search text shall reset pagination to page 1
- **REQ-007**: Search input shall be debounced by 300ms to avoid excessive API calls
- **REQ-008**: Active filter buttons shall be visually distinct from inactive ones
- **REQ-009**: A "Clear filters" button shall appear when any filter or search is active
- **CON-001**: The `lastInstallment` filter must correctly compare `installmentNumber = totalInstallments` — Prisma's typed `where` cannot express this directly, so a raw SQL query for IDs is required
- **PAT-001**: Follow existing code patterns: client component, `useState`/`useEffect`/`useCallback`, `fetch` with `URLSearchParams`

## 4. Interfaces & Data Contracts

### API: GET `/api/bills/[billId]/transactions`

Extended query parameters:

| Param | Type | Required | Description |
|---|---|---|---|
| `page` | int | No (default 1) | Page number |
| `limit` | int | No (default 20) | Items per page |
| `sortBy` | "date"\|"amount"\|"description" | No (default "date") | Sort field |
| `sortOrder` | "asc"\|"desc" | No (default "desc") | Sort direction |
| `search` | string | No | Description contains filter |
| `installments` | "true" | No | Filter to installment transactions |
| `lastInstallment` | "true" | No | Filter to last installment transactions |
| `refunds` | "true" | No | Filter to negative amounts |

### Filter composition (backend logic):

```
where = { billId }

if search:
  where.description = { contains: search }

if refunds:
  where.amount = { lt: 0 }

if lastInstallment:
  ids = rawQuery(SELECT id FROM Transaction WHERE billId=? AND installmentNumber IS NOT NULL AND totalInstallments IS NOT NULL AND installmentNumber = totalInstallments)
  where.id = { in: ids }
else if installments:
  ids = rawQuery(SELECT id FROM Transaction WHERE billId=? AND installmentNumber IS NOT NULL)
  where.id = { in: ids }

transactions = findMany(where, skip, take, orderBy, include category)
count = count(where)
```

## 5. Acceptance Criteria

- **AC-001**: Given the transactions page, when the user types "mercado" in the search bar, only transactions with "mercado" in the description are shown
- **AC-002**: Given the transactions page, when the user clicks "Installments", only transactions with non-null `installmentNumber` are shown
- **AC-003**: Given the transactions page, when the user clicks "Last Installment", only transactions where `installmentNumber = totalInstallments` are shown
- **AC-004**: Given the transactions page, when the user clicks "Refunds", only transactions with negative `amount` are shown
- **AC-005**: Given multiple active filters, when the user applies "Installments" + "Refunds", only refunds that are also installment transactions are shown
- **AC-006**: Given an active filter, when the user navigates to page 2 and changes a filter, pagination resets to page 1
- **AC-007**: Given no matching transactions for active filters, the table shows a "No transactions match your filters" empty state
- **AC-008**: Given an active search with text, when the user clears the search input, all transactions for the bill are shown again (respecting other active filters)

## 6. Test Automation Strategy

**Test Levels**: Unit tests for the API route.

**Approach**:
- Create `src/app/api/bills/[billId]/transactions/__tests__/route.test.ts`: Test each filter param independently and combined. Cover empty results and edge cases.
- Use the same mocking pattern as existing test files (mock prisma with vitest).

## 7. Rationale & Context

- **Raw SQL for installment comparison**: Prisma's typed where clause cannot express column-to-column comparisons (`installmentNumber = totalInstallments`). A preliminary raw query for IDs is the minimal approach that preserves Prisma's type safety for the main query.
- **Debounced search**: 300ms balances responsiveness with avoiding unnecessary requests.
- **Toggle buttons vs checkboxes**: Buttons are more discoverable and match the expected UX pattern for a filter bar.
- **Additive (AND) filters**: All active filters narrow the result set. This is more intuitive than radio-style exclusive selection since users may want to combine filters.

## 8. Dependencies & External Integrations

No new external dependencies. Uses built-in Prisma raw query support and React hooks.

## 9. Examples & Edge Cases

### Example: Fetching last installment refunds

```
GET /api/bills/clx123/transactions?lastInstallment=true&refunds=true&page=1&limit=20
```

Result: Transactions that are both in their last installment AND have negative amounts.

### Edge case: Empty raw query results

When `lastInstallment=true` and no transactions match the raw SQL ID query, `where.id: { in: [] }` correctly returns zero results without error.

### Edge case: Search with no matches

When a search term matches no transactions, the table shows a "No transactions match your filters" empty state.

## 10. Validation Criteria

- All existing tests pass (48 tests)
- New API route filter logic is testable
- Build succeeds with `bun --bun run build`
- Lint passes with `bun --bun run lint`

## 11. Related Specifications

- [spec-design-transaction-categorization.md](./spec-design-transaction-categorization.md)
