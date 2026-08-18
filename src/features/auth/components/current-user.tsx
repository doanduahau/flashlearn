"use client";

import { User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LoadingDots } from "@/components/shared/loading-dots";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  display_name: string | null;
  avatar_url: string | null;
};

function emailLocalPart(email: string): string {
  return email.split("@")[0] ?? "";
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

export function CurrentUser() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchUser() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUserEmail(user.email ?? null);

          const { data: profileData } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("id", user.id)
            .single();

          if (!cancelled) setProfile(profileData);
        }
      } catch {
        // Profile fetch failure should not block the shell.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchUser();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (loading) {
    return <LoadingDots label="Đang tải" />;
  }

  if (!userEmail) {
    return null;
  }

  const displayName = profile?.display_name?.trim() ?? "";
  const visibleName = displayName || emailLocalPart(userEmail);
  const initials = initialsOf(visibleName);
  const emailLabel = `${visibleName} (${userEmail})`;

  return (
    <Link
      href="/profile"
      className="group relative flex min-w-0 items-center gap-2.5 rounded-xl px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-foreground"
      >
        {initials ? initials : <User className="size-5" aria-hidden="true" />}
      </span>
      <span
        aria-label={emailLabel}
        className="min-w-0 truncate text-sm font-medium text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {visibleName}
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 max-w-[16rem] break-words rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-xs text-text-secondary shadow-soft-card opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        role="tooltip"
      >
        {userEmail}
      </span>
    </Link>
  );
}
