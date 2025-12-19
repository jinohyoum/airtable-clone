import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { api } from "~/trpc/server";

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/signin");

  // Get user's bases
  const bases = await api.base.list();

  // If user has no bases, create a default one
  if (bases.length === 0) {
    const newBase = await api.base.create({ name: "My First Base" });
    const newTable = await api.table.create({
      baseId: newBase.id,
      name: "Table 1",
    });
    redirect(`/base/${newBase.id}/table/${newTable.id}`);
  }

  // Get the first base
  const firstBase = bases[0]!;

  // Get tables in the first base
  const tables = await api.table.list({ baseId: firstBase.id });

  // If no tables exist, create a default one
  if (tables.length === 0) {
    const newTable = await api.table.create({
      baseId: firstBase.id,
      name: "Table 1",
    });
    redirect(`/base/${firstBase.id}/table/${newTable.id}`);
  }

  // Redirect to the first table
  redirect(`/base/${firstBase.id}/table/${tables[0]!.id}`);
}
