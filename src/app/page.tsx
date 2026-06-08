"use client";

import { useState } from "react";
import { GlobalSection } from "@/components/dashboard/GlobalSection";
import { MonthlySection } from "@/components/dashboard/MonthlySection";
import { TransactionType } from "@/types";

type TabId = "all" | TransactionType;

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "credit_card", label: "Credit Card" },
  { id: "checking_account", label: "Checking Account" },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("all");

  const typeParam = activeTab === "all" ? undefined : activeTab;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Overview of your spending
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-12">
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                activeTab === tab.id
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <GlobalSection transactionType={typeParam} />
        <MonthlySection transactionType={typeParam} />
      </main>
    </div>
  );
}
