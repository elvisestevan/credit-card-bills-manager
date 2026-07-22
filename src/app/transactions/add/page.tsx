"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FileUpload } from "@/components/FileUpload";
import { CheckingAccountImport } from "@/components/CheckingAccountImport";
import { CreditCardXlsxImport } from "@/components/CreditCardXlsxImport";
import { ManualEntryForm } from "@/components/ManualEntryForm";

const VALID_TABS = ["import-csv", "manual"] as const;
type Tab = (typeof VALID_TABS)[number];

function AddTransactionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab: Tab = (VALID_TABS as readonly string[]).includes(searchParams.get("tab") || "")
    ? (searchParams.get("tab") as Tab)
    : "import-csv";
  const [csvType, setCsvType] = useState<"credit_card" | "credit_card_xlsx" | "checking_account">("credit_card");

  const setTab = (tab: Tab) => {
    router.replace(`/transactions/add?tab=${tab}`);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-semibold text-white">
            Add Transactions
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Import CSV/XLSX files or manually enter transactions
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-1 mb-6 bg-zinc-900 rounded-lg p-1 border border-zinc-800 w-fit">
          <button
            onClick={() => setTab("import-csv")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "import-csv"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Import CSV
          </button>
          <button
            onClick={() => setTab("manual")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "manual"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Manual Entry
          </button>
        </div>

        {activeTab === "import-csv" && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Transaction Type
              </label>
              <select
                value={csvType}
                onChange={(e) => setCsvType(e.target.value as "credit_card" | "credit_card_xlsx" | "checking_account")}
                className="w-full max-w-xs px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="credit_card">Credit Card (CSV)</option>
                <option value="credit_card_xlsx">Credit Card (XLSX)</option>
                <option value="checking_account">Checking Account</option>
              </select>
            </div>

            {csvType === "credit_card" ? (
              <FileUpload onUploadComplete={() => {}} />
            ) : csvType === "credit_card_xlsx" ? (
              <CreditCardXlsxImport />
            ) : (
              <CheckingAccountImport />
            )}
          </>
        )}

        {activeTab === "manual" && <ManualEntryForm />}
      </main>
    </div>
  );
}

export default function AddTransactionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    }>
      <AddTransactionContent />
    </Suspense>
  );
}
