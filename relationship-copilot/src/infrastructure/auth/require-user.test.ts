import type { SupabaseClient, User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  AuthenticationRequiredError,
  requireUser,
} from "./require-user";

const ownerId = "00000000-0000-4000-8000-000000000001";

function authClient(options: {
  user: Pick<User, "id" | "email"> | null;
  error?: { code: string; message: string } | null;
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

describe("requireUser", () => {
  it("rejects a missing session", async () => {
    await expect(
      requireUser(authClient({ user: null })),
    ).rejects.toEqual(
      new AuthenticationRequiredError("missing_session"),
    );
  });

  it("rejects an expired session", async () => {
    await expect(
      requireUser(
        authClient({
          user: null,
          error: { code: "bad_jwt", message: "JWT expired" },
        }),
      ),
    ).rejects.toEqual(
      new AuthenticationRequiredError("expired_session"),
    );
  });

  it("uses the authenticated user id as the only owner id", async () => {
    const user = { id: ownerId, email: "owner@example.test" };

    await expect(requireUser(authClient({ user }))).resolves.toEqual({
      ownerId,
      user,
    });
  });
});
