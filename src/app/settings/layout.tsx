import Link from "next/link";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-8">
        <nav className="w-48 shrink-0 space-y-1">
          <Link
            href="/settings/budget"
            className="block px-3 py-2 rounded-md text-sm bg-zinc-800 text-zinc-200"
          >
            Budget
          </Link>
        </nav>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
