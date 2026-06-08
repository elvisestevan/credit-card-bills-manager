---
title: Manual Credit Card Transaction Add Feature Specification
version: 1.0
date_created: 2026-06-08
last_updated: 2026-06-08
owner: Elvis
tags: [app, design, feature, manual-add, keyboard]
---

# Introduction
This specification defines the requirements, constraints, interfaces, and validation criteria for adding a manual transaction input page to the Credit Card Bills Manager application. The feature targets users whose credit card issuer does not provide exported bill files, requiring manual entry of credit card transactions entirely via keyboard.

## 1. Purpose & Scope
### Purpose
Enable users to manually input credit card transactions one at a time using a keyboard-first interface with shortcuts for fast data entry. The form automatically resets after each submission so the user can chain entries without lifting their hands from the keyboard.

### Scope
This specification covers:
- A new `POST /api/transactions` handler to create single transactions
- A new page at `/transactions/add` with a compact, keyboard-optimized form
- Masked amount input with automatic decimal separator insertion (Brazilian real format)
- `+`/`-` amount sign toggle triggered by pressing `F`
- Date entry shortcuts (`t` for today, `y` for yesterday, arrow keys for ±1 day)
- Hidden installment fields revealed via a toggle
- Card name persistence via `localStorage`
- Category combobox sourced from existing categories API
- Recently added transaction list (last 5, in-memory)
- Keyboard shortcuts help panel toggled by `?`
- Sidebar navigation link

### Intended Audience
Software developers, QA engineers, and technical stakeholders involved in implementing or validating the feature.

### Assumptions
- The existing application uses Prisma with SQLite, Next.js 16 App Router, TypeScript, and Tailwind CSS v4
- The user always enters credit card transactions (not checking account)
- Bill month is derived automatically from the transaction date
- Categories already exist; user can also type a new category name
- Amounts use Brazilian real (BRL) formatting

## 2. Definitions
| Term | Definition |
|------|------------|
| Masked Amount | A text input where digits accumulate as cents; display always shows 2 decimal places in BRL format. Typing `3990` displays `R$ 39,90` |
| Cents Integer | The raw integer underlying the masked amount, representing the value in centavos. `3990` cents = `R$ 39,90` |
| Bill Month | The `MM-YYYY` string derived from the transaction date. Used to find-or-create the Bill record |
| Sign Toggle | The ability to flip the amount between positive (expense) and negative (refund) via the `F` key or a click on a `+`/`-` button |

## 3. Requirements, Constraints & Guidelines
### Requirements
- **REQ-001**: Create `POST /api/transactions` endpoint accepting JSON to create a single credit card transaction
- **REQ-002**: Auto-derive `billMonthYear` (`MM-YYYY`) from the transaction date and upsert the Bill record
- **REQ-003**: Create a new page at `/transactions/add` with a compact, keyboard-first form
- **REQ-004**: Amount field must use masked input: digits accumulate as cents, display in BRL format with 2 decimal places
- **REQ-005**: Amount sign togglable via `F` key or click on a `+`/`-` indicator
- **REQ-006**: Date field defaults to today; shortcuts: `t`=today, `y`=yesterday, Up/Down arrows=±1 day
- **REQ-007**: Installment fields (parcel/total) hidden behind a `+ installments` toggle
- **REQ-008**: Card name field persists its last value in `localStorage`
- **REQ-009**: Category field is a text input with `<datalist>` populated from `GET /api/categories`
- **REQ-010**: After successful submission, form resets to defaults and focus moves to the Date field
- **REQ-011**: Show a green "Added!" success indicator for 1.5 seconds after each submission
- **REQ-012**: Show a "Recently added" list (last 5 transactions) below the form, updated on each submission
- **REQ-013**: Pressing `Enter` from any field submits the form
- **REQ-014**: Pressing `Escape` resets the form to defaults
- **REQ-015**: Pressing `?` toggles a keyboard shortcuts help panel
- **REQ-016**: Add "Quick Add" navigation link to the sidebar

