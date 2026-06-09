"use client";

import { useState, useCallback } from "react";

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const parseBRL = (raw: string): number => {
  const cleaned = raw
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");
  return parseFloat(cleaned);
};

interface BudgetFormProps {
  currentAmount: number;
}

export function BudgetForm({ currentAmount }: BudgetFormProps) {
  const [value, setValue] = useState(() => formatBRL(currentAmount));
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const parsed = parseBRL(value);
  const isValid = !isNaN(parsed) && parsed > 0 && parsed < 100_000_000;

  const handleSave = useCallback(async () => {
    if (!isValid || isSaving) return;
    setIsSaving(true);
    setFeedback(null);
    setErrorMessage("");

    try {
      const response = await fetch("/api/budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed }),
      });

      if (!response.ok) {
        const data = await response.json();
        setFeedback("error");
        setErrorMessage(data.error || "Failed to save");
        return;
      }

      setFeedback("success");
    } catch {
      setFeedback("error");
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [isValid, isSaving, parsed]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9,]/g, "");
    setValue(raw);
    setFeedback(null);
    setErrorMessage("");
  };

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="budget-amount"
          className="block text-sm text-zinc-400 mb-2"
        >
          Monthly Budget Goal
        </label>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-lg">R$</span>
          <input
            id="budget-amount"
            type="text"
            inputMode="decimal"
            value={value}
            onChange={handleChange}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200 text-lg w-48 focus:outline-none focus:ring-2 focus:ring-zinc-600"
          />
        </div>
        {!isValid && value.length > 0 && (
          <p className="text-red-400 text-sm mt-1">
            Enter a valid positive amount
          </p>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={!isValid || isSaving}
        className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200 px-6 py-2 rounded-lg text-sm transition-colors"
      >
        {isSaving ? "Saving..." : "Save Changes"}
      </button>

      {feedback === "success" && (
        <p className="text-emerald-400 text-sm">Saved!</p>
      )}
      {feedback === "error" && (
        <p className="text-red-400 text-sm">{errorMessage}</p>
      )}

      <p className="text-zinc-500 text-sm">
        Current goal: R$ {formatBRL(currentAmount)}
      </p>
    </div>
  );
}
