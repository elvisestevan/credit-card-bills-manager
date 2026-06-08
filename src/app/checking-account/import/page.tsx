"use client";

import { useState, useRef } from "react";
import { CheckingAccountPreviewItem } from "@/types";

export default function CheckingAccountImportPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [items, setItems] = useState<CheckingAccountPreviewItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handlePreview = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setMessage({ type: "error", text: "Please select a CSV file" });
      return;
    }

    setIsUploading(true);
    setMessage(null);
    setItems([]);
    setParseErrors([]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "checking_account");

      const response = await fetch("/api/transactions/import/checking-account/preview", {
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

      const response = await fetch("/api/transactions/import/checking-account/confirm", {
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
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setIsImporting(false);
    }
  };

  const toggleItem = (index: number) => {
    setItems((prev) => prev.map((i) => (i.index === index ? { ...i, selected: !i.selected } : i)));
  };

  const toggleAll = () => {
    const allSelected = items.every((i) => i.selected);
    setItems((prev) => prev.map((i) => ({ ...i, selected: !allSelected })));
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

  const hasData = items.length > 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-semibold text-white">
            Import Checking Account Transactions
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Upload your checking account CSV file, select transactions to import
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {!hasData && (
          <div className="max-w-md mx-auto mb-8">
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
                accept=".csv"
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
                      <p className="font-medium text-zinc-200">Drop your CSV file here</p>
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
                  Preview ({items.length} transactions)
                </h2>
                <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={items.every((i) => i.selected)}
                    onChange={toggleAll}
                    className="rounded border-zinc-600"
                  />
                  Select all
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setItems([]);
                    setSelectedFile(null);
                    setMessage(null);
                    setParseErrors([]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  disabled={isImporting}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 border border-zinc-700 transition-colors"
                >
                  Start Over
                </button>
                <button
                  onClick={handleImport}
                  disabled={isImporting || items.filter((i) => i.selected).length === 0}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium disabled:opacity-50 transition-colors"
                >
                  {isImporting ? "Importing..." : `Import Selected (${items.filter((i) => i.selected).length})`}
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
                        checked={items.every((i) => i.selected)}
                        onChange={toggleAll}
                        className="rounded border-zinc-600"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Description</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Amount</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-zinc-400">Bill (MM-YYYY)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
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
                      <td className={`px-4 py-3 text-sm text-right font-medium ${getAmountClass(item.amount)}`}>
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-zinc-400">{item.billMonthYear}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-sm text-zinc-500">
              {items.filter((i) => i.selected).length} of {items.length} selected
              {items.filter((i) => !i.selected && i.amount <= 0).length > 0 && (
                <span className="ml-2">
                  ({items.filter((i) => !i.selected && i.amount <= 0).length} credit transactions auto-unselected)
                </span>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