### Constraints
- **CON-001**: All form inputs must be natively keyboard operable; no drag-and-drop or click-only controls
- **CON-002**: The form must remain stationary on the page after submit (no redirect or navigation)
- **CON-003**: Amount input must use `inputMode="numeric"` for mobile numeric keyboard
- **CON-004**: All existing functionality must remain unchanged

### Guidelines
- **GUD-001**: Follow existing page layout pattern (header with bg-zinc-900 + main with max-w-6xl)
- **GUD-002**: Use the same Babel-like currency formatting as other pages: `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`
- **GUD-003**: Follow color conventions: expense (positive) = default, refund (negative) = `text-green-400`
- **GUD-004**: Use `crypto.randomUUID()` for `importId` (matching existing import routes)
- **GUD-005**: Follow existing Prisma upsert patterns for Bill and Category

## 4. Interfaces & Data Contracts
### Prisma
No schema changes required. The existing `Transaction`, `Bill`, and `Category` models support all fields needed.

### Types (`src/types/index.ts`)
No new types needed. Existing `TransactionType` and related interfaces suffice.

### API Endpoints
#### POST /api/transactions
Accepts `application/json`:

```json
{
  "date": "2025-06-08",
  "description": "Supermercado",
  "amount": 150.50,
  "cardName": "Nubank",
  "categoryName": "Alimentação",
  "installmentNumber": null,
  "totalInstallments": null
}
```

All fields optional except `date`, `description`, and `amount`. Returns:

```json
{
  "success": true,
  "transaction": {
    "id": 123,
    "date": "2025-06-08",
    "description": "Supermercado",
    "amount": "150.50",
    "cardName": "Nubank",
    "installmentNumber": null,
    "totalInstallments": null,
    "transactionType": "credit_card",
    "billId": "cm8abc123",
    "billMonthYear": "06-2025"
  }
}
```

Error response:

```json
{
  "success": false,
  "error": "date, description, and amount are required"
}
```

Logic:
1. Validate required fields
2. Parse date to DateTime
3. Derive `monthYear` from date (format `MM-YYYY`)
4. Upsert Bill by `monthYear`
5. If `categoryName` provided, find or create Category (lowercased, trimmed)
6. Create Transaction with `importId: crypto.randomUUID()`, `transactionType: "credit_card"`
7. Return created transaction with bill info

### UI Routes
- `/transactions/add`: Manual transaction input page

## 5. UI Design Specification

### Layout
Standard page pattern matching existing pages:
```
<div className="min-h-screen bg-zinc-950 text-zinc-50">
  <header>...</header>
  <main>form + recently added list</main>
</div>
```

### Form Fields (in Tab order)

| # | Field | Type | Default | Notes |
|---|-------|------|---------|-------|
| 1 | Date | text | today's date | Accepts `dd/mm/aaaa` or `yyyy-mm-dd`. Shortcuts: `t`=today, `y`=yesterday, `↑/↓`=±1 day |
| 2 | Description | text | empty | Main text input |
| 3 | Amount (masked) | text (inputMode=numeric) | `0,00` | See masked input behavior below. `F` toggles sign |
| 4 | Card name | text | localStorage | Persisted on successful submit |
| 5 | Category | text + datalist | empty | Categories from `GET /api/categories` |
| 6 | Installments (toggle) | — | hidden | `+` link reveals `parcel` and `total` number inputs |

Submit button: "Add" — triggers on `Enter` from any field.

### Masked Input Behavior (Amount)

- Raw state in cents (integer): `390` = R$ 3,90
- Typing digits appends to the right of the raw integer
- Display always formatted as BRL with 2 decimal places
- Backspace: `Math.floor(raw / 10)` to remove the last digit
- `inputMode="numeric"` on the input element
- When negative (sign toggled): prepend `−` to display, store as negative cents

Examples:

| Keystrokes | Raw (cents) | Display |
|------------|-------------|---------|
| `3` | 3 | `R$ 0,03` |
| `3` `9` | 39 | `R$ 0,39` |
| `3` `9` `9` | 399 | `R$ 3,99` |
| `3` `9` `9` `0` | 3990 | `R$ 39,90` |
| Backspace | 399 | `R$ 3,99` |
| `F` | -399 | `−R$ 3,99` |

