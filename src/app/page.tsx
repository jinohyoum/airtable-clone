import { auth } from "~/server/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/signin");

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Home renders ✅</h1>
      <p>Signed in as: {session.user?.email}</p>
    </main>
  );
}
