import { redirect } from "next/navigation";

export default async function BasePage({
  params,
}: {
  params: Promise<{ baseId: string }>;
}) {
  const { baseId } = await params;
  redirect(`/base/${baseId}/table`);
}
