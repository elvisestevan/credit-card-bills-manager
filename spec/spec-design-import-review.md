---
title: Import Review with Category Suggestions Design Specification
version: 1.0
date_created: 2026-05-12
owner: Elvis
tags: [design, app, feature, import, categorization]
---

# Introduction
This specification defines the design, requirements, and acceptance criteria for an Import Review feature. After importing transactions from a CSV, the user is taken to a review page where category suggestions are auto-populated based on existing transactions with the same description in the database.

## 1. Purpose & Scope
### Purpose
Enable users to quickly categorize newly imported transactions by suggesting the most-used category for each transaction's description based on historical data.

### Scope
- Modified `/api/transactions/import` response to include `importId` and `billId`
- New `GET /api/transactions/import/[importId]` endpoint (returns transactions with suggestions)
- New `/import/[importId]/review` page for reviewing and categorizing new transactions
- New `SimilarTransactionsModal` component for viewing existing transactions with the same description
- Enhanced `CategoryDropdown` to accept and auto-select suggested categories
- Modified `FileUpload` to navigate to the review page after successful import

### Out of Scope
- Editing transaction amounts or descriptions during review
- Deleting imported transactions from the review page
- Re-importing or merging imports

### Intended Audience
Frontend/backend developers implementing the feature, QA engineers validating acceptance criteria.

## 2. Definitions
- **Import Batch**: A set of transactions created by a single CSV upload, identified by a unique `importId` (UUID).
- **Suggestion**: The most-frequently-used category for a given transaction description across all categorized transactions in the database.
- **Similar Transactions**: Existing database transactions (across any bill) with an exact description match.

## 3. Requirements, Constraints & Guidelines
### Functional Requirements
- **REQ-001**: The POST `/api/transactions/import` response must include `importId` and `billId` on success.
- **REQ-002**: A new `GET /api/transactions/import/{importId}` endpoint must return all transactions for that import batch, each with a `suggestedCategoryId` and `suggestedCategoryName` derived from the most-used category for that description in the database.
- **REQ-003**: If no existing transaction with the same description has a category, `suggestedCategoryId` and `suggestedCategoryName` must be `null`.
- **REQ-004**: After successful import, the FileUpload component must navigate to `/import/{importId}/review?billId={billId}`.
- **REQ-005**: The `/import/[importId]/review` page must display all newly imported transactions in a table with columns: Date, Description, Installments, Amount, Category, Actions.
- **REQ-006**: The Category column must contain a `CategoryDropdown` with the suggestion auto-selected and labeled "Suggested".
- **REQ-007**: Each row must have a "View Similar" button that opens a modal showing all existing database transactions with the exact same description.
- **REQ-008**: A "Save All" button must save all selected categories via PATCH `/api/transactions/{id}` for each row.
- **REQ-009**: After saving, the page should show a success message and a link/button to return to the bills page.

### Constraints
- **CON-001**: Use existing tech stack: Next.js 16 App Router, Tailwind CSS v4, Prisma with SQLite.
- **CON-002**: All new API routes must follow existing patterns (dynamic imports in tests, `NextRequest`/`NextResponse`).
- **CON-003**: Category names stored in lowercase; use case-insensitive comparison for description matching.

### Guidelines
- **GUD-001**: Follow existing component patterns (modal overlay, table structure, color scheme).
- **GUD-002**: Reuse `CategoryDropdown` by extending it with a `suggestedCategory` prop rather than creating a new component.
- **GUD-003**: The suggestion logic queries `Transaction` where `description` matches exactly (case-insensitive), `categoryId` is NOT null, groups by `categoryId`, orders by count DESC, and returns the top category.
- **GUD-004**: Negative amounts colored green, positive colored red (existing convention).

## 4. Interfaces & Data Contracts
### Modified API: POST /api/transactions/import
**Additional fields in success response:**
```json
{
  "success": true,
  "added": 15,
  "ignored": 2,
  "errors": [],
  "importId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "billId": "clxyzabc123def456",
  "billMonthYear": "05-2026"
}
```

### New API: GET /api/transactions/import/{importId}
**Response body:**
```json
{
  "importId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "billId": "clxyzabc123def456",
  "billMonthYear": "05-2026",
  "transactions": [
    {
      "id": 1,
      "date": "2026-05-01",
      "description": "NETFLIX.COM",
      "amount": "-39.90",
      "installmentNumber": null,
      "totalInstallments": null,
      "suggestedCategoryId": 5,
      "suggestedCategoryName": "streaming"
    },
    {
      "id": 2,
      "date": "2026-05-03",
      "description": "UBER *TRIP",
      "amount": "-25.00",
      "installmentNumber": null,
      "totalInstallments": null,
      "suggestedCategoryId": null,
      "suggestedCategoryName": null
    }
  ]
}
```

### New/Modified Page Routes
| Route | Description |
|-------|-------------|
| `/import/[importId]/review` | Import review page showing transactions with category suggestions |

