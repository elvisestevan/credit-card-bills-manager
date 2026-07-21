"use client";

import { useState, useEffect, useRef } from "react";

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function parseDate(str: string): Date | null {
  const parts = str.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
      return new Date(y, m - 1, d);
    }
  }
  const isoParts = str.split("-");
  if (isoParts.length === 3) {
    const [y, m, d] = isoParts.map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m - 1, d);
    }
  }
  return null;
}

interface RecentTransaction {
  id: number;
  date: string;
  description: string;
  amount: string;
  isNegative: boolean;
}

export function ManualEntryForm() {
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [amountCents, setAmountCents] = useState(0);
  const [isNegative, setIsNegative] = useState(false);
  const [transactionType, setTransactionType] = useState<"credit_card" | "checking_account">("credit_card");
  const [cardName, setCardName] = useState("");
  const [category, setCategory] = useState("");
  const [showInstallments, setShowInstallments] = useState(false);
  const [installmentNumber, setInstallmentNumber] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("");
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [userDescription, setUserDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dateRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const hasUserSetCategory = useRef(false);

  async function fetchRecentManual(limit = 5) {
    try {
      const res = await fetch(`/api/transactions?source=manual&limit=${limit}&sortBy=date&sortOrder=desc`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.data) {
        setRecentTransactions(
          data.data.map((tx: { id: number; date: string; description: string; amount: string }) => ({
            id: tx.id,
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            isNegative: parseFloat(tx.amount) < 0,
          }))
        );
      }
    } catch {
      // Ignore network errors
    }
  }

  useEffect(() => {
    setDate(formatDate(new Date()));
    const savedCardName = localStorage.getItem("addTransactionCardName");
    if (savedCardName) setCardName(savedCardName);
    dateRef.current?.focus();
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCategories(data.map((c: { name: string }) => c.name));
      })
      .catch(console.error);
    fetchRecentManual(5);
  }, []);

  useEffect(() => {
    const trimmed = description.trim();
    if (!trimmed) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/transactions/user-description-suggestions?description=" + encodeURIComponent(trimmed));
        if (res.ok) {
          const data = await res.json();
          if (data.userDescription && !userDescription) {
            setUserDescription(data.userDescription);
          }
          if (data.categoryName && !hasUserSetCategory.current && !category) {
            setCategory(data.categoryName);
          }
        }
      } catch {
        // Ignore network errors
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [description, userDescription]);

  const amountDisplay = `${isNegative ? "−" : ""}${(amountCents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^\d]/g, "");
    setAmountCents(parseInt(digits, 10) || 0);
  };

  const resetForm = () => {
    setDate(formatDate(new Date()));
    setDescription("");
    setUserDescription("");
    setAmountCents(0);
    setIsNegative(false);
    setTransactionType("credit_card");
    setCategory("");
    setShowInstallments(false);
    setInstallmentNumber("");
    setTotalInstallments("");
    dateRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const parsedDate = parseDate(date);
    if (!parsedDate) {
      setMessage({ type: "error", text: "Data inválida" });
      return;
    }
    if (!description.trim()) {
      setMessage({ type: "error", text: "Descrição é obrigatória" });
      return;
    }
    if (amountCents === 0) {
      setMessage({ type: "error", text: "Valor é obrigatório" });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const amount = (amountCents / 100) * (isNegative ? -1 : 1);
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: parsedDate.toISOString().split("T")[0],
          description: description.trim(),
          userDescription: userDescription.trim() || undefined,
          amount,
          transactionType,
          cardName: cardName.trim() || undefined,
          categoryName: category.trim() || undefined,
          installmentNumber: installmentNumber ? parseInt(installmentNumber, 10) : undefined,
          totalInstallments: totalInstallments ? parseInt(totalInstallments, 10) : undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setMessage({ type: "error", text: data.error || "Erro ao criar transação" });
        return;
      }

      if (cardName.trim()) {
        localStorage.setItem("addTransactionCardName", cardName.trim());
      }

      fetchRecentManual(showAllRecent ? 100 : 5);

      setMessage({ type: "success", text: "Adicionada!" });
      resetForm();

      setTimeout(() => setMessage(null), 1500);
    } catch {
      setMessage({ type: "error", text: "Erro de conexão" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "f" || e.key === "F") && document.activeElement === amountRef.current) {
      e.preventDefault();
      setIsNegative((prev) => !prev);
      return;
    }

    if (e.key === "?") {
      e.preventDefault();
      setShowShortcuts((prev) => !prev);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      resetForm();
      return;
    }

    if (document.activeElement === dateRef.current) {
      if (e.key === "t") {
        e.preventDefault();
        setDate(formatDate(new Date()));
      } else if (e.key === "y") {
        e.preventDefault();
        const d = new Date();
        d.setDate(d.getDate() - 1);
        setDate(formatDate(d));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const d = parseDate(date) || new Date();
        d.setDate(d.getDate() + 1);
        setDate(formatDate(d));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const d = parseDate(date) || new Date();
        d.setDate(d.getDate() - 1);
        setDate(formatDate(d));
      }
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div onKeyDown={handleKeyDown}>
      <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
        {message && (
          <div
            className={`mb-4 px-4 py-2 rounded text-sm ${
              message.type === "success"
                ? "bg-emerald-900/50 text-emerald-400 border border-emerald-800"
                : "bg-red-900/50 text-red-400 border border-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Date</label>
            <input
              ref={dateRef}
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-500"
              placeholder="dd/mm/aaaa"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value.toUpperCase())}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-500"
              placeholder="Ex: SUPERMERCADO"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Label (optional)</label>
            <input
              type="text"
              value={userDescription}
              onChange={(e) => setUserDescription(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-500"
              placeholder="Ex: Minha Netflix"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Amount</label>
            <div className="flex items-center gap-2">
              <input
                ref={amountRef}
                type="text"
                inputMode="numeric"
                value={amountDisplay}
                onChange={handleAmountChange}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-500 font-mono"
                placeholder="0,00"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setIsNegative((prev) => !prev)}
                className={`px-3 py-2 rounded border text-sm font-mono transition-colors ${
                  isNegative
                    ? "bg-green-900/30 border-green-800 text-green-400"
                    : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
                }`}
                title="Toggle sign (F)"
              >
                {isNegative ? "−" : "+"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => { hasUserSetCategory.current = true; setCategory(e.target.value); }}
              list="category-list"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-500"
              placeholder="Type or select"
              autoComplete="off"
            />
            <datalist id="category-list">
              {categories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Card</label>
            <input
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-500"
              placeholder="Ex: Nubank"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Type</label>
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value as "credit_card" | "checking_account")}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-500"
            >
              <option value="credit_card">Credit Card</option>
              <option value="checking_account">Checking Account</option>
            </select>
          </div>

          <div className="flex items-end">
            {!showInstallments ? (
              <button
                type="button"
                onClick={() => setShowInstallments(true)}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                + installments
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Parcel</label>
                  <input
                    type="number"
                    min="1"
                    value={installmentNumber}
                    onChange={(e) => setInstallmentNumber(e.target.value)}
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-500"
                    autoComplete="off"
                  />
                </div>
                <span className="text-zinc-500 mt-6">/</span>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Total</label>
                  <input
                    type="number"
                    min="1"
                    value={totalInstallments}
                    onChange={(e) => setTotalInstallments(e.target.value)}
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-500"
                    autoComplete="off"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setShowInstallments(false); setInstallmentNumber(""); setTotalInstallments(""); }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 mt-6 transition-colors"
                >
                  remove
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 rounded border border-zinc-600 text-zinc-100 transition-colors font-medium"
          >
            {isSubmitting ? "Adding..." : "Add"}
          </button>
        </div>
      </form>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-zinc-200 mb-4">Recently Added</h2>
        {recentTransactions.length === 0 ? (
          <p className="text-sm text-zinc-500">No transactions added yet.</p>
        ) : (
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-2 text-left text-sm font-medium text-zinc-400">Date</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-zinc-400">Description</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-zinc-400">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-zinc-800 last:border-0">
                    <td className="px-4 py-2 text-sm text-zinc-300">
                      {tx.date.slice(5)}
                    </td>
                    <td className="px-4 py-2 text-sm text-zinc-300">{tx.description}</td>
                    <td className={`px-4 py-2 text-sm text-right font-mono ${
                      tx.isNegative ? "text-green-400" : "text-zinc-100"
                    }`}>
                      {formatCurrency(Math.abs(parseFloat(tx.amount)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {recentTransactions.length > 0 && !showAllRecent && (
          <button
            type="button"
            onClick={() => { setShowAllRecent(true); fetchRecentManual(100); }}
            className="mt-2 w-full py-2 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 rounded transition-colors"
          >
            Show more
          </button>
        )}
      </section>

      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-zinc-100 mb-4">Keyboard Shortcuts</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Enter</span>
                <span className="text-zinc-200">Submit transaction</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Escape</span>
                <span className="text-zinc-200">Reset form</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">F</span>
                <span className="text-zinc-200">Toggle amount sign (+/-)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">?</span>
                <span className="text-zinc-200">Toggle this help</span>
              </div>
              <div className="border-t border-zinc-700 my-2" />
              <p className="text-xs text-zinc-500 mb-2">When date field is focused:</p>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">t</span>
                <span className="text-zinc-200">Set date to today</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">y</span>
                <span className="text-zinc-200">Set date to yesterday</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">↑ / ↓</span>
                <span className="text-zinc-200">+1 / -1 day</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowShortcuts(false)}
              className="mt-6 w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 text-zinc-300 transition-colors text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
