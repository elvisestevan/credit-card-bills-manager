import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { BudgetForm } from "../BudgetForm";

describe("BudgetForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders with current amount", () => {
    render(<BudgetForm currentAmount={10000} />);
    expect(screen.getByDisplayValue("10.000,00")).toBeInTheDocument();
  });

  it("shows the current goal text", () => {
    render(<BudgetForm currentAmount={10000} />);
    expect(screen.getByText("Current goal: R$ 10.000,00")).toBeInTheDocument();
  });

  it("calls PUT /api/budget on save", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ amount: 15000 }),
    });

    render(<BudgetForm currentAmount={10000} />);

    const input = screen.getByDisplayValue("10.000,00");
    fireEvent.change(input, { target: { value: "15000" } });

    const saveButton = screen.getByText("Save Changes");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/budget",
        expect.objectContaining({
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 15000 }),
        })
      );
    });
  });

  it("disables save button while saving", async () => {
    (global.fetch as any).mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve({ amount: 15000 }),
              }),
            100
          )
        )
    );

    render(<BudgetForm currentAmount={10000} />);

    const input = screen.getByDisplayValue("10.000,00");
    fireEvent.change(input, { target: { value: "15000" } });

    const saveButton = screen.getByText("Save Changes");
    fireEvent.click(saveButton);

    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("shows success feedback after saving", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ amount: 15000 }),
    });

    render(<BudgetForm currentAmount={10000} />);

    const input = screen.getByDisplayValue("10.000,00");
    // simulate user typing — clear first, then type
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "15000" } });

    const saveButton = screen.getByText("Save Changes");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText("Saved!")).toBeInTheDocument();
    });
  });

  it("shows error on save failure", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Invalid amount" }),
    });

    render(<BudgetForm currentAmount={10000} />);

    const input = screen.getByDisplayValue("10.000,00");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "15000" } });

    const saveButton = screen.getByText("Save Changes");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText("Invalid amount")).toBeInTheDocument();
    });
  });

  it("shows network error on fetch failure", async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

    render(<BudgetForm currentAmount={10000} />);

    const input = screen.getByDisplayValue("10.000,00");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "15000" } });

    const saveButton = screen.getByText("Save Changes");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText("Network error. Please try again.")).toBeInTheDocument();
    });
  });

  it("validates amount must be positive", async () => {
    render(<BudgetForm currentAmount={10000} />);

    const input = screen.getByDisplayValue("10.000,00");
    fireEvent.change(input, { target: { value: "0" } });

    const saveButton = screen.getByText("Save Changes");
    expect(saveButton).toBeDisabled();
  });
});
