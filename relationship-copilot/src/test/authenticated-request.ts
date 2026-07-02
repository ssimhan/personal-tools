import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export function createAuthenticatedRequest(path = "/api/health") {
  return new NextRequest(new URL(path, "http://127.0.0.1:3000"));
}

export function createAuthClient(options: {
  readonly user: Pick<User, "id" | "email"> | null;
  readonly error?: { code: string; message: string } | null;
}) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: options.user },
        error: options.error ?? null,
      }),
    },
  } as unknown as SupabaseClient;
}
