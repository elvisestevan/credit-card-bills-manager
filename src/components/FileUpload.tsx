"use client";

import { useState, useRef } from "react";

interface FileUploadProps {
  onUploadComplete: () => void;
}

const BILL_MONTH_YEAR_REGEX = /^(0[1-9]|1[0-2])-\d{4}$/;

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [billMonthYear, setBillMonthYear] = useState("");
  const [billError, setBillError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateBillMonthYear = (value: string) => {
    if (!value) {
      setBillError("Bill ID is required");
      return false;
    }
    if (!BILL_MONTH_YEAR_REGEX.test(value)) {
      setBillError("Invalid format. Use MM-YYYY (e.g., 04-2026)");
      return false;
    }
    setBillError(null);
    return true;
  };

  const handleBillMonthYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBillMonthYear(value);
    if (billError) {
      validateBillMonthYear(value);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setMessage({ type: "error", text: "Please select a CSV file" });
      return;
    }

    if (!validateBillMonthYear(billMonthYear)) {
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("billMonthYear", billMonthYear);

      const response = await fetch("/api/transactions/import", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.conflicts && result.conflicts.length > 0) {
          const conflictMessages = result.conflicts
            .map(
              (c: { transaction: string; existingBill: string }) =>
                `"${c.transaction}" exists in bill ${c.existingBill}`
            )
            .join("\n");
          setMessage({
            type: "error",
            text: `${result.error}\n${conflictMessages}`,
          });
        } else {
          setMessage({
            type: "error",
            text: result.error || "Failed to import file",
          });
        }
      } else {
        setMessage({
          type: "success",
          text: `Imported ${result.added} transactions (${result.ignored} duplicates skipped)`,
        });
        setBillMonthYear("");
        onUploadComplete();
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
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
    if (file) handleFile(file);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-4">
        <label htmlFor="billMonthYear" className="block text-sm font-medium text-zinc-300 mb-2">
          Bill ID (MM-YYYY)
        </label>
        <input
          id="billMonthYear"
          type="text"
          value={billMonthYear}
          onChange={handleBillMonthYearChange}
          placeholder="e.g., 04-2026"
          className={`w-full px-3 py-2 bg-zinc-800 border rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 ${
            billError
              ? "border-red-500 focus:ring-red-500"
              : "border-zinc-700 focus:ring-blue-500"
          }`}
          disabled={isUploading}
        />
        {billError && (
          <p className="mt-1 text-sm text-red-400">{billError}</p>
        )}
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragging ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 hover:border-zinc-600"}
          ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
        `}
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
              <p>Importing...</p>
            ) : (
              <>
                <p className="font-medium text-zinc-200">Drop your CSV file here</p>
                <p className="text-sm mt-1">or click to browse</p>
              </>
            )}
          </div>
        </button>
      </div>

      {message && (
        <div
          className={`mt-4 p-3 rounded-lg text-sm whitespace-pre-line ${
            message.type === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
