import { z } from "zod";

import { err, ok, type Result } from "@/domain/shared/result";

type InteractionErrorCode =
  | "invalid_id"
  | "invalid_owner_id"
  | "invalid_person_id"
  | "invalid_type"
  | "invalid_occurred_at"
  | "invalid_summary"
  | "invalid_source_record_id";

export interface InteractionDomainError {
  readonly code: InteractionErrorCode;
  readonly field:
    | "id"
    | "ownerId"
    | "personId"
    | "type"
    | "occurredAt"
    | "summary"
    | "sourceRecordId";
}

export interface Interaction {
  readonly id: string;
  readonly ownerId: string;
  readonly personId: string;
  readonly type: string;
  readonly occurredAt: string;
  readonly summary: string;
  readonly sourceRecordId: string | null;
}

export interface CreateInteractionInput {
  readonly id: string;
  readonly ownerId: string;
  readonly personId: string;
  readonly type: string;
  readonly occurredAt: string | Date;
  readonly summary: string;
  readonly sourceRecordId?: string | null;
}

const uuidSchema = z.string().uuid();
const unsafeControlCharacters = /[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function createInteraction(
  input: CreateInteractionInput,
): Result<Interaction, InteractionDomainError> {
  if (!uuidSchema.safeParse(input.id).success) {
    return err({ code: "invalid_id", field: "id" });
  }

  if (!uuidSchema.safeParse(input.ownerId).success) {
    return err({ code: "invalid_owner_id", field: "ownerId" });
  }

  if (!uuidSchema.safeParse(input.personId).success) {
    return err({ code: "invalid_person_id", field: "personId" });
  }

  const type = input.type.trim();
  if (!type || type.length > 50) {
    return err({ code: "invalid_type", field: "type" });
  }

  const occurredAt = new Date(input.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    return err({ code: "invalid_occurred_at", field: "occurredAt" });
  }

  const summary = input.summary.trim();
  if (
    !summary ||
    summary.length > 2_000 ||
    unsafeControlCharacters.test(summary)
  ) {
    return err({ code: "invalid_summary", field: "summary" });
  }

  if (
    input.sourceRecordId &&
    !uuidSchema.safeParse(input.sourceRecordId).success
  ) {
    return err({
      code: "invalid_source_record_id",
      field: "sourceRecordId",
    });
  }

  return ok(
    Object.freeze({
      id: input.id,
      ownerId: input.ownerId,
      personId: input.personId,
      type,
      occurredAt: occurredAt.toISOString(),
      summary,
      sourceRecordId: input.sourceRecordId ?? null,
    }),
  );
}
