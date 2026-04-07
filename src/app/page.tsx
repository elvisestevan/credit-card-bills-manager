"use client";

import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { TransactionsTable } from "@/components/TransactionsTable";
import { TransactionsSummary } from "@/components/TransactionsSummary";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-semibold text-white">
            Credit Card Bills Manager
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Import your Itau credit card statements
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <section className="mb-8">
          <h2 className="text-lg font-medium text-zinc-200 mb-4">Import CSV</h2>
          <FileUpload onUploadComplete={handleUploadComplete} />
        </section>

        <section className="mb-8">
          <TransactionsSummary refreshKey={refreshKey} />
        </section>

        <section>
          <h2 className="text-lg font-medium text-zinc-200 mb-4">
            Transactions
          </h2>
          <div className="bg-zinc-900 rounded-lg border border-zinc-800">
            <TransactionsTable refreshKey={refreshKey} />
          </div>
        </section>
      </main>
    </div>
  );
}
