"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { CategoryDropdown } from "@/components/CategoryDropdown";
import { SimilarTransactionsModal } from "@/components/SimilarTransactionsModal";

export default function ImportReviewPage() {
  const params = useParams();
  const router = useRouter();
  const importId = params.importId as string;

  const [transactions, setTransactions] = useState<ImportTransaction[]>([]);
  const [categorySelections, setCategorySelections] = useState<Record<number, { categoryId: number | null; categoryName?: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveComplete, setSaveComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similarDescription, setSimilarDescription] = useState<string | null>(null);
  const [billMonthYear, setBillMonthYear] = useState<string>("");

  const fetchImport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/transactions/import/${importId}`);
      if (!response.ok) {
        setError("Import not found");
        return;
      }
      const data = await response.json();
      setTransactions(data.transactions);
      setBillMonthYear(data.billMonthYear);
    } catch {
      setError("Failed to load import data");
    } finally {
      setIsLoading(false);
    }
  }, [importId]);

  useEffect(() => {
    fetchImport();
  }, [fetchImport]);

  const handleCategoryChange = (transactionId: number, categoryId: number | null, categoryName?: string) => {
    setCategorySelections((prev) => ({
      ...prev,
      [transactionId]: { categoryId, categoryName },
    }));
  };

  const getEffectiveCategory = (t: ImportTransaction) => {
    const selection = categorySelections[t.id];
    if (selection) {
      if (selection.categoryId !== null) return selection.categoryId;
      return null;
    }
    if (t.suggestedCategoryId !== null) return t.suggestedCategoryId;
    return null;
  };

  const getEffectiveCategoryName = (t: ImportTransaction) => {
    const selection = categorySelections[t.id];
    if (selection) {
      if (selection.categoryName) return selection.categoryName;
      if (selection.categoryId !== null) return null;
      return undefined;
    }
    return undefined;
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const updates = transactions.map(async (t) => {
        const selection = categorySelections[t.id];
        const categoryId = selection?.categoryId ?? t.suggestedCategoryId;
        const categoryName = selection?.categoryName;

        if (categoryId === null && !categoryName) return;

        const body: { categoryId?: number; categoryName?: string } = {};
        if (categoryName) {
          body.categoryName = categoryName;
        } else if (categoryId) {
          body.categoryId = categoryId;
        }

        if (Object.keys(body).length === 0) return;

        const response = await fetch(`/api/transactions/${t.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`Failed to update transaction ${t.id}`);
        }
      });

      await Promise.all(updates);
      setSaveComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const formatAmount = (amount: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Math.abs(parseFloat(amount)));
  };

  const getAmountClass = (amount: string) => {
    const num = parseFloat(amount);
    return num < 0 ? "text-green-400" : "text-red-400";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => router.push("/bills")}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-200"
        >
          Back to Bills
        </button>
      </div>
    );
  }

  if (saveComplete) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center justify-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white mb-2">
            Categories Saved
          </h1>
          <p className="text-zinc-400">
            Categories have been applied to the imported transactions.
          </p>
        </div>
        <button
          onClick={() => router.push("/bills")}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded text-white transition-colors"
        >
          Back to Bills
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">
                Review Imported Transactions
              </h1>
              <p className="text-sm text-zinc-400 mt-1">
                {billMonthYear && `Bill: ${billMonthYear}`} &middot; {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={() => router.push("/bills")}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors"
            >
              Back to Bills
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Installments</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Category</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                  <td className="px-4 py-3 text-sm text-zinc-300">{t.date}</td>
                  <td className="px-4 py-3 text-sm text-zinc-200">{t.description}</td>
                  <td className="px-4 py-3 text-sm text-zinc-300">
                    {t.installmentNumber && t.totalInstallments
                      ? `${t.installmentNumber}/${t.totalInstallments}`
                      : "-"}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${getAmountClass(t.amount)}`}>
                    {formatAmount(t.amount)}
                  </td>
                  <td className="px-4 py-3 text-sm min-w-[250px]">
                    <CategoryDropdown
                      value={getEffectiveCategory(t)}
                      categoryName={getEffectiveCategoryName(t)}
                      onChange={(categoryId, categoryName) =>
                        handleCategoryChange(t.id, categoryId, categoryName)
                      }
                      suggestedCategory={
                        t.suggestedCategoryId
                          ? { id: t.suggestedCategoryId, name: t.suggestedCategoryName ?? "" }
                          : null
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setSimilarDescription(t.description)}
                      className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 text-zinc-300 transition-colors"
                    >
                      View Similar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium disabled:opacity-50 transition-colors"
          >
            {isSaving ? "Saving..." : "Save All Categories"}
          </button>
        </div>
      </main>

      {similarDescription && (
        <SimilarTransactionsModal
          description={similarDescription}
          onClose={() => setSimilarDescription(null)}
        />
      )}
    </div>
  );
}
