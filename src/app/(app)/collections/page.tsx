import { redirect } from "next/navigation";

export default function CollectionsPage() {
  redirect("/sets/library?tab=special");
}
