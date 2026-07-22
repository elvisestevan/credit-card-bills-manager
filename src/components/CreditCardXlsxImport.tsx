"use client";

import { useState, useRef, useEffect } from "react";
import { CreditCardXlsxPreviewItem } from "@/types";

export function CreditCardXlsxImport() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [items, setItems] = useState<CreditCardXlsxPreviewItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [userDescriptions, setUserDescriptions] = useState<Record<string, string>>({});
  const [billMonthYear, setBillMonthYear] = useState("");
  const [cardName, setCardName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handlePreview = async (file: File) => {
    if (!file.name.endsWith(".xlsx")) {
      setMessage({ type: "error", text: "Please select an XLSX file" });
      return;
    }

    setIsUploading(true);
    setMessage(null);
    setItems([]);
    setParseErrors([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/transactions/import/credit-card-xlsx/preview", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: result.error || "Failed to parse file" });
        if (result.errors) setParseErrors(result.errors);
      } else {
        setItems(result.items);
        setSelectedFile(file);
        setBillMonthYear(result.billMonthYear);
        setCardName(result.cardName);
        if (result.errors?.length > 0) setParseErrors(result.errors);
        if (result.items.length === 0) {
          setMessage({ type: "error", text: "No valid transactions found in the file" });
        }
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    const selectedIndices = items.filter((i) => i.selected).map((i) => i.index);
    if (selectedIndices.length === 0) {
      setMessage({ type: "error", text: "Select at least one transaction to import" });
      return;
    }

    setIsImporting(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("selectedIndices", JSON.stringify(selectedIndices));

      const selectedItems = items.filter((i) => i.selected);
      const filledUserDescriptions: Record<string, string> = {};
      selectedItems.forEach((item) => {
        const key = `${item.date}|${item.description}|${item.amount}`;
        if (userDescriptions[key]?.trim()) {
          filledUserDescriptions[key] = userDescriptions[key].trim();
        }
      });
      if (Object.keys(filledUserDescriptions).length > 0) {
        formData.append("userDescriptions", JSON.stringify(filledUserDescriptions));
      }

      const response = await fetch("/api/transactions/import/credit-card-xlsx/confirm", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: result.error || "Failed to import" });
      } else {
        setMessage({
          type: "success",
          text: `Imported ${result.added} transactions (${result.ignored} duplicates skipped)`,
        });
        setItems([]);
        setSelectedFile(null);
        setBillMonthYear("");
        setCardName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setIsImporting(false);
    }
  };

  const toggleItem = (index: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.index === index && !i.exists ? { ...i, selected: !i.selected } : i
      )
    );
  };

  const toggleAll = () => {
    const newItems = items.filter((i) => !i.exists);
    const allSelected = newItems.every((i) => i.selected);
    setItems((prev) =>
      prev.map((i) => (i.exists ? i : { ...i, selected: !allSelected }))
    );
  };

  const getAmountClass = (amount: number) => (amount < 0 ? "text-green-400" : "text-red-400");

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handlePreview(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePreview(file);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const resetUpload = () => {
    setItems([]);
    setSelectedFile(null);
    setMessage(null);
    setParseErrors([]);
    setUserDescriptions({});
    setBillMonthYear("");
    setCardName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const newItems = items.filter((i) => !i.exists);
  const hasData = newItems.length > 0;

  useEffect(() => {
    if (items.length === 0) return;
    const uniqueDescriptions = [...new Set(items.map((i) => i.description))];
    const fetchSuggestions = async () => {
      const suggestions: Record<string, string> = {};
      for (const desc of uniqueDescriptions) {
        try {
          const res = await fetch(`/api/transactions/user-description-suggestions?description=${encodeURIComponent(desc)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.userDescription) {
              const item = items.find((i) => i.description === desc);
              if (item) {
                const key = `${item.date}|${item.description}|${item.amount}`;
                suggestions[key] = data.userDescription;
              }
            }
          }
        } catch {
          // Ignore
        }
      }
      setUserDescriptions((prev) => ({ ...prev, ...suggestions }));
    };
    fetchSuggestions();
  }, [items]);

  return (
    <>
      {!hasData && (
        <div className="max-w-md mb-8">
          {billMonthYear && (
            <div className="mb-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700 text-sm">
              <p className="text-zinc-400">Bill: <span className="text-zinc-200">{billMonthYear}</span></p>
              {cardName && <p className="text-zinc-400">Card: <span className="text-zinc-200">{cardName}</span></p>}
            </div>
          )}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragging ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 hover:border-zinc-600"
            } ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleChange}
              className="hidden"
              disabled={isUploading}
            />
            <button
              type="button"
              onClick={handleClick}
              disabled={isUploading}
              className="w-full h-full bg-transparent border-none cursor-pointer"
            >
              <div className="text-zinc-400">
                {isUploading ? (
                  <p>Parsing file...</p>
                ) : (
                  <>
                    <p className="font-medium text-zinc-200">Drop your XLSX file here</p>
                    <p className="text-sm mt-1">or click to browse</p>
                  </>
                )}
              </div>
            </button>
          </div>

          {parseErrors.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-lg text-sm">
              <p className="font-medium mb-1">Parse warnings:</p>
              {parseErrors.map((e, i) => (
                <p key={i} className="text-xs">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {message && (
        <div
          className={`mb-6 p-3 rounded-lg text-sm whitespace-pre-line ${
            message.type === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {message.text}
        </div>
      )}

      {hasData && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-medium text-zinc-200">
                Preview ({newItems.length} transactions)
              </h2>
              <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newItems.every((i) => i.selected)}
                  onChange={toggleAll}
                  className="rounded border-zinc-600"
                />
                Select all
              </label>
            </div>
            <div className="flex gap-3">
              <button
                onClick={resetUpload}
                disabled={isImporting}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 border border-zinc-700 transition-colors"
              >
                Start Over
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting || newItems.filter((i) => i.selected).length === 0}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium disabled:opacity-50 transition-colors"
              >
                {isImporting ? "Importing..." : `Import Selected (${newItems.filter((i) => i.selected).length})`}
              </button>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="px-4 py-3 text-center text-sm font-medium text-zinc-400 w-12">
                    <input
                      type="checkbox"
                      checked={newItems.every((i) => i.selected)}
                      onChange={toggleAll}
                      className="rounded border-zinc-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Installment</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Label</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Amount</th>
                </tr>
              </thead>
              <tbody>
                {newItems.map((item) => (
                  <tr
                    key={item.index}
                    className={`border-b border-zinc-800 hover:bg-zinc-800/50 cursor-pointer ${
                      !item.selected ? "opacity-50" : ""
                    }`}
                    onClick={() => toggleItem(item.index)}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleItem(item.index)}
                        className="rounded border-zinc-600"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">{item.date}</td>
                    <td className="px-4 py-3 text-sm text-zinc-200">{item.description}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {item.installmentNumber && item.totalInstallments
                        ? `${item.installmentNumber}/${item.totalInstallments}`
                        : "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={userDescriptions[`${item.date}|${item.description}|${item.amount}`] || ""}
                        onChange={(e) => {
                          const key = `${item.date}|${item.description}|${item.amount}`;
                          setUserDescriptions((prev) => ({ ...prev, [key]: e.target.value }));
                        }}
                        placeholder="Add label..."
                        className="w-full bg-transparent border border-zinc-700 rounded px-2 py-0.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                      />
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${getAmountClass(item.amount)}`}>
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-sm text-zinc-500">
            {newItems.filter((i) => i.selected).length} of {newItems.length} new transactions selected
            {items.length > newItems.length && (
              <span className="ml-2">
                ({items.length - newItems.length} already imported — hidden)
              </span>
            )}
          </div>
        </>
      )}
    </>
  );
}
