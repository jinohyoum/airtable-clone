import Link from "next/link";

import { api } from "~/trpc/server";

export default async function BasePage({
  params,
}: {
  params: Promise<{ baseId: string }>;
}) {
  const { baseId } = await params;
  const tables = await api.table.list({ baseId });

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/"
            className="rounded-md bg-gray-200 px-3 py-2 text-sm hover:bg-gray-300"
          >
            ← Back to Bases
          </Link>
          <h1 className="text-3xl font-bold">Tables</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => (
            <Link
              key={table.id}
              href={`/base/${baseId}/table/${table.id}`}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <h2 className="text-xl font-semibold">{table.name}</h2>
              <p className="mt-2 text-sm text-gray-500">
                {table.createdAt.toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>

        {tables.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-500">
              No tables yet. Create one to get started.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
