---
title: Dashboard Page Design Specification
version: 1.0
date_created: 2026-05-21
owner: Development Team
tags: [design, app, dashboard, visualization, charts]
---

# Introduction

This specification defines the requirements, constraints, interfaces, and validation criteria for implementing a visual dashboard page on the Credit Card Bills Manager application. The dashboard replaces the existing home page (`/`) and provides two analysis sections: a global multi-month overview and a monthly drill-down with interactive charts.

## 1. Purpose & Scope

### Purpose
Provide users with a graphical overview of their credit card spending across all billing cycles, enable month-by-month trend analysis, and facilitate per-category spending exploration within individual bills.

### Scope
This specification covers:
- Replacement of the existing `/` (home) page with a dashboard page (`src/app/page.tsx`)
- Implementation of new client-side API routes for dashboard-specific aggregated data
- Integration of the Recharts library for chart rendering
- Two dashboard sections: Global Analysis (all months) and Monthly Drill-Down (single selected month)
- Interactive chart elements (clickable categories, month selector, category drill-down line chart)
- Addition of a "Dashboard" link to the sidebar navigation

### Intended Audience
Software developers, QA engineers, and product stakeholders involved in implementing or validating the dashboard feature.

### Assumptions
- The existing Prisma schema (Bill, Transaction, Category models) remains unchanged
- The existing `/api/bills` and `/api/bills/{billId}/transactions` endpoints remain functional
- Transactions may have `categoryId: null` (uncategorized); these must be shown in charts and tables
- The Bill model's `monthYear` field stores values in `MM-YYYY` format, which sorts lexicographically by month-year
- Negative amounts (refunds) are included in the total calculations where applicable
- The application uses the existing dark theme (zinc-950 background, zinc-900 cards, etc.)

## 2. Definitions

| Term | Definition |
|------|------------|
| Global Section | The upper portion of the dashboard showing charts computed across all months/bills |
| Monthly Section | The lower portion of the dashboard showing charts for a single user-selected bill/month |
| Budget Goal | A fixed spending target of BRL 10,000 per billing cycle, used as a reference line in the projection chart |
| Prorated Budget | (Budget Goal / days in month) * elapsed days, where elapsed days = days from month start to last transaction date in that bill |
| Cumulative Spending | Sum of all transaction amounts in a bill ordered by date, used to visualize spending progression through the month |
| Category Drill-Down | A secondary line chart that appears when a user clicks a category in the pie chart or table, showing that category's total amount across all months |
| Current Bill | The most recent bill (by monthYear) when the dashboard loads; the user can switch to any other bill via a month selector |

## 3. Requirements, Constraints & Guidelines

### Requirements

