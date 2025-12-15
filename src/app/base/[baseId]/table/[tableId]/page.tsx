import Link from "next/link";

export default async function TablePage({
  params,
}: {
  params: Promise<{ baseId: string; tableId: string }>;
}) {
  const { baseId, tableId } = await params;

  return (
    <main className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/base/${baseId}`}
            className="rounded-md bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
          >
            ← Back to Tables
          </Link>
          <h1 className="text-xl font-semibold">Table: {tableId}</h1>
        </div>
      </div>

      {/* Grid area - empty for now */}
      <div className="flex-1 p-6">
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">Grid view coming soon...</p>
          <p className="mt-2 text-sm text-gray-400">
            This will contain the table grid with rows and columns
          </p>
        </div>
      </div>
    </main>
  );
}
