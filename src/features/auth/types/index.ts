export type AuthResult =
  | { success: true; redirectTo: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export type SignUpResult = AuthResult;
export type SignInResult = AuthResult;
export type SignOutResult = { success: boolean; error?: string };
