"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BillTransactionsResponse } from "@/types";
import { TransactionListView } from "@/components/TransactionListView";

interface BillTransactionsPageProps {
  params: Promise<{ billId: string }>;
}

interface BillSummary {
  totalTransactions: number;
  totalValue: number;
  totalInstallmentTransactions: number;
  totalInstallmentValue: number;
  lastInstallmentCount: number;
  lastInstallmentTotal: number;
}

export default function BillTransactionsPage({ params }: BillTransactionsPageProps) {
  const [billId, setBillId] = useState<string | null>(null);
  const [billMonthYear, setBillMonthYear] = useState<string | null>(null);
  const [summary, setSummary] = useState<BillSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);

  useEffect(() => {
    async function loadParams() {
      const resolved = await params;
      setBillId(resolved.billId);
    }
    loadParams();
  }, [params]);

  useEffect(() => {
    if (!billId) return;

    async function fetchBillData() {
      try {
        const response = await fetch(`/api/bills/${billId}/transactions?limit=0`);
        if (response.ok) {
          const result = await response.json() as BillTransactionsResponse;
          setBillMonthYear(result.bill.monthYear);
        }
      } catch (error) {
        console.error("Failed to fetch bill info:", error);
      }
    }
    fetchBillData();
  }, [billId]);

  useEffect(() => {
    if (!billId) return;

    async function fetchSummary() {
      setIsSummaryLoading(true);
      try {
        const response = await fetch(`/api/bills/${billId}/summary`);
        const data = await response.json();
        setSummary(data);
      } catch (error) {
        console.error("Failed to fetch bill summary:", error);
      } finally {
        setIsSummaryLoading(false);
      }
    }
    fetchSummary();
  }, [billId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (!billId) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50">
        <header className="bg-zinc-900 border-b border-zinc-800">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="text-center text-zinc-500">Loading...</div>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/bills"
                className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                ← Back to Bills
              </Link>
              <h1 className="text-2xl font-semibold text-white mt-2">
                Bill: {billMonthYear || billId}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <section className="mb-8">
          {isSummaryLoading ? (
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
              <div className="text-center text-zinc-500">Loading summary...</div>
            </div>
          ) : summary && summary.totalTransactions > 0 ? (
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
              <h3 className="text-sm font-medium text-zinc-400 mb-4">Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-zinc-500">Total Transactions</p>
                  <p className="text-lg font-semibold text-zinc-200">
                    {summary.totalTransactions}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Total Value</p>
                  <p className="text-lg font-semibold text-zinc-200">
                    {formatCurrency(summary.totalValue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Installment Transactions</p>
                  <p className="text-lg font-semibold text-zinc-200">
                    {summary.totalInstallmentTransactions}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Installment Value</p>
                  <p className="text-lg font-semibold text-zinc-200">
                    {formatCurrency(summary.totalInstallmentValue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Last Installments</p>
                  <p className="text-lg font-semibold text-zinc-200">
                    {summary.lastInstallmentCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Last Installments Total</p>
                  <p className="text-lg font-semibold text-zinc-200">
                    {formatCurrency(summary.lastInstallmentTotal)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section>
          <h2 className="text-lg font-medium text-zinc-200 mb-4">Transactions</h2>
          <TransactionListView
            fetchUrl={(params) => `/api/bills/${billId}/transactions?${params}`}
          />
        </section>
      </main>
    </div>
  );
}
