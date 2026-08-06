"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  display_name: string | null;
  avatar_url: string | null;
};

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
    return (
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
        <span>Đang tải...</span>
      </div>
    );
  }

  if (!userEmail) {
    return null;
  }

  const displayName = profile?.display_name ?? "";

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-medium text-text-primary">{displayName || userEmail}</span>
      {displayName && <span className="hidden text-text-secondary sm:inline">{userEmail}</span>}
    </div>
  );
}
