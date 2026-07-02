import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AuthenticationFailure = "missing_session" | "expired_session";

export class AuthenticationRequiredError extends Error {
  readonly code = "authentication_required";

  constructor(readonly reason: AuthenticationFailure) {
    super("Authentication required");
    this.name = "AuthenticationRequiredError";
  }
}

export interface AuthenticatedUser {
  readonly ownerId: string;
  readonly user: Pick<User, "id" | "email">;
}

export async function requireUser(
  client: SupabaseClient,
): Promise<AuthenticatedUser> {
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw new AuthenticationRequiredError("expired_session");
  }

  if (!data.user) {
    throw new AuthenticationRequiredError("missing_session");
  }

  return {
    ownerId: data.user.id,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  };
}
