import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { SupabasePersonRepository } from "./supabase-person-repository";

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const personId = "10000000-0000-4000-8000-000000000001";

const personRow = {
  id: personId,
  owner_id: ownerA,
  display_name: "Joan Doe",
  company: "Example Studio",
  relationship_summary: null,
  notes: null,
};

interface QueryBuilderMock {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

function createClient(result: { data: unknown; error: unknown }) {
  const builder = {} as QueryBuilderMock;
  builder.select = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(async () => result);
  builder.single = vi.fn(async () => result);
  builder.maybeSingle = vi.fn(async () => result);

  const from = vi.fn(() => builder);

  return {
    builder,
    client: { from } as unknown as SupabaseClient,
    from,
  };
}

describe("SupabasePersonRepository", () => {
  it("creates a person with the explicit owner id", async () => {
    const { builder, client, from } = createClient({
      data: personRow,
      error: null,
    });
    const repository = new SupabasePersonRepository(client);

    const result = await repository.create(ownerA, {
      displayName: " Joan Doe ",
      company: " Example Studio ",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: personId,
        ownerId: ownerA,
        displayName: "Joan Doe",
        company: "Example Studio",
        relationshipSummary: null,
        notes: null,
      },
    });
    expect(from).toHaveBeenCalledWith("people");
    expect(builder.insert).toHaveBeenCalledWith({
      owner_id: ownerA,
      display_name: "Joan Doe",
      company: "Example Studio",
      relationship_summary: null,
      notes: null,
    });
  });

  it("scopes get-by-id to the explicit owner and hides other tenants", async () => {
    const { builder, client } = createClient({ data: null, error: null });
    const repository = new SupabasePersonRepository(client);

    const result = await repository.getById(ownerA, personId);

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    expect(builder.eq).toHaveBeenNthCalledWith(1, "owner_id", ownerA);
    expect(builder.eq).toHaveBeenNthCalledWith(2, "id", personId);
  });

  it("scopes lists to the explicit owner", async () => {
    const { builder, client } = createClient({
      data: [personRow],
      error: null,
    });
    const repository = new SupabasePersonRepository(client);

    const result = await repository.list(ownerA);

    expect(result.ok).toBe(true);
    expect(builder.eq).toHaveBeenCalledWith("owner_id", ownerA);
    expect(builder.order).toHaveBeenCalledWith("updated_at", {
      ascending: false,
    });
  });

  it("scopes updates to both owner and record id", async () => {
    const { builder, client } = createClient({
      data: { ...personRow, display_name: "Joan Smith" },
      error: null,
    });
    const repository = new SupabasePersonRepository(client);

    const result = await repository.update(ownerA, personId, {
      displayName: " Joan Smith ",
    });

    expect(result.ok).toBe(true);
    expect(builder.update).toHaveBeenCalledWith({
      display_name: "Joan Smith",
    });
    expect(builder.eq).toHaveBeenNthCalledWith(1, "owner_id", ownerA);
    expect(builder.eq).toHaveBeenNthCalledWith(2, "id", personId);
  });

  it("does not infer a canonical owner for admin-backed jobs", async () => {
    const { builder, client } = createClient({ data: null, error: null });
    const adminRepository = new SupabasePersonRepository(client);

    await adminRepository.getById(ownerB, personId);

    expect(builder.eq).toHaveBeenNthCalledWith(1, "owner_id", ownerB);
  });
});
