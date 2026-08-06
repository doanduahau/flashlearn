import { redirect } from "next/navigation";

export default function CollectionsPage() {
  redirect("/sets?tab=special");
}
