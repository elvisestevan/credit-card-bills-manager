"use client";

import { TransactionListView } from "@/components/TransactionListView";

export default function TransactionsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-semibold text-white">All Transactions</h1>
          <p className="text-sm text-zinc-400 mt-1">
            View and manage all transactions across all bills
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <TransactionListView
          fetchUrl="/api/transactions"
          showBillColumn
        />
      </main>
    </div>
  );
}
