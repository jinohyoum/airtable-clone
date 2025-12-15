import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect("/api/auth/signin");
  }

  const bases = await api.base.list();

  return (
    <HydrateClient>
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold">My Bases</h1>
            <Link
              href="/api/auth/signout"
              className="rounded-md bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300"
            >
              Sign out
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bases.map((base) => (
              <Link
                key={base.id}
                href={`/base/${base.id}`}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <h2 className="text-xl font-semibold">{base.name}</h2>
                <p className="mt-2 text-sm text-gray-500">
                  {base.createdAt.toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>

          {bases.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-500">No bases yet. Create one to get started.</p>
            </div>
          )}
        </div>
      </main>
    </HydrateClient>
  );
}
