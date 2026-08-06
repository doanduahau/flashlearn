import { redirect } from "next/navigation";

export default async function StatisticsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ month?: string | string[] }> }>) {
  const month = (await searchParams).month;
  const suffix = typeof month === "string" ? `&month=${encodeURIComponent(month)}` : "";
  redirect(`/profile?tab=statistics${suffix}`);
}
