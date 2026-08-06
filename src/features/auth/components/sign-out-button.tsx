import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/server/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="size-9 shrink-0"
        aria-label="Đăng xuất"
        title="Đăng xuất"
      >
        <LogOut className="size-4" aria-hidden="true" />
      </Button>
    </form>
  );
}
