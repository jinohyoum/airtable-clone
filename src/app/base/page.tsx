import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { api } from "~/trpc/server";
import Link from "next/link";
import BasePageHeader from "./_components/BasePageHeader";

export default async function BasesPage() {
  const session = await auth();
  if (!session) redirect("/signin");

  // Get user's bases
  const bases = await api.base.list();

  return (
    <div className="min-h-screen bg-gray-50">
      <BasePageHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">Home</h1>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-medium text-gray-900">All Bases</h2>
        </div>

        {bases.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">You don't have any bases yet.</p>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Create your first base
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {bases.map((base) => (
              <BaseCard key={base.id} base={base} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function BaseCard({ base }: { base: { id: string; name: string } }) {
  // Get the first table in this base
  const tables = await api.table.list({ baseId: base.id });
  const firstTable = tables[0];

  const href = firstTable
    ? `/base/${base.id}/table/${firstTable.id}`
    : `/base/${base.id}`;

  return (
    <Link
      href={href}
      className="block group relative bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200"
    >
      <div className="p-6">
        <div className="flex items-center mb-3">
          <div className="w-10 h-10 rounded bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-lg">
            {base.name.charAt(0).toUpperCase()}
          </div>
        </div>
        <h3 className="text-lg font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
          {base.name}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {tables.length} {tables.length === 1 ? 'table' : 'tables'}
        </p>
      </div>
    </Link>
  );
}
