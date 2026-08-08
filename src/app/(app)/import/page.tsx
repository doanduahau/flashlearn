import { redirect } from "next/navigation";

export default function ImportPage() {
  redirect("/sets?create=import");
}
