---
title: Unified Transaction Add Page Specification
version: 1.0
date_created: 2026-06-09
last_updated: 2026-06-09
owner: Elvis
tags: [app, design, refactor, feature, import, manual-add]
---

# Introduction

This specification defines the requirements, constraints, interfaces, and migration plan for consolidating the three existing transaction-adding pages (Credit Card CSV import, Checking Account CSV import, and Manual Entry) into a single unified page at `/transactions/add`. The goal is to eliminate navigation fragmentation, reduce code duplication, and provide a consistent entry point for all transaction creation workflows.

## 1. Purpose & Scope

### Purpose
Merge three separate pages (`/bills` CSV upload, `/checking-account/import`, `/transactions/add`) into one page with a tabbed interface, reducing route count, sharing layout code, and making the sidebar simpler.

### Scope
This specification covers:
- A new tabbed `Add Transactions` page at `/transactions/add` with two tabs: **Import CSV** and **Manual Entry**
- Within **Import CSV**, a sub-selector for **Credit Card** vs **Checking Account** transaction type
- Extraction of existing inline page logic into reusable components (`CsvImportSection`, `ManualEntryForm`)
- Removal of the `FileUpload` component from the `/bills` page (bills page becomes list-only)
- Removal of the `/checking-account/import` page (redirect to `/transactions/add`)
- Sidebar simplification: replace "Quick Add" and "Import Checking" with a single "Add Transaction" link
- All existing API routes remain unchanged

### Intended Audience
Software developers, QA engineers, and technical stakeholders involved in implementing or validating the refactor.

### Assumptions
- The existing application uses Prisma with SQLite, Next.js 16 App Router, TypeScript, and Tailwind CSS v4
- The existing API endpoints (`POST /api/transactions/import`, `POST /api/transactions/import/checking-account/preview`, `POST /api/transactions/import/checking-account/confirm`, `POST /api/transactions`) remain unchanged
- The import review page (`/import/[importId]/review`) remains as a separate page following credit card CSV import
- All existing parsers (`itau.ts`, `checking-account.ts`) remain unchanged
- The existing color scheme, typography, and layout patterns are preserved

## 2. Definitions

| Term | Definition |
|------|------------|
| Unified Page | The single page at `/transactions/add` that provides all three transaction-adding methods |
| Import CSV Tab | One of two main tabs; contains the credit card and checking account CSV import flows |
| Manual Entry Tab | One of two main tabs; contains the keyboard-friendly single-transaction form |
| Transaction Type Sub-selector | A dropdown within the Import CSV tab to choose between Credit Card and Checking Account |
| FileUpload | Existing component (`src/components/FileUpload.tsx`) for credit card CSV upload, to be reused within the unified page |
| Post-Import Review | The separate page at `/import/[importId]/review` for assigning categories after credit card CSV import |

## 3. Requirements, Constraints & Guidelines

### Requirements
- **REQ-001**: Create a single page at `/transactions/add` that provides access to all three transaction-adding methods
- **REQ-002**: The page shall use two top-level tabs: **Import CSV** and **Manual Entry**
- **REQ-003**: The **Import CSV** tab shall contain a transaction type sub-selector: **Credit Card** or **Checking Account**
- **REQ-004**: When **Credit Card** is selected in the Import CSV tab, show the existing file upload UI (bill ID, card name, file drop zone) from `FileUpload.tsx`
- **REQ-005**: When **Checking Account** is selected in the Import CSV tab, show the existing checking account import flow (file drop zone → preview table with checkboxes → confirm button)
- **REQ-006**: The **Manual Entry** tab shall display the existing keyboard-friendly quick-add form (date, description, amount, card, type, category, installments)
- **REQ-007**: Remove the CSV import section (`FileUpload` component) from the `/bills` page; the bills page becomes a bills list only
- **REQ-008**: Remove the `/checking-account/import` page and replace it with a redirect to `/transactions/add`
- **REQ-009**: Replace the sidebar links "Quick Add" (`/transactions/add`) and "Import Checking" (`/checking-account/import`) with a single "Add Transaction" link pointing to `/transactions/add`
- **REQ-010**: All existing API routes, parsers, database models, and post-import review flow must remain unchanged
- **REQ-011**: The current active tab shall be reflected in the URL via a query parameter (e.g., `?tab=import-csv` or `?tab=manual`) to support deep linking and browser back/forward navigation