- **REQ-DSH-001**: The dashboard page must render at the `/` route (replace the existing redirect-to-bills page).
- **REQ-DSH-002**: The dashboard must contain two distinct visual sections: a Global section and a Monthly section.
- **REQ-DSH-003**: The Global section must display a line chart showing the total amount of each bill plotted chronologically by monthYear (user suggestion #1).
- **REQ-DSH-004**: The Global section must display a stacked bar chart showing the category breakdown (total per category) for each bill/month, enabling cross-month category comparison.
- **REQ-DSH-005**: The Monthly section must provide a month selector dropdown pre-populated with all available bills (monthYear values), defaulting to the most recent bill.
- **REQ-DSH-006**: The Monthly section must display a budget projection line chart showing: (a) the cumulative daily spending curve for the selected bill, and (b) a dashed reference line at the prorated budget (BRL 10,000 prorated by the last transaction date as "today"). (user suggestion #2)
- **REQ-DSH-007**: The Monthly section must display a pie chart showing the distribution of transactions grouped by category for the selected bill, with each slice labeled by category name and percentage. (user suggestion #3, part 1)
- **REQ-DSH-008**: The Monthly section must display a table alongside the pie chart showing each category's name, total amount, transaction count, and percentage of total spending. (user suggestion #3, part 2)
- **REQ-DSH-009**: Both the pie chart slices and the table rows must be clickable. Clicking a category must select/deselect it. (user suggestion #3, interactive)
- **REQ-DSH-010**: When a category is selected in the pie chart or table, a new line chart must render below showing that category's total amount across all months (category trend). Deselecting the category must hide this chart. (user suggestion #3, part 3)
- **REQ-DSH-011**: Summary metric cards must appear at the top of each section: in Global, show total bills count, total spending across all bills, average monthly spending; in Monthly, show selected bill's total amount, transaction count, and remaining budget (10,000 - total) or overspend warning.
- **REQ-DSH-012**: Uncategorized transactions (categoryId: null) must be grouped under a category named "Uncategorized" in all category-based charts and tables.
- **REQ-DSH-013**: The sidebar must include a "Dashboard" navigation link pointing to `/`.
- **REQ-DSH-014**: Charts must use the project's existing dark theme colors (zinc-50 text, zinc-800/900 backgrounds, accent colors for data series).

### Constraints

- **CON-DSH-001**: All chart rendering must be client-side only (React `"use client"` components). Dashboard page must be a client component or use dynamic imports with `ssr: false` for chart components.
- **CON-DSH-002**: No new Prisma models or migrations shall be created. All data must be derived from existing Bill, Transaction, and Category models.
- **CON-DSH-003**: API endpoints must query the database on each request; no caching layer shall be introduced.
- **CON-DSH-004**: The month selector in the Monthly section must update all monthly charts reactively without page reload.
- **CON-DSH-005**: The budget goal is fixed at BRL 10,000 (hardcoded). This may be made configurable in a future iteration but is out of scope for this specification.

### Guidelines

- **GUD-DSH-001**: Follow the existing component patterns (client components, `useEffect` + `useState` for data fetching, Tailwind CSS dark theme).
- **GUD-DSH-002**: Extract chart components into separate files under `src/components/dashboard/` for testability and reusability.
- **GUD-DSH-003**: Use the existing `formatCurrency` pattern from the bills page (`Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`) for all monetary values.
- **GUD-DSH-004**: Use Recharts library components (`LineChart`, `PieChart`, `BarChart`, `Tooltip`, `Legend`, `ResponsiveContainer`) for all chart rendering.
- **GUD-DSH-005**: All chart tooltips must show formatted currency values (BRL), not raw numbers.
- **GUD-DSH-006**: Use a predefined color palette for category chart series and pie slices (see section 4 for palette).

## 4. Interfaces & Data Contracts

### New API Endpoints

#### GET /api/dashboard/global
Returns aggregated data across all bills for the Global section.

Response:
```json
{
  "bills": [
    {
      "id": "clx0...",
      "monthYear": "04-2026",
      "totalAmount": 8452.30,
      "totalTransactions": 42
    }
  ],
  "categoryBreakdown": [
    {
      "monthYear": "04-2026",
      "categories": [
        { "name": "alimentacao", "total": 2500.00, "count": 15 }
      ]
    }
  ],
  "summary": {
    "totalBills": 6,
    "totalSpending": 51234.00,
    "averageMonthly": 8539.00
  }
}
```

#### GET /api/dashboard/monthly?billId={billId}
Returns data for a single bill for the Monthly section.

Response:
```json
{
  "bill": {
    "id": "clx0...",
    "monthYear": "04-2026",
    "totalAmount": 8452.30,
    "totalTransactions": 42
  },
  "dailyCumulative": [
    {
      "date": "2026-04-01",
      "runningTotal": 450.00,
      "dayOfMonth": 1
    }
  ],
  "categoryBreakdown": [
    {
      "name": "alimentacao",
      "total": 2500.00,
      "count": 15,
      "percentage": 29.6
    }
  ],
  "budgetGoal": 10000,
  "lastTransactionDate": "2026-04-25",
  "daysInMonth": 30,
  "remainingBudget": 1547.70
}
```

#### GET /api/dashboard/category-trend?categoryId={categoryId}
Returns the total spending for a specific category across all months.

Response:
```json
{
  "categoryId": 3,
  "categoryName": "alimentacao",
  "trend": [
    {
      "monthYear": "01-2026",
      "total": 1800.00
    },
    {
      "monthYear": "02-2026",
      "total": 2200.00
    }
  ]
}
```

### Component Architecture

```
src/app/page.tsx                          // Dashboard page (client component)
src/components/dashboard/
  GlobalSection.tsx                        // Container for global charts
  MonthlySection.tsx                       // Container for monthly charts
  MonthlyBillsFilter.tsx                   // Month selector dropdown
  SummaryCards.tsx                         // Reusable summary metric cards
  Charts/
    MonthlyTrendChart.tsx                  // Line chart: total amount per bill (REQ-DSH-003)
    CategoryBreakdownBarChart.tsx           // Stacked bar: categories per month (REQ-DSH-004)
    BudgetProjectionChart.tsx               // Line chart: cumulative spending vs prorated budget (REQ-DSH-006)
    CategoryPieChart.tsx                    // Pie chart: category distribution (REQ-DSH-007)
    CategoryBreakdownTable.tsx              // Table: category details (REQ-DSH-008)
    CategoryTrendChart.tsx                  // Line chart: category trend across months (REQ-DSH-010)
```

### Chart Configuration

#### Color Palette (for categories)

| Category       | Color               |
|----------------|---------------------|
| alimentacao    | #ef4444 (red-500)   |
| transporte     | #3b82f6 (blue-500)  |
| moradia        | #f59e0b (amber-500) |
| saude          | #10b981 (emerald-500) |
| educacao       | #8b5cf6 (violet-500) |
| lazer          | #ec4899 (pink-500)  |
| assinaturas    | #06b6d4 (cyan-500)  |
| compras        | #f97316 (orange-500) |
| Uncategorized  | #71717a (zinc-500)  |

If categories exceed the predefined palette, assign colors cyclically from a fallback list of 10 additional Tailwind colors.

#### Budget Projection Chart (REQ-DSH-006)
- **Series 1** (area/line): Cumulative daily spending — sum of all transaction amounts ordered by transaction date within the selected bill. X-axis = day of month (1-31), Y-axis = cumulative BRL amount.
- **Series 2** (dashed line): Prorated budget reference line — `(10000 / daysInMonth) * dayOfMonth` for each day up to `lastTransactionDate`, then flat at 10000.
- Tooltip shows: date, cumulative spending, prorated budget, and "over/under budget" delta.
- Apply a fill gradient below the cumulative spending line in green (under budget) or red (over budget) opacity.

#### Category Trend Chart (REQ-DSH-010)
- Hidden by default. Renders only when a category is selected.
- Single-series line chart: X-axis = monthYear (chronological), Y-axis = total amount for that category.
- Shows all available months (even months where the category total is 0).

### Data Flow
1. Dashboard page (`/`) mounts → fetches `GET /api/dashboard/global` → renders GlobalSection with summary cards + MonthlyTrendChart + CategoryBreakdownBarChart.
2. MonthlySection mounts → fetches `GET /api/bills` to populate month selector → defaults to most recent bill → fetches `GET /api/dashboard/monthly?billId={id}` → renders BudgetProjectionChart + CategoryPieChart + CategoryBreakdownTable.
3. User selects a different month → MonthlySection fetches new monthly data → all monthly charts update.
4. User clicks a category in pie chart or table → toggles selection state → if selected, fetches `GET /api/dashboard/category-trend?categoryId={id}` → renders CategoryTrendChart below. If deselected, hides CategoryTrendChart.

## 5. Acceptance Criteria

- **AC-DSH-001**: Given a user navigates to `/`, When the dashboard loads, Then the Global section shows summary cards (total bills, total spending, average monthly), a line chart of monthly totals, and a stacked bar chart of category-by-month distribution.
- **AC-DSH-002**: Given the dashboard is loaded, When the user looks at the Monthly section, Then a month selector dropdown is present defaulting to the most recent bill, and all monthly charts reflect that bill's data.
- **AC-DSH-003**: Given the Monthly section is displayed, When the user selects a different month from the dropdown, Then all monthly charts update to show data for the newly selected bill.
- **AC-DSH-004**: Given the Monthly section, When viewing the budget projection chart, Then a cumulative spending curve and a dashed prorated budget line (based on BRL 10,000 goal and last transaction date) are displayed.
- **AC-DSH-005**: Given the Monthly section, When viewing the category pie chart and table, Then all categories with at least one transaction in the selected bill are listed, including "Uncategorized" for transactions without a category assignment.
- **AC-DSH-006**: Given the category pie chart and table are displayed, When the user clicks a category slice or table row, Then the element becomes visually selected and a CategoryTrendChart line chart renders below showing that category's total across all months.
- **AC-DSH-007**: Given a category is selected and the CategoryTrendChart is visible, When the user clicks the same category again (deselect), Then the CategoryTrendChart is hidden.
- **AC-DSH-008**: Given the sidebar is visible, When the user is on any page, Then a "Dashboard" link is present in the sidebar and navigates to `/` when clicked.
- **AC-DSH-009**: Given a bill has no transactions (empty), When the user selects it in the Monthly section, Then the charts show zero values with appropriate "No data" empty states rather than errors.
- **AC-DSH-010**: Given only one bill exists in the database, When the dashboard loads, Then the Global and Monthly sections both display data for that single bill without errors.

## 6. Test Automation Strategy

- **Test Levels**: Unit (data transformation helpers, formatting functions), Component (chart rendering with mock data, interaction tests), Integration (new API endpoints with test database)
- **Frameworks**: Vitest (existing test runner), React Testing Library (component interaction tests), vi.mock for chart library mocking
- **Test Data Management**: Seed the test database with known bills, transactions, and categories; clean up between tests
- **CI/CD Integration**: New tests run as part of the existing `bun run test` pipeline in `.github/workflows/ci.yml`
- **Coverage Requirements**: New dashboard code targets minimum 80% line coverage; all existing tests must pass
- **Performance Testing**: Verify that dashboard API responses return in under 2 seconds for datasets of up to 12 bills with 500 transactions each

### Test Files
- `src/components/dashboard/__tests__/GlobalSection.test.tsx`
- `src/components/dashboard/__tests__/MonthlySection.test.tsx`
- `src/components/dashboard/__tests__/CategoryPieChart.test.tsx`
- `src/components/dashboard/__tests__/BudgetProjectionChart.test.tsx`
- `src/components/dashboard/__tests__/CategoryTrendChart.test.tsx`
- `src/app/api/dashboard/__tests__/global.test.ts`
- `src/app/api/dashboard/__tests__/monthly.test.ts`
- `src/app/api/dashboard/__tests__/category-trend.test.ts`

## 7. Rationale & Context

The current home page (`/`) simply redirects to `/bills`, providing no analytical value. Users currently need to click through individual bills to understand their spending patterns. A dashboard addresses this by:

- **Global view**: Reveals month-over-month spending trends, helping users spot unusual months or seasonal patterns. The stacked bar chart adds category context that the monthly total line chart alone cannot provide.
- **Budget projection**: The cumulative spending chart with prorated budget line gives users a visual cue of whether they are on track to stay within the BRL 10,000 goal. Using the last transaction date as "today" accommodates the non-automatic import workflow — the projection is always relative to the most recent data point.
- **Category drill-down**: The pie chart + table combination serves both visual and analytical preferences. Making categories clickable enables exploration of specific spending categories across months without navigating away from the dashboard.

Recharts was chosen because:
- It is the most popular React-native charting library (no DOM manipulation)
- It integrates naturally with React's component model and state management
- It supports all required chart types (Line, Bar, Pie) with responsive containers
- It has built-in support for custom tooltips, gradients, and interactive elements

## 8. Dependencies & External Integrations

### Third-Party Services
- **SVC-001**: Recharts - React charting library providing LineChart, PieChart, BarChart, ResponsiveContainer, Tooltip, and Legend components.

### Infrastructure Dependencies
- **INF-001**: Prisma + SQLite - Existing database infrastructure used to aggregate dashboard data via new API endpoints.
- **INF-002**: Next.js 16 App Router - Required for the `/` dashboard route and new `/api/dashboard/*` API routes.

### Data Dependencies
- **DAT-001**: Existing Bill, Transaction, and Category tables - All dashboard aggregations derive from these existing models with no schema changes.

### Technology Platform Dependencies
- **PLT-001**: Recharts ^2.x - Chart rendering library. Must be added to `package.json` as a runtime dependency.
- **PLT-002**: TypeScript - Type definitions for Recharts (`@types/recharts`) if needed.

### Compliance Dependencies
None.

## 9. Examples & Edge Cases

### Cumulative Spending Calculation
```typescript
// Example: transactions sorted by date within a bill
const transactions = [
  { date: "2026-04-03", amount: 450.00 },
  { date: "2026-04-03", amount: 120.00 },
  { date: "2026-04-10", amount: 2300.00 },
  { date: "2026-04-25", amount: 89.90 },
];

// Running totals grouped by day:
// day 3:   570.00
// day 10:  2870.00
// day 25:  2959.90
```

### Prorated Budget Calculation
```typescript
const BUDGET_GOAL = 10000;
const daysInMonth = 30; // April
const lastTransactionDay = 25; // last transaction is April 25

// Prorated budget at day 25:
const proratedBudget = (BUDGET_GOAL / daysInMonth) * lastTransactionDay;
// = 333.33 * 25 = BRL 8,333.33

// Daily budget line points (for chart):
// (day 1, 333.33), (day 2, 666.67), ..., (day 25, 8333.33),
// (day 26, 8333.33)... (day 30, 8333.33)
```

### Edge Cases
1. **No bills exist**: Both sections render with empty states — "No data available" messages instead of charts.
2. **Single bill**: The stacked bar chart in Global section shows only one column; the monthly charts show data for that bill.
3. **All uncategorized transactions**: The pie chart and table show 100% "Uncategorized". The stacked bar chart shows all spending in the "Uncategorized" category.
4. **Refunds (negative amounts)**: These are included in totals and cumulative calculations. A bill could theoretically have a negative total if refunds exceed charges.
5. **Category with zero spending in some months**: The CategoryTrendChart shows 0 for months where the category has no transactions (the line should connect through zero-value points).
6. **Multiple transactions on the same day**: The cumulative spending for that day aggregates all amounts; the chart shows a single data point per day.
7. **Bill with 31 days**: The prorated budget calculation uses `daysInMonth` derived from the bill's actual month (28/29 for February, 30 or 31 as applicable).
8. **Bill with only one transaction**: The cumulative curve is a single point stepping from 0 to total. The chart must handle single-point series without error.

## 10. Validation Criteria

- All Acceptance Criteria (AC-DSH-001 through AC-DSH-010) are satisfied
- All new and existing tests pass via `bun run test`
- `bun run lint` completes without errors
- TypeScript compilation completes without errors
- Dashboard renders correctly in the dark theme and is responsive down to 1024px viewport width
- New API endpoints return correct data shapes as defined in section 4
- Chart tooltips display formatted BRL currency values
- Category drill-down chart appears/disappears on click without page reload
- Month selector updates all charts reactively

## 11. Related Specifications / Further Reading

- [spec-design-multiple-bills.md](./spec-design-multiple-bills.md) - Existing Bill model specification that this dashboard depends on
- [spec-design-transaction-categorization.md](./spec-design-transaction-categorization.md) - Category model specification that provides category data for charts
- [AGENTS.md](../AGENTS.md) - Dev commands, tech stack, and project conventions
- [prisma/schema.prisma](../prisma/schema.prisma) - Existing data model (Bill, Transaction, Category)
- [Recharts Documentation](https://recharts.org/en-US/) - Library documentation for chart component API
