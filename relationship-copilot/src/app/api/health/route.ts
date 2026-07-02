import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  AuthenticationRequiredError,
  requireUser as requireAuthenticatedUser,
  type AuthenticatedUser,
} from "@/infrastructure/auth/require-user";
import { createServerClient } from "@/infrastructure/supabase/server-client";

interface HealthHandlerDependencies {
  readonly createClient: () => Promise<SupabaseClient>;
  readonly requireUser: (
    client: SupabaseClient,
  ) => Promise<AuthenticatedUser>;
}

const defaultDependencies: HealthHandlerDependencies = {
  createClient: createServerClient,
  requireUser: requireAuthenticatedUser,
};

export function createHealthHandler(
  dependencies: HealthHandlerDependencies = defaultDependencies,
) {
  return async function GET(request: NextRequest) {
    void request;
    try {
      const client = await dependencies.createClient();
      await dependencies.requireUser(client);
      return NextResponse.json({ status: "ok" });
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        return NextResponse.json(
          { error: "authentication_required" },
          { status: 401 },
        );
      }

      return NextResponse.json(
        { error: "service_unavailable" },
        { status: 503 },
      );
    }
  };
}

export const GET = createHealthHandler();
