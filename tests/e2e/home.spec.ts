import { test, expect } from "@playwright/test";
import { execSync } from "child_process";

const fixturesDir = "/home/elvis/workspace/typescript/credit-card-bills-manager/feat-end-to-end-tests/tests/fixtures";
const testDbPath = "/home/elvis/workspace/typescript/credit-card-bills-manager/feat-end-to-end-tests/tests/e2e-test.db";
const devDbPath = "/home/elvis/workspace/typescript/credit-card-bills-manager/feat-end-to-end-tests/dev.db";

function resetTestDatabase() {
  execSync(`cp ${devDbPath} ${testDbPath}`, { stdio: "ignore" });
}

test.describe("Home Page E2E", () => {
  test.beforeEach(() => {
    resetTestDatabase();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("1. should show empty state message when no transactions", async ({ page }) => {
    await expect(page.getByText("No transactions yet. Import a CSV file to get started.")).toBeVisible();
  });

  test("2. should upload valid CSV and show transactions in table", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(`${fixturesDir}/valid.csv`);
    await page.waitForTimeout(1000);

    await expect(page.getByText(/Imported \d+ transactions/)).toBeVisible({ timeout: 10000 });

    await expect(page.getByText("AMAZON")).toBeVisible();
    await expect(page.getByText("NETFLIX")).toBeVisible();
    await expect(page.getByText("SUPERMARKET")).toBeVisible();
  });

  test("3. should show error for invalid file type", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(`${fixturesDir}/invalid-format.csv`);

    await expect(page.getByText(/Failed to parse CSV/)).toBeVisible();
  });

  test("4. should display table with correct columns", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(`${fixturesDir}/valid.csv`);

    await expect(page.getByText("Date")).toBeVisible();
    await expect(page.getByText("Description")).toBeVisible();
    await expect(page.getByText("Amount")).toBeVisible();
    await expect(page.getByText("Installments")).toBeVisible();

    await expect(page.getByText("2024-01-01")).toBeVisible();
    await expect(page.getByText("AMAZON")).toBeVisible();
  });

  test("5. should sort table by clicking column headers", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(`${fixturesDir}/valid.csv`);

    await expect(page.getByText(/Imported \d+ transactions/)).toBeVisible();

    await expect(page.getByRole("columnheader", { name: /Date/i })).toContainText("↓");

    const dateHeader = page.getByRole("columnheader", { name: /Date/i });
    await dateHeader.click();
    await expect(page.getByRole("columnheader", { name: /Date/i })).toContainText("↑");

    await dateHeader.click();
    await expect(page.getByRole("columnheader", { name: /Date/i })).toContainText("↓");
  });

  test("6. should paginate when there are more than 20 transactions", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(`${fixturesDir}/many-transactions.csv`);

    await expect(page.getByText(/Imported \d+ transactions/)).toBeVisible();

    await expect(page.getByText("Page 1 of 2")).toBeVisible();

    const nextButton = page.locator("button").filter({ hasText: "Next" }).nth(0);
    await nextButton.click();
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
  });

  test("7. should display summary cards after import", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(`${fixturesDir}/valid.csv`);

    await expect(page.getByText("Total Transactions")).toBeVisible();
    await expect(page.getByText("Total Value")).toBeVisible();
    await expect(page.getByText("Installment Transactions")).toBeVisible();
    await expect(page.getByText("Installment Value")).toBeVisible();

    await expect(page.getByText("5", { exact: true }).first()).toBeVisible();
  });

  test("8. should handle duplicates when re-uploading same CSV", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(`${fixturesDir}/valid.csv`);

    await expect(page.getByText(/Imported \d+ transactions/)).toBeVisible();

    await fileInput.setInputFiles(`${fixturesDir}/valid.csv`);
    await expect(page.getByText(/\d+ duplicates skipped/)).toBeVisible();
  });

  test("9. should parse installments correctly", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(`${fixturesDir}/with-installments.csv`);

    await expect(page.getByText("1/3")).toBeVisible();
    await expect(page.getByText("2/3")).toBeVisible();
    await expect(page.getByText("1/2")).toBeVisible();
  });
});