### Constraints
- **CON-001**: Zero changes to any API route handler or parser logic
- **CON-002**: Zero changes to the database schema
- **CON-003**: The `/import/[importId]/review` page must remain accessible after credit card CSV imports
- **CON-004**: All existing tests must continue to pass without modification
- **CON-005**: The `FileUpload` component must continue to work both within the unified page and independently (backward-compatible props)
- **CON-006**: The checking account import's two-step flow (preview → confirm) must be preserved exactly

### Guidelines
- **GUD-001**: Reuse existing components where possible (`FileUpload`) rather than duplicating logic
- **GUD-002**: Extract the checking account import page logic into a `CheckingAccountImport` component for reuse
- **GUD-003**: Extract the manual entry form into a `ManualEntryForm` component for reuse
- **GUD-004**: Follow the existing page layout pattern: `bg-zinc-950` container with `bg-zinc-900` header and `max-w-6xl` centered main content
- **GUD-005**: Use the same tab styling as any existing tab patterns in the app (e.g., dashboard type filter tabs)
- **GUD-006**: Color conventions: expense (positive) = red/white, refund (negative) = `text-green-400`

### Patterns
- **PAT-001**: Shared page header pattern — all detail pages use `<header className="bg-zinc-900 border-b border-zinc-800">` with title and description
- **PAT-002**: Tab/navigation pattern — use `bg-zinc-800` for active tab, `text-zinc-400 hover:text-zinc-200` for inactive tabs with `transition-colors`

## 4. Interfaces & Data Contracts

### Component Tree

```
src/app/transactions/add/page.tsx
├── Page header (title + description)
├── Tab bar: [Import CSV] [Manual Entry]
│
├── Import CSV Tab
│   ├── Transaction type dropdown: [Credit Card ▼]
│   │
│   ├── Credit Card selected:
│   │   └── <FileUpload onUploadComplete={...} />
│   │       (existing component, billId + cardName + drop zone)
│   │
│   └── Checking Account selected:
│       └── <CheckingAccountImport />
│           (extracted from /checking-account/import/page.tsx)
│           ├── File drop zone
│           ├── Preview table with checkboxes
│           └── [Import Selected] button
│
└── Manual Entry Tab
    └── <ManualEntryForm />
        (extracted from /transactions/add/page.tsx current content)
        ├── Form fields: Date, Description, Amount, Card, Type, Category
        ├── Recently Added list
        └── Keyboard shortcuts help panel
```

### Props Interfaces

```typescript
// FileUpload already exists, no changes needed
interface FileUploadProps {
  onUploadComplete: () => void;
}

// New: CheckingAccountImport component
interface CheckingAccountImportProps {
  // Self-contained — manages its own state, just renders within the page
}

// New: ManualEntryForm component
interface ManualEntryFormProps {
  // Self-contained — manages its own state, just renders within the page
}
```

### URL Structure

```
/transactions/add                          → defaults to Import CSV tab
/transactions/add?tab=import-csv           → Import CSV tab (explicit)
/transactions/add?tab=manual               → Manual Entry tab
```

The `?tab=` query parameter updates on tab switch via `router.replace()` (no page reload).

### Redirects

| Old Route | New Behavior |
|-----------|-------------|
| `/checking-account/import` | Page-level redirect to `/transactions/add?tab=import-csv` |
| `/bills` | Removed `FileUpload` section; only bills list remains |

### Sidebar Changes

| Before | After |
|--------|-------|
| Quick Add → `/transactions/add` | Add Transaction → `/transactions/add` |
| Import Checking → `/checking-account/import` | _(removed)_ |

## 5. UI Design

### Layout

Standard page pattern:

```
<div className="min-h-screen bg-zinc-950 text-zinc-50">
  <header className="bg-zinc-900 border-b border-zinc-800">
    <h1>Add Transactions</h1>
    <p>Import CSV files or manually enter transactions</p>
  </header>

  <main className="max-w-6xl mx-auto px-4 py-8">

    <!-- Tab Bar -->
    <div className="flex gap-1 mb-6 bg-zinc-900 rounded-lg p-1 border border-zinc-800 w-fit">
      <button className={activeTab === 'import-csv' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}>
        Import CSV
      </button>
      <button className={activeTab === 'manual' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}>
        Manual Entry
      </button>
    </div>

    <!-- Conditional content -->
    {activeTab === 'import-csv' && (
      <>
        <!-- Transaction type sub-selector -->
        <select>Credit Card / Checking Account</select>

        {type === 'credit_card' && <FileUpload />}
        {type === 'checking_account' && <CheckingAccountImport />}
      </>
    )}

    {activeTab === 'manual' && <ManualEntryForm />}
  </main>
</div>
```

