import type { Person } from "./person";
import type { Result } from "@/domain/shared/result";

export interface CreatePersonValues {
  readonly displayName: string;
  readonly company?: string | null;
  readonly relationshipSummary?: string | null;
  readonly notes?: string | null;
}

export interface UpdatePersonValues {
  readonly displayName?: string;
  readonly company?: string | null;
  readonly relationshipSummary?: string | null;
  readonly notes?: string | null;
}

export type PersonRepositoryError =
  | Readonly<{ code: "not_found" }>
  | Readonly<{ code: "invalid_record"; field?: string }>
  | Readonly<{ code: "database_error"; message: string }>;

export interface PersonRepository {
  create(
    ownerId: string,
    values: CreatePersonValues,
  ): Promise<Result<Person, PersonRepositoryError>>;
  getById(
    ownerId: string,
    personId: string,
  ): Promise<Result<Person, PersonRepositoryError>>;
  list(ownerId: string): Promise<Result<readonly Person[], PersonRepositoryError>>;
  update(
    ownerId: string,
    personId: string,
    values: UpdatePersonValues,
  ): Promise<Result<Person, PersonRepositoryError>>;
}
