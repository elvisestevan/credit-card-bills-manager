import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { CheckingAccountImport } from "../CheckingAccountImport";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/CategoryDropdown", () => ({
  CategoryDropdown: ({ suggestedCategory, value, onChange, ...props }: any) => (
    <div data-testid="category-dropdown" data-suggested={JSON.stringify(suggestedCategory)} data-value={value}>
      <button onClick={() => onChange(suggestedCategory?.id ?? null, suggestedCategory?.name)}>
        Select
      </button>
    </div>
  ),
}));

describe("CheckingAccountImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("passes suggestedCategory to CategoryDropdown from suggestions API", async () => {
    const previewItems = [
      { index: 0, date: "2026-01-15", description: "Netflix", amount: 39.9, billMonthYear: "01-2026", selected: true, exists: false },
    ];

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: previewItems }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userDescription: "Netflix Subscription", categoryName: "streaming", categoryId: 5 }),
      });

    render(<CheckingAccountImport />);

    const file = new File(["date;description;amount\n15/01/2026;Netflix;39,90"], "test.csv", { type: "text/csv" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      const dropdown = screen.getByTestId("category-dropdown");
      expect(dropdown).toHaveAttribute("data-suggested", JSON.stringify({ id: 5, name: "streaming" }));
    });
  });

  it("does not pass suggestedCategory when API returns no category", async () => {
    const previewItems = [
      { index: 0, date: "2026-01-15", description: "Unknown", amount: 10.0, billMonthYear: "01-2026", selected: true, exists: false },
    ];

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: previewItems }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userDescription: null, categoryName: null, categoryId: null }),
      });

    render(<CheckingAccountImport />);

    const file = new File(["date;description;amount\n15/01/2026;Unknown;10,00"], "test.csv", { type: "text/csv" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      const dropdown = screen.getByTestId("category-dropdown");
      expect(dropdown).toHaveAttribute("data-suggested", "null");
    });
  });
});