### Tab Bar Details

- Styled as a segmented control: `bg-zinc-900 rounded-lg p-1 border border-zinc-800` container
- Active tab: `bg-zinc-800 text-white rounded-md`
- Inactive tab: `text-zinc-400 hover:text-zinc-200`
- First tab ("Import CSV") is the default (no `?tab=` param)

### Import CSV — Credit Card Sub-mode

- Same UI as the existing `FileUpload` component
- Fields: Bill ID (MM-YYYY), Card Name (optional), File drop zone
- On successful import, redirects to `/import/{importId}/review?billId={billId}` (same as today)

### Import CSV — Checking Account Sub-mode

- Same two-step flow as the existing `/checking-account/import` page
- Step 1: File drop zone → parses CSV → shows preview table
- Preview table: Date, Description, Amount (color-coded), Bill (MM-YYYY), checkbox per row
- Debits (positive after negation) auto-selected; credits (negative) auto-unselected
- "Select all" toggle
- Already-imported transactions marked as `exists` and hidden
- Step 2: [Import Selected] button → confirms → shows success/error message

### Manual Entry Tab

- Same keyboard-friendly form as the existing `/transactions/add` page
- Fields: Date, Description, Amount (masked + sign toggle), Card, Type (Credit Card / Checking Account), Category, Installments (expandable)
- "Recently Added" list below the form
- Keyboard shortcuts panel (`?` key)
- All keyboard shortcuts preserved: `Enter` submit, `Escape` reset, `F` toggle sign, `t`/`y`/arrows for date

## 6. Acceptance Criteria

- **AC-001**: Given a user navigates to `/transactions/add`, When the page loads, Then the Import CSV tab is active by default with Credit Card sub-mode selected
- **AC-002**: Given a user is on the Import CSV tab with Credit Card selected, When they fill in Bill ID, Card Name, and drop a CSV, Then the import proceeds and redirects to `/import/{importId}/review` on success
- **AC-003**: Given a user is on the Import CSV tab with Checking Account selected, When they drop a CSV, Then the preview table appears with checkboxes, and debits are auto-selected
- **AC-004**: Given a user is on the Import CSV tab with Checking Account and has a preview loaded, When they click Import Selected, Then only selected transactions are saved
- **AC-005**: Given a user clicks the Manual Entry tab, When the page renders, Then the keyboard-friendly form is displayed with Date, Description, Amount, Card, Type, Category, and Installments fields
- **AC-006**: Given a user navigates to `/transactions/add?tab=manual`, When the page loads, Then the Manual Entry tab is active
- **AC-007**: Given a user clicks the "Add Transaction" sidebar link, When the page loads, Then the sidebar highlights the link as active
- **AC-008**: Given a user navigates to `/checking-account/import`, When the page loads, Then they are redirected to `/transactions/add?tab=import-csv`
- **AC-009**: Given a user navigates to `/bills`, When the page loads, Then no file upload section is shown, only the bills list
- **AC-010**: Given a user switches tabs, When they do so, Then the `?tab=` query parameter updates in the URL
- **AC-011**: Given a user submits a manual entry with valid data, When the form processes, Then the transaction is created via `POST /api/transactions` and the form resets
- **AC-012**: Given all existing tests, When the refactor is complete, Then all 69 tests pass without modification

## 7. Test Automation Strategy

- **Test Levels**: Unit (component extraction), Integration (API unchanged), E2E (manual flow verification)
- **Frameworks**: Vitest (existing test runner)
- **Existing Tests**: All 69 existing tests must continue to pass unchanged
- **New Tests Needed**:
  - Component tests for the unified page: tab switching, sub-mode toggling, query param syncing
  - Component tests for extracted `CheckingAccountImport` component (if not already covered)
  - Component tests for extracted `ManualEntryForm` component (if not already covered)
- **CI/CD Integration**: All tests pass via `bun run test` in CI pipeline
- **Coverage**: No regression in existing test coverage

## 8. Rationale & Context

The current application has three separate entry points for adding transactions, spread across different routes and sidebar navigation items. This fragmentation causes:

1. **Navigation overhead**: Users must remember which page to visit for each import type
2. **Code duplication**: Shared layout and interaction patterns are replicated in each page
3. **Inconsistent UX**: Each page has a slightly different header style and layout approach
4. **Sidebar bloat**: Two sidebar items for import-related tasks ("Quick Add" + "Import Checking")

