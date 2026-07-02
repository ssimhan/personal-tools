import { describe, expect, it } from "vitest";

import { requireUser } from "@/infrastructure/auth/require-user";
import {
  createAuthenticatedRequest,
  createAuthClient,
} from "@/test/authenticated-request";
import { tenantFixtures } from "@/test/tenant-fixtures";

import { createHealthHandler } from "./route";

describe("GET /api/health", () => {
  it("rejects anonymous requests without exposing details", async () => {
    const client = createAuthClient({ user: null });
    const handler = createHealthHandler({
      createClient: async () => client,
      requireUser,
    });

    const response = await handler(createAuthenticatedRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "authentication_required",
    });
  });

  it("returns a minimal status for authenticated users", async () => {
    const client = createAuthClient({
      user: {
        id: tenantFixtures.ownerA,
        email: "owner-a@example.test",
      },
    });
    const handler = createHealthHandler({
      createClient: async () => client,
      requireUser,
    });

    const response = await handler(createAuthenticatedRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
    expect(JSON.stringify(body)).not.toContain(tenantFixtures.ownerA);
    expect(JSON.stringify(body)).not.toContain("owner-a@example.test");
  });
});
