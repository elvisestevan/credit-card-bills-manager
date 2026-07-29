# Category Suggestions for Checking Account Import Preview

## Problem
When importing a checking account CSV, users must manually assign categories to each transaction. If the same description has been imported before with a category, the system should suggest it automatically.

## Current State
- The `/api/transactions/user-description-suggestions` API already queries for the most recent transaction with the same description that has a `categoryId` (non-null) and returns `categoryName`
- The `CheckingAccountImport` component already calls this API but only uses `userDescription`, ignoring `categoryName`
- The `CategoryDropdown` component already has a `suggestedCategory` prop that auto-selects when no value is set and shows a "Suggested" badge

## Changes

### 1. API: `src/app/api/transactions/user-description-suggestions/route.ts`
- Return `categoryId` alongside `categoryName` in the response
- Change the category query to `select: { id: true, name: true }` for the category relation
- Response becomes `{ userDescription, categoryName, categoryId }`

### 2. Component: `src/components/CheckingAccountImport.tsx`
- Add `suggestedCategories` state: `Record<string, { id: number; name: string } | null>`
- In the existing `useEffect` that fetches suggestions (line ~176), also capture `categoryId` + `categoryName` and store in `suggestedCategories`
- Pass `suggestedCategory={suggestedCategories[key]}` to each `CategoryDropdown`

### 3. No changes to `CategoryDropdown.tsx`
Already handles `suggestedCategory` correctly.

## Behavior
- Each preview row with a description matching a previously imported transaction that had a category will show that category auto-selected with a "Suggested" badge
- Users can clear the suggestion and pick a different category
- If no previous transaction had a category for that description, no suggestion is shown (preserves current behavior)
- Selection logic: most recent transaction with the same description and a non-null `categoryId`
