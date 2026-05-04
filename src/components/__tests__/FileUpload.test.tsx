import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { FileUpload } from "../FileUpload";

describe("FileUpload", () => {
  const mockOnUploadComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders upload area correctly", () => {
    render(<FileUpload onUploadComplete={mockOnUploadComplete} />);

    expect(screen.getByText("Drop your CSV file here")).toBeInTheDocument();
    expect(screen.getByText("or click to browse")).toBeInTheDocument();
  });

  it("renders bill ID input field", () => {
    render(<FileUpload onUploadComplete={mockOnUploadComplete} />);

    expect(screen.getByLabelText("Bill ID (MM-YYYY)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g., 04-2026")).toBeInTheDocument();
  });

  it("rejects non-CSV file", async () => {
    render(<FileUpload onUploadComplete={mockOnUploadComplete} />);

    const file = new File(["content"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Please select a CSV file")).toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects import if bill ID is empty", async () => {
    render(<FileUpload onUploadComplete={mockOnUploadComplete} />);

    const file = new File(["data,lançamento,valor\n2024-01-01,Test,-100"], "test.csv", {
      type: "text/csv",
    });

    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Bill ID is required")).toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects invalid bill ID format", async () => {
    render(<FileUpload onUploadComplete={mockOnUploadComplete} />);

    const billInput = screen.getByLabelText("Bill ID (MM-YYYY)");
    fireEvent.change(billInput, { target: { value: "April 2026" } });

    const file = new File(["data,lançamento,valor\n2024-01-01,Test,-100"], "test.csv", {
      type: "text/csv",
    });

    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Invalid format. Use MM-YYYY (e.g., 04-2026)")).toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows loading state during upload", async () => {
    (global.fetch as any).mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve({ added: 1, ignored: 0 }),
              }),
            100
          )
        )
    );

    render(<FileUpload onUploadComplete={mockOnUploadComplete} />);

    const billInput = screen.getByLabelText("Bill ID (MM-YYYY)");
    fireEvent.change(billInput, { target: { value: "04-2026" } });

    const file = new File(["data,lançamento,valor\n2024-01-01,Test,-100"], "test.csv", {
      type: "text/csv",
    });

    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("Importing...")).toBeInTheDocument();
  });

  it("successfully uploads CSV file with bill ID", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ added: 2, ignored: 0 }),
    });

    render(<FileUpload onUploadComplete={mockOnUploadComplete} />);

    const billInput = screen.getByLabelText("Bill ID (MM-YYYY)");
    fireEvent.change(billInput, { target: { value: "04-2026" } });

    const file = new File(["data,lançamento,valor\n2024-01-01,Test,-100"], "test.csv", {
      type: "text/csv",
    });

    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Imported 2 transactions (0 duplicates skipped)")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/transactions/import",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows success message with skipped duplicates", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ added: 1, ignored: 1 }),
    });

    render(<FileUpload onUploadComplete={mockOnUploadComplete} />);

    const billInput = screen.getByLabelText("Bill ID (MM-YYYY)");
    fireEvent.change(billInput, { target: { value: "04-2026" } });

    const file = new File(["data,lançamento,valor\n2024-01-01,Test,-100"], "test.csv", {
      type: "text/csv",
    });

    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Imported 1 transactions (1 duplicates skipped)")).toBeInTheDocument();
    });
  });

  it("calls onUploadComplete after successful upload", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ added: 1, ignored: 0 }),
    });

    render(<FileUpload onUploadComplete={mockOnUploadComplete} />);

    const billInput = screen.getByLabelText("Bill ID (MM-YYYY)");
    fireEvent.change(billInput, { target: { value: "04-2026" } });

    const file = new File(["data,lançamento,valor\n2024-01-01,Test,-100"], "test.csv", {
      type: "text/csv",
    });

    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockOnUploadComplete).toHaveBeenCalled();
    });
  });

  it("shows error message on upload failure", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Failed to parse CSV" }),
    });

    render(<FileUpload onUploadComplete={mockOnUploadComplete} />);

    const billInput = screen.getByLabelText("Bill ID (MM-YYYY)");
    fireEvent.change(billInput, { target: { value: "04-2026" } });

    const file = new File(["invalid"], "test.csv", { type: "text/csv" });

    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Failed to parse CSV")).toBeInTheDocument();
    });
  });

  it("shows conflict error message", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: "Conflicting transactions found in other bills",
        conflicts: [
          { transaction: "Netflix - 2024-01-01 - $100", existingBill: "03-2026" },
        ],
      }),
    });

    render(<FileUpload onUploadComplete={mockOnUploadComplete} />);

    const billInput = screen.getByLabelText("Bill ID (MM-YYYY)");
    fireEvent.change(billInput, { target: { value: "04-2026" } });

    const file = new File(["data,lançamento,valor\n2024-01-01,Netflix,-100"], "test.csv", {
      type: "text/csv",
    });

    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Conflicting transactions found in other bills/)).toBeInTheDocument();
    });
  });

  it("shows generic error when no error message provided", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    });

    render(<FileUpload onUploadComplete={mockOnUploadComplete} />);

    const billInput = screen.getByLabelText("Bill ID (MM-YYYY)");
    fireEvent.change(billInput, { target: { value: "04-2026" } });

    const file = new File(["invalid"], "test.csv", { type: "text/csv" });

    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Failed to import file")).toBeInTheDocument();
    });
  });

  it("shows network error message", async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

    render(<FileUpload onUploadComplete={mockOnUploadComplete} />);

    const billInput = screen.getByLabelText("Bill ID (MM-YYYY)");
    fireEvent.change(billInput, { target: { value: "04-2026" } });

    const file = new File(["data"], "test.csv", { type: "text/csv" });

    const input = screen.getByRole("button").parentElement?.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Network error. Please try again.")).toBeInTheDocument();
    });
  });
});