### Component: CategoryDropdown Enhancement
```typescript
// Added optional prop
interface CategoryDropdownProps {
  value: number | null;
  onChange: (categoryId: number | null, categoryName?: string) => void;
  refreshKey?: number;
  categoryName?: string;
  suggestedCategory?: { id: number; name: string } | null;  // NEW
}
```
When `suggestedCategory` is provided and `value` is null, auto-select the suggestion. Show a "Suggested" badge next to the selected category.

### New Component: SimilarTransactionsModal
```typescript
interface SimilarTransactionsModalProps {
  description: string;
  onClose: () => void;
}
```
Fetches from existing `GET /api/transactions/search?description={encoded}` and displays results in a table with: Date, Amount, Installments, Bill, Category.

## 5. Acceptance Criteria
- **AC-001**: Given a successful CSV import, when the response is received, then FileUpload navigates to `/import/{importId}/review?billId={billId}`.
- **AC-002**: Given the review page loads for an import, when transactions are displayed, then each row shows Date, Description, Installments, Amount, a Category dropdown (with suggestion auto-selected if available), and a "View Similar" button.
- **AC-003**: Given a transaction description that exists in the database with categorized transactions, when the review page loads, then the Category dropdown auto-selects the most-used category and displays a "Suggested" indicator.
- **AC-004**: Given a transaction description that has no matching categorized transactions in the database, when the review page loads, then the Category dropdown is empty (no auto-selection).
- **AC-005**: Given the user clicks "View Similar" on a transaction, when the modal opens, then it displays all existing database transactions with the same description, showing Date, Amount, Installments, Bill, and Category for each.
- **AC-006**: Given the user changes the category in a dropdown and clicks "Save All", when the save completes, then a success message is shown and a link to return to bills is displayed.
- **AC-007**: Given the user clicks "Save All" without changing any categories, when suggestions were auto-selected, then all transactions are saved with their suggested categories.

## 6. Test Automation Strategy
- **Test Levels**: Unit (API endpoints), Component (review page, modal, enhanced dropdown)
- **Frameworks**: Vitest, React Testing Library (existing)
- **Test Data Management**: Mock Prisma for unit tests; integration tests use real test.db
- **CI/CD Integration**: Add new test files to existing CI pipeline
- **Coverage Requirements**: 80% minimum for new feature files
- **Key Test Cases**:
  - Import API returns importId on success
  - GET import/[importId] returns transactions with suggestions
  - Suggestion logic selects most-used category from DB
  - Suggestion returns null when no matching categorized transaction exists
  - Review page renders all imported transactions
  - SimilarTransactionsModal fetches and displays matching transactions
  - "View Similar" button opens modal with correct description
  - "Save All" calls PATCH for each transaction
  - CategoryDropdown auto-selects when suggestion provided

## 7. Rationale & Context
- The suggestion is computed server-side (in the GET endpoint) to avoid multiple client-side API calls and keep the frontend simple.
- Auto-selecting the suggestion reduces user effort; they can still override it.
- "View Similar" provides transparency so the user can verify the suggestion's basis.
- The `/import/{importId}/review` route is a clean dynamic route that doesn't collide with existing routes.
- Suggestions are recomputed each time the endpoint is called, so they always reflect the current database state.

## 8. Dependencies & External Integrations
### External Systems
- None
### Third-Party Services
- None
### Infrastructure Dependencies
- **INF-001**: SQLite database (existing) with existing Transaction and Category data
### Data Dependencies
- **DAT-001**: Existing categorized transactions in the database to derive suggestions from
- **DAT-002**: The `importId` field on Transaction records (already exists)
### Technology Platform Dependencies
- **PLT-001**: Next.js 16 App Router, Tailwind CSS v4, Prisma with SQLite (all existing)

## 9. Examples & Edge Cases
### Suggestion Logic
```typescript
// Database has these categorized transactions:
// "NETFLIX.COM" → "streaming" (8 times), "entertainment" (2 times)
// Suggestion for "NETFLIX.COM" → { categoryId: 5, categoryName: "streaming" }

// Database has "UNKNOWN MERCHANT" → no categorized transactions
// Suggestion for "UNKNOWN MERCHANT" → { categoryId: null, categoryName: null }
```

### Edge Case: New Description
```typescript
// User imports a transaction with a brand-new description
// No existing transactions match → no suggestion
// Category dropdown is empty, user must select/create a category manually
```

### Edge Case: Description with Installments
```typescript
// Existing transaction: "AMAZON*KINDLE" 1/3 → "shopping"
// New transaction: "AMAZON*KINDLE" 2/3 → suggestion: "shopping"
// Matching ignores installment info, only compares clean description
```

### Edge Case: Empty Import
```typescript
// If an import batch has 0 new transactions (all duplicates), no redirect to review page
// FileUpload shows success message "0 transactions added" as before
```

## 10. Validation Criteria
- All acceptance criteria (AC-001 to AC-007) pass
- All existing unit/component tests continue to pass
- Lint and typecheck pass for all new code
- No console errors during manual workflow testing
- Suggestions are accurate: verify against known descriptions in test data

## 11. Related Specifications / Further Reading
- [Transaction Categorization Feature Design](./spec-design-transaction-categorization.md)
- [AGENTS.md](./AGENTS.md)
