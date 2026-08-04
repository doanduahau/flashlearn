"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { validateSignUp, validateSignIn } from "@/features/auth/schemas/auth-schema";
import { sanitizeRedirect } from "@/features/auth/utils/safe-redirect";
import { mapAuthError } from "@/features/auth/utils/auth-error";

export async function signUp(formData: FormData): Promise<void> {
  const raw = {
    displayName: formData.get("displayName") as string | undefined,
    email: formData.get("email") as string | undefined,
    password: formData.get("password") as string | undefined,
    confirmPassword: formData.get("confirmPassword") as string | undefined,
  };

  const validated = validateSignUp(raw);
  if (!validated.success) {
    const fieldErrors = validated.error.flatten().fieldErrors;
    const errorMsg = Object.values(fieldErrors).flat().join(", ");
    redirect(`/sign-up?error=${encodeURIComponent(errorMsg)}`);
    return;
  }

  const { displayName, email, password } = validated.data;

  let redirectTo = "/sign-up?error=" + encodeURIComponent(mapAuthError("unknown_error"));

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          display_name: displayName?.trim() ?? null,
        },
        emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
      },
    });

    if (error) {
      console.error("[signUp] Supabase error:", error.message);
      redirectTo = "/sign-up?error=" + encodeURIComponent(mapAuthError("sign_up_failed"));
    } else if (data.session) {
      redirectTo = "/dashboard";
    } else {
      redirectTo = "/check-email";
    }
  } catch (error) {
    console.error("[signUp] Unexpected error:", error);
    redirectTo = "/sign-up?error=" + encodeURIComponent(mapAuthError("unknown_error"));
  }

  redirect(redirectTo);
}

export async function signIn(formData: FormData): Promise<void> {
  const raw = {
    email: formData.get("email") as string | undefined,
    password: formData.get("password") as string | undefined,
  };

  const validated = validateSignIn(raw);
  if (!validated.success) {
    const fieldErrors = validated.error.flatten().fieldErrors;
    const errorMsg = Object.values(fieldErrors).flat().join(", ");
    redirect(`/sign-in?error=${encodeURIComponent(errorMsg)}`);
    return;
  }

  const { email, password } = validated.data;

  let redirectTo = `/sign-in?error=${encodeURIComponent(mapAuthError("sign_in_failed"))}`;

  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      console.error("[signIn] Supabase error:", error.message);
      redirectTo = `/sign-in?error=${encodeURIComponent(mapAuthError("invalid_credentials"))}`;
    } else {
      redirectTo = sanitizeRedirect(formData.get("next") as string | null, "/dashboard");
    }
  } catch (error) {
    console.error("[signIn] Unexpected error:", error);
    redirectTo = `/sign-in?error=${encodeURIComponent(mapAuthError("sign_in_failed"))}`;
  }

  redirect(redirectTo);
}

export async function signOut(): Promise<void> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      console.error("[signOut] Supabase error:", error.message);
    }
  } catch (error) {
    console.error("[signOut] Unexpected error:", error);
  }

  revalidatePath("/", "layout");
  redirect("/sign-in");
}
