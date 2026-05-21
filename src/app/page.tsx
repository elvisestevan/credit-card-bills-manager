"use client";

import { GlobalSection } from "@/components/dashboard/GlobalSection";
import { MonthlySection } from "@/components/dashboard/MonthlySection";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Overview of your credit card spending
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-12">
        <GlobalSection />
        <MonthlySection />
      </main>
    </div>
  );
}