Consolidating into a single page reduces route count, eliminates duplicated layout code, simplifies the sidebar, and provides a consistent entry point. The tabbed approach preserves the distinct UX requirements of each method while presenting them in a unified interface.

## 9. Dependencies & External Integrations

### External Systems
None. The application operates entirely on local SQLite storage.

### Third-Party Services
None.

### Infrastructure Dependencies
- **INF-001**: Next.js 16 App Router — Required for the unified page at `/transactions/add` and redirect from `/checking-account/import`
- **INF-002**: SQLite via Prisma — Unchanged

### Data Dependencies
None. All parsers and data contracts remain unchanged.

## 10. Migration Plan

### Phase 1: Component Extraction
1. Extract checking account import page logic into `src/components/CheckingAccountImport.tsx`
2. Extract manual entry form logic into `src/components/ManualEntryForm.tsx`

### Phase 2: Unified Page Creation
3. Rewrite `src/app/transactions/add/page.tsx` with tabbed interface
4. Integrate `FileUpload`, `CheckingAccountImport`, and `ManualEntryForm` components

### Phase 3: Cleanup
5. Remove `FileUpload` section from `src/app/bills/page.tsx`
6. Replace `src/app/checking-account/import/page.tsx` with a redirect component
7. Update `src/components/Sidebar.tsx`: replace two links with one

### Phase 4: Verification
8. Run all existing tests — must pass unchanged
9. Run `bun --bun run lint` — 0 errors
10. Run `bun --bun run build` — 0 TypeScript errors
11. Manual verification of all three flows

## 11. Examples & Edge Cases

### URL Tab Syncing

```
User navigates to /transactions/add
  → tab=import-csv active (default)
  → URL reads: /transactions/add

User clicks "Manual Entry" tab
  → URL updates to: /transactions/add?tab=manual
  → Manual Entry form renders

User refreshes browser
  → `?tab=manual` preserved, Manual Entry form renders

User clicks browser back
  → `?tab=import-csv` restored, Import CSV tab shows
```

### Edge Cases

1. **Direct access to old routes**: `/checking-account/import` redirects to `/transactions/add?tab=import-csv`
2. **Credit card import conflict**: Same behavior as today — shows conflict error with existing bill details, handled within `FileUpload` component
3. **Checking account empty CSV**: Same as today — shows "No valid transactions found" error in the `CheckingAccountImport` component
4. **Manual entry network error**: Same as today — shows "Erro de conexão" error, form state preserved
5. **Tab switching mid-flow**: If a user starts a manual entry, switches to Import CSV tab, then switches back — the manual form state is reset (query param change causes remount via conditional rendering)
6. **Sidebar active state**: Both `/transactions/add` and `/transactions/add?tab=manual` should highlight the same sidebar link (use `pathname` only, not full search string)

## 12. Validation Criteria

- All Acceptance Criteria (AC-001 to AC-012) are satisfied
- All existing tests pass without modification
- `bun --bun run lint` completes with 0 errors
- `bun --bun run build` succeeds with no TypeScript errors
- `/bills` page loads with no file upload section, only bills list
- `/checking-account/import` redirects to `/transactions/add?tab=import-csv`
- `/transactions/add` renders all three transaction-adding methods
- Tab switching updates URL query parameter
- All three import/entry flows complete successfully end-to-end
- Sidebar shows single "Add Transaction" link that highlights correctly

## 13. Related Specifications / Further Reading

- [spec-design-checking-account-import.md](./spec-design-checking-account-import.md) - Existing checking account import spec
- [spec-design-manual-transaction-add.md](./spec-design-manual-transaction-add.md) - Existing manual add spec
- [spec-design-import-review.md](./spec-design-import-review.md) - Post-import review page spec
- [AGENTS.md](../AGENTS.md) - Dev commands, tech stack, and file references
- [prisma/schema.prisma](../prisma/schema.prisma) - Data model
- [src/app/transactions/add/page.tsx](../src/app/transactions/add/page.tsx) - Target page for refactor
- [src/app/bills/page.tsx](../src/app/bills/page.tsx) - Bills page (to be modified)
- [src/app/checking-account/import/page.tsx](../src/app/checking-account/import/page.tsx) - Checking import page (to be removed)
- [src/components/Sidebar.tsx](../src/components/Sidebar.tsx) - Sidebar navigation (to be updated)
- [src/components/FileUpload.tsx](../src/components/FileUpload.tsx) - Existing file upload component (to be reused)