### Sign Toggle

- A `+`/`−` button displayed immediately to the right of the amount input
- Clicking or pressing `F` (while any field is focused) flips the sign
- Visual: positive shows `+` in zinc-300, negative shows `−` in `text-green-400`
- On submit: `amount = rawCents / 100`, negated if sign is negative

### Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| `Enter` | Any field | Submit form |
| `Escape` | Any field | Reset form to defaults |
| `F` | Any field | Flip amount sign |
| `?` | Any field | Toggle shortcuts help panel |
| `t` | Date field focused | Set date to today |
| `y` | Date field focused | Set date to yesterday |
| `ArrowUp` | Date field focused | Increment date by 1 day |
| `ArrowDown` | Date field focused | Decrement date by 1 day |

### Recently Added List

- Below the form, show "Recently Added" header with a list of the last 5 transactions
- Each entry: date (DD/MM) + description + formatted amount
- Colored by sign (positive default, negative green)
- Empty state: "No transactions added yet"
- Entries are in-memory only (not persisted to localStorage)

### Shortcuts Help Panel

- Toggled by pressing `?`
- Overlay/panel listing all keyboard shortcuts
- Dismissed by pressing `?` again or clicking outside

## 6. Acceptance Criteria
- **AC-001**: Given a user navigates to `/transactions/add`, When the page loads, Then a compact form is displayed with Date, Description, Amount, Card name, and Category fields
- **AC-002**: Given a user types `3990` in the amount field, When they look at the field, Then it displays `R$ 39,90`
- **AC-003**: Given a user presses `F`, When the amount has a positive value, Then it flips to negative (displayed with `−` in green)
- **AC-004**: Given a user fills all fields and presses `Enter`, When the transaction is created, Then the form resets, focus returns to Date, and a green "Added!" indicator appears
- **AC-005**: Given the form is filled, When the user presses `Escape`, Then all fields reset to their defaults
- **AC-006**: Given a user presses `?`, When the help panel is not visible, Then it appears showing all keyboard shortcuts
- **AC-007**: Given a user has added 3 transactions, When they look at the recently added list, Then all 3 are visible in chronological order
- **AC-008**: Given a user submits a transaction with a new category name, When the transaction is created, Then the category is created and the transaction is linked to it
- **AC-009**: Given the card name field has a value, When the user submits and the form resets, Then the card name retains its value (from localStorage)
- **AC-010**: Given a user tabs through the form, When they reach the end, Then the submit button is focused and Enter triggers submission

## 7. Test Automation Strategy
- **Test Levels**: Integration (API), Component (page)
- **Frameworks**: Vitest (existing test runner)
- **API Tests**: Test POST /api/transactions with valid data, missing fields, category creation
- **Component Tests**: Test form rendering, masked input behavior, sign toggle, keyboard shortcuts, submission flow
- **CI/CD Integration**: All tests pass via `bun run test`

## 8. Rationale & Context
The existing application only supports importing credit card transactions via CSV from Itau. Some credit card issuers do not provide exportable bill files, making the app unusable for those users. A keyboard-first manual entry form fills this gap while maintaining the design principle of efficient data entry. The masked amount input and `Enter`-to-submit flow enable rapid chaining of entries without mouse interaction.

## 9. Dependencies & External Integrations
None. All data is local to the SQLite database.

## 10. Validation Criteria
- All Acceptance Criteria (AC-001 to AC-010) are satisfied
- All existing and new tests pass
- `bun --bun run lint` completes with 0 errors
- `bun --bun run build` succeeds with no TypeScript errors
- New `/transactions/add` page renders correctly
- Form is fully operable via keyboard alone

## 11. Related Specifications / Further Reading
- [AGENTS.md](AGENTS.md) - Dev commands, tech stack, and file references
- [prisma/schema.prisma](prisma/schema.prisma) - Data model
- [src/app/api/transactions/route.ts](src/app/api/transactions/route.ts) - Existing GET handler (POST to be added)
- [src/components/Sidebar.tsx](src/components/Sidebar.tsx) - Sidebar navigation
