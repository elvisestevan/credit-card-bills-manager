# Editable Budget Goal — Design Spec

**Date:** 2026-06-09
**Status:** Approved

## Problem

The monthly budget goal is hardcoded as `BUDGET_GOAL = 10000` (BRL) in the dashboard monthly API route. Users cannot adjust it without editing source code.

## Solution

Persist the budget goal in SQLite via a new Prisma model, expose GET/PUT API endpoints, and provide a `/settings/budget` page for editing.

---

## Data Layer

### Prisma Model

```prisma
model BudgetGoal {
  id     Int     @id @default(autoincrement())
  amount Decimal
}
```

- Single-row table (upserted by id=1)
- Auto-created with default 10000 on first read if row doesn't exist
- Migration: `bun --bun run prisma migrate dev --name add_budget_goal`

### API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/budget` | Returns `{ amount: number }`, auto-creates row if missing |
| `PUT` | `/api/budget` | Body: `{ amount: number }`, upserts id=1, validates > 0 |

### Modified Route

**`/api/dashboard/monthly`** — Replace `const BUDGET_GOAL = 10000` with `prisma.budgetGoal.findFirst()`, using the same auto-create-on-read logic (GET auto-creates). Decimal converted via `.toNumber()` to match existing pattern.

---

## Navigation

- Gear icon (⚙️) added to the dashboard header in `page.tsx`, right-aligned next to "Dashboard" title
- Links to `/settings`

---

## Settings Page

### Route Structure

```
/settings/layout.tsx          # Sidebar layout wrapper
/settings/page.tsx            # Redirects to /settings/budget
/settings/budget/page.tsx     # Budget editor page
```

### Layout (`/settings/layout.tsx`)

- Left sidebar nav with items (currently only "Budget")
- Back link "← Dashboard" at top
- Content area on the right
- Same visual style as dashboard (dark theme, zinc colors)

### Budget Page (`/settings/budget/page.tsx`)

```
┌─────────────────────────────────────┐
│  ← Dashboard    Settings            │
├──────────┬──────────────────────────┤
│  Budget  │  Budget Goal             │
│          │  ┌────────────────────┐  │
│          │  │ R$ [  10.000,00  ] │  │
│          │  └────────────────────┘  │
│          │  [Save Changes]          │
│          │                          │
│          │  Current goal: R$ 10.000,00 │
└──────────┴──────────────────────────┘
```

- BRL currency input (formatted as `R$ X.XXX,XX`)
- Validation: must be a positive number, max 9 digits
- "Save Changes" button calls `PUT /api/budget`
- Below the form, shows the current saved value for context

### Component

**`src/components/settings/BudgetForm.tsx`** — form component with:
- Input field with BRL formatting
- Client-side validation
- Save handler (calls PUT)
- Success/error feedback

---

## Data Flow

1. User opens `/settings/budget` → `GET /api/budget` → form populated with current value
2. User edits amount, clicks Save → `PUT /api/budget { amount }` → persisted
3. On success: feedback shown ("Saved" state for 3s)
4. User navigates back to dashboard → `GET /api/dashboard/monthly` returns updated values

No cross-page state management needed — each page fetches fresh data.

---

## Error & Edge Cases

| Scenario | Handling |
|----------|----------|
| No BudgetGoal row exists | GET /api/budget auto-creates with default 10000 |
| Invalid input (empty, ≤ 0, > 99M) | Client-side validation, Save disabled |
| Network error on save | Error message displayed, form stays editable |
| User navigates mid-edit | Nothing lost — form is client-state only |

---

## Files Changed

**New:**
- `src/app/settings/layout.tsx`
- `src/app/settings/page.tsx`
- `src/app/settings/budget/page.tsx`
- `src/components/settings/BudgetForm.tsx`
- `src/app/api/budget/route.ts`

**Modified:**
- `prisma/schema.prisma`
- `src/app/api/dashboard/monthly/route.ts`
- `src/app/page.tsx`

---

## Testing

- **Unit tests** for `GET /api/budget` and `PUT /api/budget` (success, validation, not-found auto-create)
- **Component test** for `BudgetForm` (renders, validation, save callback)
- All existing tests must continue to pass
