import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type CreatePersonValues,
  type PersonRepository,
  type PersonRepositoryError,
  type UpdatePersonValues,
} from "@/domain/people/person-repository";
import { createPerson, type Person } from "@/domain/people/person";
import { err, ok, type Result } from "@/domain/shared/result";

const personColumns =
  "id, owner_id, display_name, company, relationship_summary, notes";

interface PersonRow {
  readonly id: string;
  readonly owner_id: string;
  readonly display_name: string;
  readonly company: string | null;
  readonly relationship_summary: string | null;
  readonly notes: string | null;
}

export class SupabasePersonRepository implements PersonRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(
    ownerId: string,
    values: CreatePersonValues,
  ): Promise<Result<Person, PersonRepositoryError>> {
    const displayName = values.displayName.trim();
    if (!displayName) {
      return err({ code: "invalid_record", field: "displayName" });
    }

    const { data, error } = await this.client
      .from("people")
      .insert({
        owner_id: ownerId,
        display_name: displayName,
        company: trimToNull(values.company),
        relationship_summary: trimToNull(values.relationshipSummary),
        notes: trimToNull(values.notes),
      })
      .select(personColumns)
      .single();

    if (error) return databaseError(error.message);
    return mapRow(data as PersonRow);
  }

  async getById(
    ownerId: string,
    personId: string,
  ): Promise<Result<Person, PersonRepositoryError>> {
    const { data, error } = await this.client
      .from("people")
      .select(personColumns)
      .eq("owner_id", ownerId)
      .eq("id", personId)
      .maybeSingle();

    if (error) return databaseError(error.message);
    if (!data) return err({ code: "not_found" });
    return mapRow(data as PersonRow);
  }

  async list(
    ownerId: string,
  ): Promise<Result<readonly Person[], PersonRepositoryError>> {
    const { data, error } = await this.client
      .from("people")
      .select(personColumns)
      .eq("owner_id", ownerId)
      .order("updated_at", { ascending: false });

    if (error) return databaseError(error.message);

    const people: Person[] = [];
    for (const row of (data ?? []) as PersonRow[]) {
      const person = mapRow(row);
      if (!person.ok) return person;
      people.push(person.value);
    }

    return ok(Object.freeze(people));
  }

  async update(
    ownerId: string,
    personId: string,
    values: UpdatePersonValues,
  ): Promise<Result<Person, PersonRepositoryError>> {
    const patch: Record<string, string | null> = {};

    if (values.displayName !== undefined) {
      const displayName = values.displayName.trim();
      if (!displayName) {
        return err({ code: "invalid_record", field: "displayName" });
      }
      patch.display_name = displayName;
    }
    if (values.company !== undefined) {
      patch.company = trimToNull(values.company);
    }
    if (values.relationshipSummary !== undefined) {
      patch.relationship_summary = trimToNull(values.relationshipSummary);
    }
    if (values.notes !== undefined) {
      patch.notes = trimToNull(values.notes);
    }

    const { data, error } = await this.client
      .from("people")
      .update(patch)
      .eq("owner_id", ownerId)
      .eq("id", personId)
      .select(personColumns)
      .maybeSingle();

    if (error) return databaseError(error.message);
    if (!data) return err({ code: "not_found" });
    return mapRow(data as PersonRow);
  }
}

function mapRow(row: PersonRow): Result<Person, PersonRepositoryError> {
  const result = createPerson({
    id: row.id,
    ownerId: row.owner_id,
    displayName: row.display_name,
    company: row.company,
    relationshipSummary: row.relationship_summary,
    notes: row.notes,
  });

  if (!result.ok) {
    return err({ code: "invalid_record", field: result.error.field });
  }

  return result;
}

function databaseError(
  message: string,
): Result<never, PersonRepositoryError> {
  return err({ code: "database_error", message });
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
